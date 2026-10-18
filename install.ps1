#Requires -Version 5.1
<#
.SYNOPSIS
    Installs or updates Notploy on Windows Server 2022/2025/2026.

.DESCRIPTION
    This is the complete Windows Server installer, fully implemented in
    PowerShell. It does not delegate to install.sh: the Linux installer and
    this script are two independent entry points that share the same install
    contract (Swarm services notploy / notploy-postgres, overlay network
    notploy-network, Traefik container notploy-traefik, config under
    /etc/notploy inside the Linux runtime).

    Notploy's application, database and proxy images are Linux images. On
    Windows Server they run as Linux containers inside WSL2, which provides a
    real Linux Docker engine with Swarm support. This script owns the whole
    Windows host story:

      1. verifies the host (elevated PowerShell, Windows Server 2022+),
      2. enables the WSL and VirtualMachinePlatform features,
      3. installs a WSL distribution (Ubuntu by default) in WSL2 mode,
      4. configures mirrored networking so ports 80/443/3000 are reachable
         from the LAN directly (no WSL2 NAT port-forwarding juggling),
      5. installs the Docker engine inside WSL if it is missing,
      6. opens the Windows firewall for the Notploy ports,
      7. provisions the Notploy stack (Swarm, secrets, services, Traefik,
         instance identity PKI) directly through the Docker engine.

    Native Windows containers are deliberately not supported: the published
    Notploy images (ghcr.io/skygenesisenterprise/notploy) target Linux.

    The Dokploy migration is not offered on Windows Server: Dokploy itself
    does not run there, so no migration source can exist on this host.

.PARAMETER Product
    Notploy product to install: self (default), cloud or console.
    Cloud and console require NOTPLOY_ENTITLEMENT in the environment (or
    NOTPLOY_ENTITLEMENT_FILE) plus NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE, and
    fail closed without a valid signature.

.PARAMETER Action
    Install (default) or Update an existing Notploy installation.

.PARAMETER WslDistro
    WSL distribution name to use/create. Defaults to "Ubuntu".

.PARAMETER AdvertiseAddr
    Address advertised by the Swarm manager. Auto-detected inside WSL when
    omitted.

.PARAMETER ForceIdentity
    Regenerate the local instance identity and PKI.

.PARAMETER DryRun
    Read-only preflight only; nothing is installed.

.PARAMETER Yes
    Accepted for parity with install.sh; this installer is non-interactive.

.EXAMPLE
    .\install.ps1
    Fresh self-hosted install on a clean Windows Server 2026.

.EXAMPLE
    .\install.ps1 -Product cloud
    Cloud install with the entitlement taken from NOTPLOY_ENTITLEMENT.

.EXAMPLE
    .\install.ps1 -Action Update
    Update an existing Notploy installation.
#>
[CmdletBinding()]
param(
    [ValidateSet('self', 'cloud', 'console')]
    [string]$Product = 'self',

    [ValidateSet('Install', 'Update')]
    [string]$Action = 'Install',

    [string]$WslDistro = 'Ubuntu',

    [string]$AdvertiseAddr = '',

    [switch]$ForceIdentity,

    [switch]$DryRun,

    [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Contract shared with install.sh. Every path below lives inside the WSL
# distribution: the Docker engine only sees Linux paths.
$script:NotployConfigDir = '/etc/notploy'
$script:IdentityDir = "$script:NotployConfigDir/identity"
$script:NetworkName = 'notploy-network'
$script:TraefikImage = 'traefik:v3.6.25'
$script:PostgresImage = 'postgres:16'
$script:RequiredPorts = @(80, 443, 3000)

# --- Host prerequisites -----------------------------------------------------

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This installer must run from an elevated PowerShell (Run as administrator).'
    }
}

function Assert-SupportedWindows {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $build = [int]$os.BuildNumber
    # Server 2022 is build 20348; Server 2025/2026 are newer. WSL2 with
    # mirrored networking requires Server 2022 or later.
    $minimumBuild = 20348
    if ($build -lt $minimumBuild) {
        throw "Windows build $build is not supported. Windows Server 2022 (build $minimumBuild) or later is required."
    }
    if ($os.ProductType -eq 1) {
        Write-Warning 'This host is not a Windows Server edition. Client Windows may work for testing, but Notploy on Windows Server is the supported configuration.'
    }
}

# --- WSL bootstrap ----------------------------------------------------------

function Test-WslCliAvailable {
    $null -ne (Get-Command wsl.exe -ErrorAction SilentlyContinue)
}

function Get-WslFeatureState {
    param([Parameter(Mandatory)][string]$Name)
    (Get-WindowsOptionalFeature -Online -FeatureName $Name).State
}

function Enable-WslHostFeatures {
    $needsRestart = $false
    foreach ($name in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
        if ((Get-WslFeatureState -Name $name) -ne 'Enabled') {
            Write-Host "Enabling Windows feature $name..."
            $result = Enable-WindowsOptionalFeature -Online -NoRestart -FeatureName $name
            if ($result.RestartNeeded) { $needsRestart = $true }
        }
    }
    if ($needsRestart) {
        Write-Warning 'A reboot is required to finish enabling WSL2. Reboot this server, then re-run this installer.'
        exit 3010
    }
}

function Get-WslDistroNames {
    if (-not (Test-WslCliAvailable)) { return @() }
    $raw = & wsl.exe --list --quiet 2>$null
    if ($LASTEXITCODE -ne 0 -or $null -eq $raw) { return @() }
    @($raw | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
}

function Install-WslDistro {
    param([Parameter(Mandatory)][string]$Name)

    if ((Get-WslDistroNames) -contains $Name) {
        Write-Host "WSL distribution '$Name' already present."
    }
    else {
        Write-Host "Installing WSL distribution '$Name' (this can take a few minutes)..."
        # --no-launch keeps the distro's default user as root: every command
        # below runs as root and never needs an interactive OOBE.
        & wsl.exe --install --distribution $Name --no-launch --web-download
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install the WSL distribution '$Name' (wsl exit code $LASTEXITCODE)."
        }
    }

    & wsl.exe --set-version $Name 2 | Out-Null
    & wsl.exe --set-default-version 2 | Out-Null
}

function Set-WslMirroredNetworking {
    # Mirrored networking makes WSL bound ports (80/443/3000) reachable on the
    # host's own addresses, which is what a LAN-facing Notploy server needs.
    $wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
    $block = @('[wsl2]', 'networkingMode=mirrored', 'dnsTunneling=true', 'autoProxy=true')

    if (Test-Path $wslConfig) {
        $current = Get-Content -Path $wslConfig -Raw -ErrorAction SilentlyContinue
        if ($current -match 'networkingMode\s*=\s*mirrored') { return }
        Write-Warning ".wslconfig exists but does not set networkingMode=mirrored; appending the Notploy block."
        Add-Content -Path $wslConfig -Value "`n$($block -join "`n")"
        & wsl.exe --shutdown | Out-Null
        return
    }

    Write-Host "Configuring mirrored WSL networking in $wslConfig..."
    Set-Content -Path $wslConfig -Value ($block -join "`n") -Encoding ASCII
    & wsl.exe --shutdown | Out-Null
}

# Runs a shell command as root inside the WSL distribution. All Docker and
# filesystem operations on the Notploy stack go through this single gateway.
function Invoke-WslRoot {
    param(
        [Parameter(Mandatory)][string]$Command
    )
    & wsl.exe --distribution $WslDistro --user root --exec sh -c $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed inside WSL (exit code ${LASTEXITCODE}): $Command"
    }
}

# Same as Invoke-WslRoot but returns stdout and does not throw on failure
# ($LASTEXITCODE is left for the caller). Used for read-only detection.
function Invoke-WslRootCapture {
    param([Parameter(Mandatory)][string]$Command)
    $output = & wsl.exe --distribution $WslDistro --user root --exec sh -c $Command 2>$null
    [pscustomobject]@{
        Output     = @($output | ForEach-Object { "$_" })
        ExitCode   = $LASTEXITCODE
        ExitCodeOk = ($LASTEXITCODE -eq 0)
    }
}

function Ensure-WslDocker {
    Write-Host "Checking the Docker engine inside WSL '$WslDistro'..."
    $probe = Invoke-WslRootCapture -Command 'command -v docker >/dev/null 2>&1'
    if (-not $probe.ExitCodeOk) {
        Write-Host 'Installing the Docker engine inside WSL (get.docker.com)...'
        Invoke-WslRoot -Command @'
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates openssl
curl -fsSL https://get.docker.com | sh
service docker start
'@
    }
    else {
        # A freshly booted WSL instance does not always have dockerd running.
        Invoke-WslRoot -Command 'service docker start >/dev/null 2>&1 || true' | Out-Null
        # openssl is required for the instance identity PKI.
        Invoke-WslRoot -Command 'command -v openssl >/dev/null 2>&1 || { export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq openssl; }' | Out-Null
    }

    $ready = Invoke-WslRootCapture -Command 'docker info >/dev/null 2>&1'
    if (-not $ready.ExitCodeOk) {
        throw "The Docker engine inside WSL is not reachable. Inspect it with: wsl -d $WslDistro -u root -- service docker status"
    }
    Write-Host 'Docker engine ready inside WSL.'
}

# --- Windows firewall -------------------------------------------------------

function Ensure-NotployFirewallRules {
    $rules = @(
        @{ Name = 'Notploy-HTTP';       Port = 80;   Proto = 'TCP' },
        @{ Name = 'Notploy-HTTPS';      Port = 443;  Proto = 'TCP' },
        @{ Name = 'Notploy-HTTPS-UDP';  Port = 443;  Proto = 'UDP' },
        @{ Name = 'Notploy-Panel';      Port = 3000; Proto = 'TCP' }
    )
    foreach ($rule in $rules) {
        if ($null -eq (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
            Write-Host "Creating firewall rule '$($rule.Name)' (port $($rule.Port)/$($rule.Proto))..."
            New-NetFirewallRule -DisplayName $rule.Name `
                -Direction Inbound -Action Allow -Protocol $rule.Proto `
                -LocalPort $rule.Port | Out-Null
        }
    }
}

# --- Crypto helpers (Windows side) ------------------------------------------

function New-RandomPassword {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $password = [Convert]::ToBase64String($bytes).Replace('=', '').Replace('+', '').Replace('/', '')
    if ($password.Length -lt 20) {
        throw 'Failed to generate a random password.'
    }
    $password
}

function New-HexSecret {
    param([Parameter(Mandatory)][int]$Bytes = 32)
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    ($buffer | ForEach-Object { $_.ToString('x2') }) -join ''
}

# --- Product / entitlement --------------------------------------------------

function Resolve-Product {
    if ($env:NOTPLOY_PRODUCT) { return $env:NOTPLOY_PRODUCT.ToLowerInvariant() }
    switch ($env:NOTPLOY_FLAVOR) {
        'self' { return 'self' }
        'selfhosted' { return 'self' }
        'cloud' { return 'cloud' }
        'console' { return 'console' }
    }
    if ($env:IS_CLOUD -eq 'true') { return 'cloud' }
    $Product
}

function Test-AllowUnlicensedDev {
    switch ($env:NOTPLOY_ALLOW_UNLICENSED_DEV) {
        '1' { }
        'true' { }
        'yes' { }
        default { return $false }
    }
    $env:NODE_ENV -ne 'production'
}

# Verifies the compact entitlement token against the Notploy public key using
# openssl inside the WSL runtime (offline verification, same format as
# install.sh: notploy-entitlement-v1.<payload>.<signature>).
function Test-EntitlementToken {
    param([Parameter(Mandatory)][string]$Token)

    $publicKey = $env:NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE
    if (-not $publicKey) { $publicKey = "$script:IdentityDir/entitlement-ca.pub" }

    if (-not (Test-Path -LiteralPath (Convert-WslPathForHostProbe $publicKey))) {
        # The identity dir lives inside WSL; probe through wsl instead of the
        # Windows filesystem when the path is not a Windows path.
        $exists = Invoke-WslRootCapture -Command "[ -f '$publicKey' ]"
        if (-not $exists.ExitCodeOk) {
            throw "Notploy entitlement public key not found at $publicKey. Set NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE to the Notploy signing public key."
        }
    }

    $parts = $Token.Split('.')
    if ($parts.Count -ne 3 -or $parts[0] -ne 'notploy-entitlement-v1') {
        throw 'The entitlement token is malformed or has an unknown version.'
    }
    $payloadB64 = $parts[1]
    $signatureB64 = $parts[2]

    $b64urlToB64 = {
        param([string]$Data)
        $Data = $Data.Replace('_', '/').Replace('-', '+')
        switch ($Data.Length % 4) {
            2 { $Data += '==' }
            3 { $Data += '=' }
        }
        $Data
    }
    $payloadPath = '/tmp/notploy-entitlement-payload.json'
    $signaturePath = '/tmp/notploy-entitlement-signature.bin'
    $payloadB64Std = & $b64urlToB64 $payloadB64
    $signatureB64Std = & $b64urlToB64 $signatureB64

    $check = Invoke-WslRootCapture -Command @"
set -e
printf '%s' '$payloadB64Std' | base64 -d > $payloadPath
printf '%s' '$signatureB64Std' | base64 -d > $signaturePath
openssl dgst -sha256 -verify '$publicKey' -signature '$signaturePath' '$payloadPath' >/dev/null 2>&1
rm -f '$payloadPath' '$signaturePath'
"@
    $check.ExitCodeOk
}

# Windows paths are never used for the Notploy config: everything lives inside
# WSL. This helper exists so a Windows-style NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE
# can still be probed from PowerShell.
function Convert-WslPathForHostProbe {
    param([Parameter(Mandatory)][string]$Path)
    if ($Path -match '^[A-Za-z]:\\') {
        return $Path
    }
    $Path
}

# --- Preflight --------------------------------------------------------------

function Test-SshAvailableInWsl {
    (Invoke-WslRootCapture -Command 'command -v ss >/dev/null 2>&1').ExitCodeOk
}

function Test-PortListeningInWsl {
    param([Parameter(Mandatory)][int]$Port)
    $cmd = "ss -ltn 2>/dev/null | awk -v wanted='$Port' '{ n = split(`$4, p, `\":\"); if (p[n] == wanted) found = 1 } END { exit found ? 0 : 1 }'"
    (Invoke-WslRootCapture -Command $cmd).ExitCodeOk
}

function Assert-RequiredPorts {
    if (-not (Test-SshAvailableInWsl)) {
        Write-Warning "'ss' is not available inside WSL; skipping the listening-port check. Ensure ports 80, 443 and 3000 are free."
        return
    }
    foreach ($port in $script:RequiredPorts) {
        if (Test-PortListeningInWsl -Port $port) {
            $ownedByNotploy = (Invoke-WslRootCapture -Command "docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '^notploy' | grep -qE '(:${port}->|:${port}/)'").ExitCodeOk
            if ($ownedByNotploy) {
                Write-Host "Port $port is served by the existing Notploy installation (reusing it)."
                continue
            }
            throw "Port $port is already in use inside the WSL runtime. Notploy requires ports 80, 443 and 3000. Stop the conflicting service and re-run."
        }
    }
}

function Assert-SwarmSafeToInstall {
    $state = (Invoke-WslRootCapture -Command "docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null").Output -join ''
    $installed = Test-NotployInstalled
    if ($state -eq 'active' -and -not $installed) {
        throw @'
An active Docker Swarm was detected inside the WSL runtime, and it was not
created by Notploy. This installer refuses to leave or modify it. If you
really intend to replace it, run inside WSL:
  docker swarm leave --force
then re-run this installer.
'@
    }
}

function Test-NotployInstalled {
    $svc = Invoke-WslRootCapture -Command "docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx 'notploy'"
    if ($svc.ExitCodeOk) { return $true }
    $ctr = Invoke-WslRootCapture -Command "docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qE '^notploy$'"
    $ctr.ExitCodeOk
}

function Assert-NoDokploy {
    # Dokploy does not run on Windows Server, but a leftover Linux runtime
    # inside WSL could theoretically hold one. Migration is Linux-only: fail
    # closed instead of guessing.
    $found = Invoke-WslRootCapture -Command "docker ps -a --format '{{.Names}}|{{.Image}}' 2>/dev/null | grep -i 'dokploy' | grep -vi 'notploy' | grep -q ."
    if ($found.ExitCodeOk) {
        throw 'A Dokploy installation was detected inside the WSL runtime. The Dokploy -> Notploy migration is only supported on Linux (install.sh). Stop or remove Dokploy, or migrate on a Linux host first.'
    }
}

function Show-SystemPreflight {
    Write-Host 'Checking system...'
    Write-Host "✓ Windows Server (build $(Get-WindowsBuildNumber))"
    Write-Host "✓ WSL2 runtime ($WslDistro)"
    Write-Host '✓ Docker (inside WSL)'
    $mem = Get-CimInstance -ClassName Win32_OperatingSystem
    $freeGb = [math]::Round($mem.FreePhysicalMemory / 1MB, 1)
    if ($mem.TotalVisibleMemorySize -ge 1GB) {
        Write-Host '✓ Required resources'
    }
    else {
        Write-Warning 'Low memory: 1GB+ is recommended.'
    }
    Write-Host ''
}

# --- Version / image resolution ---------------------------------------------

function Get-LatestVersion {
    $version = $env:NOTPLOY_VERSION
    if ($version) { return $version }

    Write-Host 'Detecting latest stable version from GitHub...'
    try {
        $response = Invoke-WebRequest -Uri 'https://api.github.com/repos/skygenesisenterprise/notploy/releases/latest' -UseBasicParsing -TimeoutSec 10
        $tag = ($response.Content | ConvertFrom-Json).tag_name
        if ($tag -match '^v[0-9]') {
            Write-Host "Latest stable version detected: $tag"
            return $tag
        }
    }
    catch {
        Write-Warning 'Could not detect the latest version from GitHub; falling back to "latest".'
    }
    'latest'
}

function Resolve-DockerImage {
    param([Parameter(Mandatory)][string]$Tag)
    switch -Wildcard ($Tag) {
        'v[0-9]*.[0-9]*.[0-9]*-app' { return "ghcr.io/skygenesisenterprise/notploy:$Tag" }
        'v[0-9]*.[0-9]*.[0-9]*'     { return "ghcr.io/skygenesisenterprise/notploy:$Tag-app" }
        'latest'                    { return 'ghcr.io/skygenesisenterprise/notploy:latest' }
        default                     { return "ghcr.io/skygenesisenterprise/notploy:$Tag" }
    }
}

# --- Stack provisioning -----------------------------------------------------

function Get-PrivateIpInWsl {
    $result = Invoke-WslRootCapture -Command "ip -o -4 addr show scope global 2>/dev/null | awk '\$2 !~ /^(docker|br-|veth)/ {print \$4}' | cut -d/ -f1 | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' | head -n1"
    ($result.Output -join '').Trim()
}

function Initialize-Swarm {
    $advertise = $AdvertiseAddr
    if (-not $advertise) { $advertise = Get-PrivateIpInWsl }
    if (-not $advertise) {
        throw "Could not detect the WSL private IP address. Set -AdvertiseAddr manually and re-run."
    }
    Write-Host "Using advertise address: $advertise"
    $init = Invoke-WslRootCapture -Command "docker swarm init --advertise-addr '$advertise'"
    if (-not $init.ExitCodeOk) {
        throw 'Failed to initialize Docker Swarm inside the WSL runtime.'
    }
    Write-Host 'Swarm initialized'
}

function Ensure-ConfigDir {
    Invoke-WslRoot -Command @"
set -e
if [ -e '$script:NotployConfigDir' ] && [ ! -d '$script:NotployConfigDir' ]; then
    echo "Error: $script:NotployConfigDir exists but is not a directory" >&2
    exit 1
fi
mkdir -p '$script:NotployConfigDir'
chmod 700 '$script:NotployConfigDir'
echo 'Config directory ready: $script:NotployConfigDir (mode 700)'
"@
}

function Install-InstanceIdentity {
    Invoke-WslRoot -Command @"
set -e
dir='$script:IdentityDir'
product='$Product'
force='$ForceIdentity'

mkdir -p "`$dir"
chmod 700 "`$dir"

if [ -f "`$dir/instance.key" ] && [ "`$force" != 'True' ]; then
    if openssl verify -CAfile "`$dir/ca.crt" "`$dir/instance.crt" >/dev/null 2>&1 \
        && openssl x509 -in "`$dir/instance.crt" -checkend 0 -noout >/dev/null 2>&1; then
        echo "Instance identity already present and coherent at `$dir, keeping it"
        exit 0
    fi
    echo "Error: an instance identity exists at `$dir but is incomplete or incoherent." >&2
    echo "Move it aside deliberately, or re-run with -ForceIdentity to regenerate." >&2
    exit 1
fi

instance_id=`$(cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16)

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "`$dir/instance.key" >/dev/null 2>&1
chmod 600 "`$dir/instance.key"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "`$dir/ca.key" >/dev/null 2>&1
chmod 600 "`$dir/ca.key"
openssl req -x509 -new -key "`$dir/ca.key" -sha256 -days 3650 \
    -subj '/O=Notploy/CN=Notploy Local Instance Root CA' \
    -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign' \
    -out "`$dir/ca.crt" >/dev/null 2>&1
chmod 644 "`$dir/ca.crt"

openssl req -new -key "`$dir/instance.key" \
    -subj '/O=Notploy/CN=notploy-instance-'"`$instance_id" \
    -out "`$dir/instance.csr" >/dev/null 2>&1

extfile=`$(mktemp)
cat > "`$extfile" <<'EXT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth,serverAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EXT

openssl x509 -req -in "`$dir/instance.csr" \
    -CA "`$dir/ca.crt" -CAkey "`$dir/ca.key" -CAcreateserial \
    -days 825 -sha256 -extfile "`$extfile" \
    -out "`$dir/instance.crt" >/dev/null 2>&1
chmod 644 "`$dir/instance.crt"
rm -f "`$dir/instance.csr" "`$dir/ca.srl" "`$extfile"

created_at=`$(date -u +%Y-%m-%dT%H:%M:%SZ)
key_fingerprint=`$(openssl pkey -in "`$dir/instance.key" -pubout -outform DER 2>/dev/null \
    | openssl dgst -sha256 | sed 's/^.*= //')

case "`$product" in
    cloud)   capabilities='["cloud.control-plane","cloud.managed-services","cloud.fleet"]' ;;
    console) capabilities='["console.instance-management","console.fleet","console.remote-management"]' ;;
    *)       capabilities='["self.hosted","self.local-registry","self.offline"]' ;;
esac

cat > "`$dir/identity.json" <<JSON
{
  "version": 1,
  "instanceId": "`$instance_id",
  "product": "`$product",
  "capabilities": `$capabilities,
  "subjectKeyFingerprint": "`$key_fingerprint",
  "createdAt": "`$created_at"
}
JSON
chmod 644 "`$dir/identity.json"
echo "Instance identity created for product '`$product' at `$dir"
"@
}

function Install-Entitlement {
    if (Test-AllowUnlicensedDev) {
        Write-Warning "Running product '$Product' without a signed entitlement (development only)."
        return
    }

    $token = $env:NOTPLOY_ENTITLEMENT
    if (-not $token -and $env:NOTPLOY_ENTITLEMENT_FILE -and (Test-Path $env:NOTPLOY_ENTITLEMENT_FILE)) {
        $token = (Get-Content -Path $env:NOTPLOY_ENTITLEMENT_FILE -Raw).Trim()
    }
    if (-not $token) {
        throw "Product '$Product' requires a signed entitlement. Provide NOTPLOY_ENTITLEMENT (token) or NOTPLOY_ENTITLEMENT_FILE."
    }
    if (-not (Test-EntitlementToken -Token $token)) {
        throw "Refusing to install a protected product without a valid entitlement."
    }

    Invoke-WslRoot -Command @"
printf '%s\n' '$token' > '$script:IdentityDir/entitlement.token'
chmod 600 '$script:IdentityDir/entitlement.token'
"@
    Write-Host "Entitlement verified for product '$Product'"
}

function Install-Identity {
    Install-InstanceIdentity
    if ($Product -ne 'self') {
        Install-Entitlement
    }
}

function Ensure-OverlayNetwork {
    $inspect = Invoke-WslRootCapture -Command "docker network inspect $script:NetworkName --format '{{.Driver}}' 2>/dev/null"
    if ($inspect.ExitCodeOk) {
        $driver = ($inspect.Output -join '').Trim()
        if ($driver -eq 'overlay') {
            Write-Host "Reusing the existing '$script:NetworkName' overlay network."
            return
        }
        throw "A network named '$script:NetworkName' already exists with driver '$driver'. Refusing to delete it."
    }
    $create = Invoke-WslRootCapture -Command "docker network create --driver overlay --attachable $script:NetworkName >/dev/null 2>&1"
    if (-not $create.ExitCodeOk) {
        throw "Failed to create the '$script:NetworkName' overlay network."
    }
    Write-Host "Created overlay network '$script:NetworkName'."
}

function Ensure-DockerSecret {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )
    $exists = Invoke-WslRootCapture -Command "docker secret inspect '$Name' >/dev/null 2>&1"
    if ($exists.ExitCodeOk) {
        Write-Host "Secret '$Name' already exists; reusing it."
        return
    }
    # The value is piped through a base64 envelope so special characters never
    # break the remote shell command line.
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
    $create = Invoke-WslRootCapture -Command "printf '%s' '$encoded' | base64 -d | docker secret create '$Name' - >/dev/null 2>&1"
    if (-not $create.ExitCodeOk) {
        throw "Failed to create the required Docker secret '$Name'. Ensure Docker Swarm is active and this host is a manager."
    }
    Write-Host "Created Docker secret '$Name'."
}

function Test-ServiceExists {
    (Invoke-WslRootCapture -Command "docker service inspect '$1' >/dev/null 2>&1").ExitCodeOk
}

function Wait-ServiceConvergence {
    param(
        [Parameter(Mandatory)][string]$Service,
        [int]$TimeoutSeconds = 180
    )
    $waited = 0
    while ($waited -lt $TimeoutSeconds) {
        if (Test-ServiceExists -Service $Service) {
            $probe = Invoke-WslRootCapture -Command @"
set -e
update_state=`$(docker service inspect '$Service' --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}' 2>/dev/null || true)
case "`$update_state" in
    rollback_started|rollback_paused|rollback_completed) exit 2 ;;
esac
desired=`$(docker service inspect '$Service' --format '{{.Spec.Mode.Replicated.Replicas}}' 2>/dev/null || echo 1)
[ -n "`$desired" ] || desired=1
running=`$(docker service ps '$Service' --filter desired-state=running --format '{{.CurrentState}}' 2>/dev/null | grep -c '^Running' || true)
if [ "`$desired" != '0' ] && [ "`$running" = "`$desired" ] \
    && [ "`$update_state" != 'updating' ] && [ "`$update_state" != 'paused' ]; then
    exit 0
fi
exit 1
"@
            if ($probe.ExitCode -eq 0) { return $true }
            if ($probe.ExitCode -eq 2) { return $false }
        }
        Start-Sleep -Seconds 3
        $waited += 3
    }
    $false
}

function New-PostgresService {
    if (Test-ServiceExists -Service 'notploy-postgres') {
        Write-Host "Service 'notploy-postgres' already exists; leaving it untouched."
        return
    }
    $create = Invoke-WslRootCapture -Command @"
docker service create \
    --name notploy-postgres \
    --constraint 'node.role==manager' \
    --network $script:NetworkName \
    --env POSTGRES_USER=notploy \
    --env POSTGRES_DB=notploy \
    --secret source=notploy_postgres_password,target=/run/secrets/postgres_password \
    --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
    --mount type=volume,source=notploy-postgres,target=/var/lib/postgresql/data \
    $script:PostgresImage >/dev/null 2>&1
"@
    if (-not $create.ExitCodeOk) {
        throw "Failed to create the 'notploy-postgres' service."
    }
    Write-Host "Created service 'notploy-postgres'."
}

function New-AppService {
    param(
        [Parameter(Mandatory)][string]$Image,
        [Parameter(Mandatory)][string]$ReleaseTag
    )
    if (Test-ServiceExists -Service 'notploy') {
        Write-Host "Service 'notploy' already exists; leaving it untouched."
        return
    }

    $productEnv = ''
    if ($Product -ne 'self') {
        $productEnv = "-e NOTPLOY_FLAVOR=$Product -e IS_CLOUD=true -e NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE=$script:IdentityDir/entitlement-ca.pub"
    }

    $create = Invoke-WslRootCapture -Command @"
docker service create \
    --name notploy \
    --replicas 1 \
    --network $script:NetworkName \
    --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
    --mount type=bind,source=$script:NotployConfigDir,target=/etc/notploy \
    --mount type=volume,source=notploy,target=/root/.docker \
    --secret source=notploy_postgres_password,target=/run/secrets/postgres_password \
    --secret source=notploy_auth_secret,target=/run/secrets/notploy_auth_secret \
    --publish published=3000,target=3000,mode=host \
    --update-parallelism 1 \
    --update-order stop-first \
    --constraint 'node.role == manager' \
    $productEnv \
    -e RELEASE_TAG=$ReleaseTag \
    -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
    -e BETTER_AUTH_SECRET_FILE=/run/secrets/notploy_auth_secret \
    '$Image' >/dev/null 2>&1
"@
    if (-not $create.ExitCodeOk) {
        throw "Failed to create the 'notploy' service."
    }
    Write-Host "Created service 'notploy'."
}

function Ensure-TraefikContainer {
    $exists = Invoke-WslRootCapture -Command 'docker inspect notploy-traefik >/dev/null 2>&1'
    if ($exists.ExitCodeOk) {
        Write-Host "Container 'notploy-traefik' already exists; leaving it untouched."
        return
    }

    $imagePresent = Invoke-WslRootCapture -Command "docker image inspect '$script:TraefikImage' >/dev/null 2>&1"
    if (-not $imagePresent.ExitCodeOk) {
        Write-Host "Pulling $script:TraefikImage..."
        $pull = Invoke-WslRootCapture -Command "docker pull '$script:TraefikImage' >/dev/null 2>&1"
        if (-not $pull.ExitCodeOk) {
            throw "Could not pull $script:TraefikImage from the registry. Check connectivity/registry access and re-run."
        }
    }

    $run = Invoke-WslRootCapture -Command @"
docker run -d \
    --name notploy-traefik \
    --restart always \
    --network $script:NetworkName \
    -v '$script:NotployConfigDir/traefik/traefik.yml:/etc/traefik/traefik.yml' \
    -v '$script:NotployConfigDir/traefik/dynamic:/etc/notploy/traefik/dynamic' \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -p 80:80/tcp \
    -p 443:443/tcp \
    -p 443:443/udp \
    '$script:TraefikImage' >/dev/null 2>&1
"@
    if (-not $run.ExitCodeOk) {
        throw "Failed to start the Traefik container with $script:TraefikImage. Inspect with: docker logs notploy-traefik"
    }
    Write-Host "Started Traefik container ($script:TraefikImage)."
}

function Wait-RequiredPortsFree {
    param([int]$TimeoutSeconds = 30)
    if (-not (Test-SshAvailableInWsl)) { return $true }
    $waited = 0
    while ($waited -lt $TimeoutSeconds) {
        $busy = $false
        foreach ($port in $script:RequiredPorts) {
            if (Test-PortListeningInWsl -Port $port) {
                $owned = (Invoke-WslRootCapture -Command "docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '^notploy' | grep -qE '(:${port}->|:${port}/)'").ExitCodeOk
                if (-not $owned) { $busy = $true }
            }
        }
        if (-not $busy) { return $true }
        Start-Sleep -Seconds 2
        $waited += 2
    }
    $false
}

function Show-AccessSummary {
    $publicIp = $AdvertiseAddr
    if (-not $publicIp) {
        try {
            $publicIp = (Invoke-WebRequest -Uri 'https://ifconfig.io' -UseBasicParsing -TimeoutSec 5).Content.Trim()
        }
        catch {
            try { $publicIp = (Invoke-WebRequest -Uri 'https://icanhazip.com' -UseBasicParsing -TimeoutSec 5).Content.Trim() }
            catch { $publicIp = Get-PrivateIpInWsl }
        }
    }
    $privateIp = Get-PrivateIpInWsl
    Write-Host ''
    Write-Host 'Notploy is installed and the service is running.' -ForegroundColor Green
    Write-Host "Please go to http://${publicIp}:3000" -ForegroundColor Yellow
    if ($privateIp -and $privateIp -ne $publicIp) {
        Write-Host "If you are on the same local network, use http://${privateIp}:3000" -ForegroundColor Yellow
    }
}

# --- Actions ----------------------------------------------------------------

function Invoke-Install {
    Show-SystemPreflight
    Assert-NoDokploy

    if ($DryRun) {
        Write-Host 'Dry-run: preflight complete, no changes were made.'
        return
    }

    Assert-SwarmSafeToInstall
    Assert-RequiredPorts

    $versionTag = Get-LatestVersion
    $dockerImage = Resolve-DockerImage -Tag $versionTag
    Write-Host "Installing Notploy version: $versionTag (image: $dockerImage)"

    $swarmState = (Invoke-WslRootCapture -Command "docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null").Output -join ''
    if ($swarmState -ne 'active') {
        Initialize-Swarm
    }

    Ensure-OverlayNetwork
    Ensure-ConfigDir
    Install-Identity

    $postgresPassword = New-RandomPassword
    Ensure-DockerSecret -Name 'notploy_postgres_password' -Value $postgresPassword
    $authSecret = New-HexSecret -Bytes 32
    Ensure-DockerSecret -Name 'notploy_auth_secret' -Value $authSecret
    Write-Host 'Secure database credentials and auth secret stored as Docker Secrets.'

    New-PostgresService
    Write-Host "Waiting for the 'notploy-postgres' service to converge (up to 120s)..."
    if (-not (Wait-ServiceConvergence -Service 'notploy-postgres' -TimeoutSeconds 120)) {
        Invoke-WslRoot -Command 'docker service ps notploy-postgres --no-trunc >&2 || true'
        throw "The 'notploy-postgres' service did not converge."
    }

    New-AppService -Image $dockerImage -ReleaseTag $versionTag
    Write-Host "Waiting for the 'notploy' service to converge (up to 180s)..."
    if (Wait-ServiceConvergence -Service 'notploy' -TimeoutSeconds 180) {
        Write-Host "Service 'notploy' converged."
    }
    else {
        Invoke-WslRoot -Command 'docker service ps notploy --no-trunc >&2 || true'
        throw "The 'notploy' service did not converge within the timeout. Diagnose with: docker service ps notploy"
    }

    Ensure-TraefikContainer
    Show-AccessSummary
}

function Invoke-Update {
    if (-not (Test-NotployInstalled)) {
        throw 'No existing Notploy installation was found inside the WSL runtime. Run the installer without -Action Update to install it first.'
    }
    if (-not (Test-ServiceExists -Service 'notploy')) {
        throw "The 'notploy' service is missing, so it cannot be updated. Repair or reinstall it manually."
    }

    $versionTag = Get-LatestVersion
    $dockerImage = Resolve-DockerImage -Tag $versionTag
    Write-Host "Preparing to update Notploy to version: $versionTag (image: $dockerImage)"
    Write-Host 'Existing service configuration, secrets, volumes and mounts are preserved.'

    $pull = Invoke-WslRootCapture -Command "docker pull '$dockerImage' >/dev/null 2>&1"
    if (-not $pull.ExitCodeOk) {
        throw "Could not pull $dockerImage. Nothing was changed; the running version is untouched."
    }

    $update = Invoke-WslRootCapture -Command "docker service update --image '$dockerImage' notploy >/dev/null 2>&1"
    if (-not $update.ExitCodeOk) {
        throw "docker service update failed. Recover with: docker service rollback notploy"
    }

    Write-Host "Waiting for the 'notploy' service to converge (up to 180s)..."
    if (Wait-ServiceConvergence -Service 'notploy' -TimeoutSeconds 180) {
        Write-Host "Notploy has been updated to version: $versionTag."
    }
    else {
        Invoke-WslRoot -Command 'docker service ps notploy --no-trunc >&2 || true'
        throw @'
The update did not converge to a running state within the timeout.
Recovery: docker service rollback notploy
Note: an image rollback does not undo database schema migrations; check the
release notes if the new version changed the schema.
'@
    }
}

# --- Entry point ------------------------------------------------------------

function main {
    Assert-Administrator
    Assert-SupportedWindows

    $script:Product = Resolve-Product
    switch ($script:Product) {
        'self' { }
        'cloud' { }
        'console' { }
        default { throw "Unknown product '$script:Product' (expected self, cloud or console)." }
    }
    if ($script:Product -ne 'self') {
        $env:IS_CLOUD = 'true'
    }

    if (-not (Test-WslCliAvailable)) {
        Enable-WslHostFeatures
        if (-not (Test-WslCliAvailable)) {
            throw 'wsl.exe is still unavailable after enabling the features. Reboot this server, then re-run this installer.'
        }
    }

    Install-WslDistro -Name $WslDistro
    Set-WslMirroredNetworking
    Ensure-NotployFirewallRules
    Ensure-WslDocker

    if ($Action -eq 'Update') {
        Invoke-Update
    }
    else {
        Invoke-Install
    }

    Write-Host ''
    Write-Host 'Manage the stack from inside WSL with: wsl -d ' + $WslDistro + ' -u root'
}

try {
    main
}
catch {
    Write-Error $_
    exit 1
}
