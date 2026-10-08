#!/bin/bash

# Notploy version to install and maintain
DOCKER_VERSION="28.5.2"

# ---------------------------------------------------------------------------
# Installation modes
#
# `--self` (default) is free and autonomous: a local trust anchor and instance
# identity are generated on this host, with no contact with Notploy services.
# `--cloud` and `--console` are protected products: they require a Notploy-signed
# entitlement. A local flag is not a security boundary, so these modes fail
# closed when no verifiable entitlement is provided.
# ---------------------------------------------------------------------------
# Product resolution:
#   1. explicit NOTPLOY_PRODUCT (self | cloud | console), else
#   2. NOTPLOY_FLAVOR (self/selfhosted | cloud | console), else
#   3. the legacy IS_CLOUD=true signal (cloud), else
#   4. self-hosted.
NOTPLOY_PRODUCT="${NOTPLOY_PRODUCT:-}"
if [ -z "$NOTPLOY_PRODUCT" ]; then
    case "${NOTPLOY_FLAVOR:-}" in
        self | selfhosted) NOTPLOY_PRODUCT="self" ;;
        cloud) NOTPLOY_PRODUCT="cloud" ;;
        console) NOTPLOY_PRODUCT="console" ;;
        *)
            if [ "${IS_CLOUD:-false}" = "true" ]; then
                NOTPLOY_PRODUCT="cloud"
            else
                NOTPLOY_PRODUCT="self"
            fi
            ;;
    esac
fi
FORCE_IDENTITY=0
ACTION="install"

# Migration controls. `MIGRATION_REQUESTED` is tri-state:
#   ""   -> ask interactively when a supported source installation is detected
#   "1"  -> force the read-only migration assessment (--migrate)
#   "-1" -> force a fresh installation (--fresh)
MIGRATION_REQUESTED="${NOTPLOY_MIGRATION:-}"
DRY_RUN="${NOTPLOY_DRY_RUN:-0}"
ASSUME_YES="${NOTPLOY_ASSUME_YES:-0}"
OUTPUT_JSON="${NOTPLOY_OUTPUT_JSON:-0}"

# Normalize the environment-provided migration choice before arguments override it.
case "$MIGRATION_REQUESTED" in
    1|true|yes|migrate) MIGRATION_REQUESTED="1" ;;
    0|false|no|fresh) MIGRATION_REQUESTED="-1" ;;
    *) MIGRATION_REQUESTED="" ;;
esac

# `NOTPLOY_SOURCE_ONLY=1` turns this script into a library: the container
# entrypoint sources it to reuse the exact same identity bootstrap instead of
# duplicating the PKI logic. Argument parsing and installation are then skipped.
if [ "${NOTPLOY_SOURCE_ONLY:-0}" != "1" ]; then
    while [ $# -gt 0 ]; do
        case "$1" in
            --self) NOTPLOY_PRODUCT="self" ;;
            --cloud) NOTPLOY_PRODUCT="cloud" ;;
            --console) NOTPLOY_PRODUCT="console" ;;
            --force-identity) FORCE_IDENTITY=1 ;;
            --migrate|--migration) MIGRATION_REQUESTED="1" ;;
            --fresh|--no-migration) MIGRATION_REQUESTED="-1" ;;
            --dry-run) DRY_RUN=1 ;;
            -y|--yes) ASSUME_YES=1 ;;
            --json) OUTPUT_JSON=1 ;;
            update) ACTION="update" ;;
            -h|--help)
                cat <<'USAGE'
Usage: install.sh [--self|--cloud|--console] [--force-identity] [options] [update]

Installation options:
  --self|--cloud|--console   Select the Notploy product to install.
  --force-identity           Regenerate the local instance identity and PKI.

Migration options:
  --migrate                  Read-only Dokploy assessment (never modifies Dokploy).
  --fresh                    Force a fresh installation even if Dokploy is present.
  --dry-run                  Never install; only run the read-only preflight.
  -y, --yes                  Assume yes for migration prompts (non-interactive).
  --json                     Emit the detection result as JSON and exit.

Environment:
  NOTPLOY_MIGRATION          Same as --migrate (1) or --fresh (0).
  NOTPLOY_ALLOW_DESTRUCTIVE  Set to 1 to allow destroying a detected Docker Swarm.
USAGE
                exit 0
                ;;
            *)
                echo "Warning: ignoring unknown argument '$1'" >&2
                ;;
        esac
        shift
    done
fi

case "$NOTPLOY_PRODUCT" in
    self|cloud|console) ;;
    *)
        echo "Error: unknown product '$NOTPLOY_PRODUCT' (expected self, cloud or console)" >&2
        exit 1
        ;;
esac

# Cloud and Console share the cloud runtime behaviour, so keep IS_CLOUD in sync
# with the product. Exported so the value also reaches the app when install.sh is
# sourced by the container entrypoint.
if [ "$NOTPLOY_PRODUCT" != "self" ]; then
    export IS_CLOUD=true
fi

INSTANCE_IDENTITY_DIR="${NOTPLOY_CONFIG_PATH:-/etc/notploy}/identity"
INSTANCE_VALIDITY_DAYS="${NOTPLOY_INSTANCE_VALIDITY_DAYS:-825}"
CA_VALIDITY_DAYS="${NOTPLOY_CA_VALIDITY_DAYS:-3650}"

capabilities_for_product() {
    case "$1" in
        self) echo '["self.hosted","self.local-registry","self.offline"]' ;;
        cloud) echo '["cloud.control-plane","cloud.managed-services","cloud.fleet"]' ;;
        console) echo '["console.instance-management","console.fleet","console.remote-management"]' ;;
    esac
}

generate_instance_id() {
    if [ -r /proc/sys/kernel/random/uuid ]; then
        cat /proc/sys/kernel/random/uuid
    else
        openssl rand -hex 16
    fi
}

# URL-safe base64 without padding -> raw bytes on stdout.
base64url_decode() {
    local data
    data="$(cat | tr -d '\n')"
    data="$(printf '%s' "$data" | tr '_-' '/+')"
    local pad=$(( (4 - ${#data} % 4) % 4 ))
    while [ "$pad" -gt 0 ]; do
        data="${data}="
        pad=$((pad - 1))
    done
    printf '%s' "$data" | base64 -d
}

# Verifies the compact token `notploy-entitlement-v1.<payload>.<signature>`
# against Notploy's public key with openssl. Enables offline verification.
verify_entitlement_token() {
    local token="$1"
    local public_key="${NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE:-$INSTANCE_IDENTITY_DIR/entitlement-ca.pub}"

    if [ ! -f "$public_key" ]; then
        echo "Error: Notploy entitlement public key not found at $public_key" >&2
        echo "Set NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE to the Notploy signing public key." >&2
        return 1
    fi

    local prefix="${token%%.*}"
    local rest="${token#*.}"
    local payload="${rest%%.*}"
    local signature="${rest#*.}"

    if [ "$prefix" != "notploy-entitlement-v1" ]; then
        echo "Error: unknown entitlement token version '$prefix'" >&2
        return 1
    fi
    if [ -z "$payload" ] || [ -z "$signature" ] || [ "$payload" = "$token" ]; then
        echo "Error: the entitlement token is malformed" >&2
        return 1
    fi

    local workdir
    workdir="$(mktemp -d)"
    printf '%s' "$payload" | base64url_decode > "$workdir/payload.json" 2>/dev/null || true
    printf '%s' "$signature" | base64url_decode > "$workdir/signature.bin" 2>/dev/null || true

    if [ ! -s "$workdir/payload.json" ] || [ ! -s "$workdir/signature.bin" ]; then
        rm -rf "$workdir"
        echo "Error: the entitlement token is not decodable" >&2
        return 1
    fi

    if openssl dgst -sha256 -verify "$public_key" \
        -signature "$workdir/signature.bin" "$workdir/payload.json" >/dev/null 2>&1; then
        rm -rf "$workdir"
        return 0
    fi

    rm -rf "$workdir"
    echo "Error: the entitlement signature is invalid" >&2
    return 1
}

# Bootstraps the local instance identity: key pair, local trust anchor and a
# signed instance certificate. No network access and no Notploy account needed.
bootstrap_instance_identity() {
    local dir="$INSTANCE_IDENTITY_DIR"

    if ! command -v openssl >/dev/null 2>&1; then
        echo "Error: openssl is required to bootstrap the instance identity" >&2
        exit 1
    fi

    mkdir -p "$dir"
    chmod 700 "$dir"

    if [ -f "$dir/instance.key" ] && [ "$FORCE_IDENTITY" != "1" ]; then
        echo "Instance identity already present at $dir, keeping the existing keys"
    else
        local instance_id
        instance_id="$(generate_instance_id)"

        openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
            -out "$dir/instance.key" >/dev/null 2>&1 || {
            echo "Error: failed to generate the instance key" >&2
            exit 1
        }
        chmod 600 "$dir/instance.key"

        openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 \
            -out "$dir/ca.key" >/dev/null 2>&1 || {
            echo "Error: failed to generate the local CA key" >&2
            exit 1
        }
        chmod 600 "$dir/ca.key"

        openssl req -x509 -new -key "$dir/ca.key" -sha256 -days "$CA_VALIDITY_DAYS" \
            -subj "/O=Notploy/CN=Notploy Local Instance Root CA" \
            -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
            -addext "keyUsage=critical,keyCertSign,cRLSign" \
            -out "$dir/ca.crt" >/dev/null 2>&1 || {
            echo "Error: failed to create the local CA certificate" >&2
            exit 1
        }
        chmod 644 "$dir/ca.crt"

        openssl req -new -key "$dir/instance.key" \
            -subj "/O=Notploy/CN=notploy-instance-$instance_id" \
            -out "$dir/instance.csr" >/dev/null 2>&1

        local extfile
        extfile="$(mktemp)"
        cat > "$extfile" <<EXT
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth,serverAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EXT

        openssl x509 -req -in "$dir/instance.csr" \
            -CA "$dir/ca.crt" -CAkey "$dir/ca.key" -CAcreateserial \
            -days "$INSTANCE_VALIDITY_DAYS" -sha256 \
            -extfile "$extfile" \
            -out "$dir/instance.crt" >/dev/null 2>&1 || {
            echo "Error: failed to sign the instance certificate" >&2
            rm -f "$extfile"
            exit 1
        }
        chmod 644 "$dir/instance.crt"
        rm -f "$dir/instance.csr" "$dir/ca.srl" "$extfile"

        local created_at
        created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        local key_fingerprint
        key_fingerprint="$(openssl pkey -in "$dir/instance.key" -pubout -outform DER 2>/dev/null \
            | openssl dgst -sha256 | sed 's/^.*= //')"

        cat > "$dir/identity.json" <<JSON
{
  "version": 1,
  "instanceId": "$instance_id",
  "product": "$NOTPLOY_PRODUCT",
  "capabilities": $(capabilities_for_product "$NOTPLOY_PRODUCT"),
  "subjectKeyFingerprint": "$key_fingerprint",
  "createdAt": "$created_at"
}
JSON
        chmod 644 "$dir/identity.json"
        echo "Instance identity created for product '$NOTPLOY_PRODUCT' at $dir"
    fi
}

# Persists and verifies the signed entitlement required by protected products.
bootstrap_entitlement() {
    local token="${NOTPLOY_ENTITLEMENT:-}"

    if [ -z "$token" ] && [ -n "${NOTPLOY_ENTITLEMENT_FILE:-}" ]; then
        token="$(cat "$NOTPLOY_ENTITLEMENT_FILE" 2>/dev/null)"
    fi

    if [ -z "$token" ]; then
        echo "Error: product '$NOTPLOY_PRODUCT' requires a signed entitlement." >&2
        echo "Provide NOTPLOY_ENTITLEMENT (token) or NOTPLOY_ENTITLEMENT_FILE." >&2
        exit 1
    fi

    if ! verify_entitlement_token "$token"; then
        echo "Error: refusing to install a protected product without a valid entitlement." >&2
        exit 1
    fi

    printf '%s\n' "$token" > "$INSTANCE_IDENTITY_DIR/entitlement.token"
    chmod 600 "$INSTANCE_IDENTITY_DIR/entitlement.token"
    echo "Entitlement verified for product '$NOTPLOY_PRODUCT'"
}

bootstrap_identity() {
    bootstrap_instance_identity
    if [ "$NOTPLOY_PRODUCT" != "self" ]; then
        bootstrap_entitlement
    fi
}

# ---------------------------------------------------------------------------
# Dokploy detection and read-only migration assessment
#
# Everything in this section is strictly read-only: it inspects Docker state,
# known Dokploy paths and exposed ports, but never creates, updates or removes
# anything. An existing Dokploy host must never be treated as a fresh host by
# accident, so detection runs before any destructive installation step.
#
# The result mirrors the DetectedInstallation model from the migration design:
#   detected, product, version, installationType, confidence, plus evidence.
# ---------------------------------------------------------------------------
DOKPLOY_DETECTED=0
DOKPLOY_VERSION="unknown"
DOKPLOY_INSTALLATION_TYPE="unknown"
DOKPLOY_CONFIDENCE="low"
DOKPLOY_EVIDENCE=""

DOKPLOY_PROJECT_COUNT=0
DOKPLOY_APPLICATION_COUNT=0
DOKPLOY_SERVICE_COUNT=0
DOKPLOY_SERVER_COUNT=0
DOKPLOY_DOMAIN_COUNT=0
DOKPLOY_REGISTRY_COUNT=0
DOKPLOY_GIT_PROVIDER_COUNT=0
DOKPLOY_VOLUME_COUNT=0
DOKPLOY_NETWORK_COUNT=0

# Human-readable installation type, matching the installer's preflight wording.
installation_type_label() {
    case "$1" in
        swarm) echo "Docker/Swarm" ;;
        compose) echo "Docker Compose" ;;
        docker) echo "Docker" ;;
        *) echo "Unknown" ;;
    esac
}

dokploy_evidence_add() {
    [ -n "$1" ] || return 0
    if [ -n "$DOKPLOY_EVIDENCE" ]; then
        DOKPLOY_EVIDENCE="$DOKPLOY_EVIDENCE; $1"
    else
        DOKPLOY_EVIDENCE="$1"
    fi
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n\r'
}

# `id|name|image|labels` for every Docker container that looks like Dokploy.
# Notploy's own containers are explicitly excluded to avoid self-detection.
dokploy_containers() {
    command -v docker >/dev/null 2>&1 || return 0
    docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Labels}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy'
}

# `name|image` for Dokploy Swarm services, if a Swarm is active.
dokploy_services() {
    command -v docker >/dev/null 2>&1 || return 0
    docker service ls --format '{{.Name}}|{{.Image}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy'
}

detect_dokploy_version() {
    local version image

    version="$(dokploy_containers | awk -F'|' '{print $3}' \
        | grep -oE ':[vV]?[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9]+)*' \
        | head -n1 | sed 's/^://')"

    if [ -z "$version" ]; then
        version="$(grep -rhoE 'dokploy/dokploy:[^"[:space:]]+' \
            /etc/dokploy 2>/dev/null | head -n1 | sed 's#.*:##')"
    fi

    if [ -z "$version" ]; then
        image="$(dokploy_containers | awk -F'|' '{print $3}' | head -n1)"
        if [ -n "$image" ] && command -v docker >/dev/null 2>&1; then
            version="$(docker image inspect "$image" \
                --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' \
                2>/dev/null)"
        fi
    fi

    case "$version" in
        '<no value>'|'') version="" ;;
    esac
    printf '%s' "$version"
}

detect_dokploy_installation_type() {
    local swarm_state
    swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"

    if [ "$swarm_state" = "active" ] && [ -n "$(dokploy_services)" ]; then
        echo "swarm"
        return 0
    fi
    if dokploy_containers | awk -F'|' '{print $4}' \
        | grep -qi 'com\.docker\.compose\.project'; then
        echo "compose"
        return 0
    fi
    if [ -n "$(dokploy_containers)" ]; then
        echo "docker"
        return 0
    fi
    echo "unknown"
}

# Read-only detector. Populates the DOKPLOY_* globals and never mutates state.
detect_dokploy() {
    DOKPLOY_DETECTED=0
    DOKPLOY_VERSION="unknown"
    DOKPLOY_INSTALLATION_TYPE="unknown"
    DOKPLOY_CONFIDENCE="low"
    DOKPLOY_EVIDENCE=""

    local containers services networks volumes path count

    containers="$(dokploy_containers)"
    services="$(dokploy_services)"

    if [ -n "$containers" ] || [ -n "$services" ]; then
        DOKPLOY_DETECTED=1
        DOKPLOY_CONFIDENCE="high"
        if [ -n "$containers" ]; then
            count="$(printf '%s\n' "$containers" | grep -c .)"
            dokploy_evidence_add "$count Dokploy container(s)"
        fi
        if [ -n "$services" ]; then
            count="$(printf '%s\n' "$services" | grep -c .)"
            dokploy_evidence_add "$count Dokploy Swarm service(s)"
        fi
    fi

    networks="$(docker network ls --format '{{.Name}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy' | head -n1)"
    [ -n "$networks" ] && dokploy_evidence_add "Docker network '$networks'"

    volumes="$(docker volume ls --format '{{.Name}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy' | head -n1)"
    [ -n "$volumes" ] && dokploy_evidence_add "Docker volume '$volumes'"

    for path in /etc/dokploy /etc/dokploy/traefik/dynamic \
        "$HOME/.dokploy" /root/.dokploy /var/lib/dokploy; do
        [ -e "$path" ] && dokploy_evidence_add "installation path '$path'"
    done

    # Containers/services are decisive. Paths, networks and volumes are weak
    # signals: they only raise a medium-confidence flag that forces the
    # installer to ask before touching the host.
    if [ "$DOKPLOY_DETECTED" != "1" ] && [ -n "$DOKPLOY_EVIDENCE" ]; then
        DOKPLOY_DETECTED=1
        DOKPLOY_CONFIDENCE="medium"
    fi

    if [ "$DOKPLOY_DETECTED" = "1" ]; then
        DOKPLOY_INSTALLATION_TYPE="$(detect_dokploy_installation_type)"
        DOKPLOY_VERSION="$(detect_dokploy_version)"
        [ -n "$DOKPLOY_VERSION" ] || DOKPLOY_VERSION="unknown"
    fi
}

# Extracts Host() rules from Traefik labels, one hostname per line.
dokploy_collect_domains() {
    command -v docker >/dev/null 2>&1 || return 0
    docker ps -a --format '{{.Labels}}' 2>/dev/null \
        | tr ',' '\n' \
        | grep -oE 'Host\([`"][^`"]+[`"]\)' \
        | sed -E 's/^Host\([`"]//; s/[`"]\)$//' \
        | grep -vi 'notploy' \
        | sort -u
}

# Read-only inventory of the observable Dokploy surface. Secrets, git provider
# credentials and registry credentials are intentionally NOT collected here:
# they are handled by the Notploy migration engine and never printed.
dokploy_inventory() {
    DOKPLOY_PROJECT_COUNT=0
    DOKPLOY_APPLICATION_COUNT=0
    DOKPLOY_SERVICE_COUNT=0
    DOKPLOY_SERVER_COUNT=0
    DOKPLOY_DOMAIN_COUNT=0
    DOKPLOY_REGISTRY_COUNT=0
    DOKPLOY_GIT_PROVIDER_COUNT=0
    DOKPLOY_VOLUME_COUNT=0
    DOKPLOY_NETWORK_COUNT=0

    command -v docker >/dev/null 2>&1 || return 0

    DOKPLOY_APPLICATION_COUNT="$(docker ps --format '{{.Names}}' 2>/dev/null \
        | grep -vi 'dokploy' | grep -vi 'notploy' | grep -vi 'traefik' | grep -c .)"
    DOKPLOY_SERVICE_COUNT="$(docker service ls --format '{{.Name}}' 2>/dev/null \
        | grep -vi 'dokploy' | grep -vi 'notploy' | grep -vi 'traefik' | grep -c .)"
    DOKPLOY_PROJECT_COUNT="$(docker ps -a --format '{{.Labels}}' 2>/dev/null \
        | tr ',' '\n' | grep -oE 'com\.docker\.compose\.project=[^,]+' \
        | cut -d= -f2 | grep -vi 'dokploy' | grep -vi 'notploy' \
        | sort -u | grep -c .)"
    DOKPLOY_SERVER_COUNT="$(docker node ls --format '{{.ID}}' 2>/dev/null | grep -c .)"
    DOKPLOY_DOMAIN_COUNT="$(dokploy_collect_domains | grep -c .)"
    DOKPLOY_REGISTRY_COUNT="$(docker ps -a --format '{{.Names}}|{{.Image}}' 2>/dev/null \
        | grep -iE 'registry|harbor|nexus|artifactory' \
        | grep -vi 'dokploy' | grep -vi 'notploy' | grep -c .)"
    DOKPLOY_GIT_PROVIDER_COUNT=0
    DOKPLOY_VOLUME_COUNT="$(docker volume ls --format '{{.Name}}' 2>/dev/null \
        | grep -vi 'notploy' | grep -c .)"
    DOKPLOY_NETWORK_COUNT="$(docker network ls --format '{{.Name}}' 2>/dev/null \
        | grep -vE '^(bridge|host|none|ingress|docker_gwbridge)$' \
        | grep -vi 'notploy' | grep -c .)"
}

dokploy_json() {
    if [ "$DOKPLOY_DETECTED" != "1" ]; then
        cat <<'JSON'
{
  "detected": false,
  "product": "unknown",
  "installationType": "unknown",
  "confidence": "high",
  "inventory": {
    "projects": 0,
    "applications": 0,
    "services": 0,
    "servers": 0,
    "domains": 0,
    "registries": 0,
    "gitProviders": 0,
    "volumes": 0,
    "networks": 0
  }
}
JSON
        return 0
    fi

    cat <<JSON
{
  "detected": true,
  "product": "dokploy",
  "version": "$(json_escape "$DOKPLOY_VERSION")",
  "installationType": "$(json_escape "$DOKPLOY_INSTALLATION_TYPE")",
  "confidence": "$(json_escape "$DOKPLOY_CONFIDENCE")",
  "evidence": "$(json_escape "$DOKPLOY_EVIDENCE")",
  "inventory": {
    "projects": $DOKPLOY_PROJECT_COUNT,
    "applications": $DOKPLOY_APPLICATION_COUNT,
    "services": $DOKPLOY_SERVICE_COUNT,
    "servers": $DOKPLOY_SERVER_COUNT,
    "domains": $DOKPLOY_DOMAIN_COUNT,
    "registries": $DOKPLOY_REGISTRY_COUNT,
    "gitProviders": $DOKPLOY_GIT_PROVIDER_COUNT,
    "volumes": $DOKPLOY_VOLUME_COUNT,
    "networks": $DOKPLOY_NETWORK_COUNT
  }
}
JSON
}

show_dokploy_detected() {
    echo "Checking existing installations..."
    echo "⚠ Dokploy installation detected"
    echo ""
    echo "Dokploy version: ${DOKPLOY_VERSION:-unknown}"
    echo "Installation: $(installation_type_label "$DOKPLOY_INSTALLATION_TYPE")"
    echo "Detection confidence: ${DOKPLOY_CONFIDENCE}"
    [ -n "$DOKPLOY_EVIDENCE" ] && echo "Evidence: $DOKPLOY_EVIDENCE"
    echo ""
    echo "Notploy can analyze this installation and prepare"
    echo "a migration without modifying Dokploy."
    echo ""
}

print_dokploy_report() {
    echo ""
    echo "Dokploy migration analysis"
    echo ""
    printf '%-18s %s\n' "Projects" "$DOKPLOY_PROJECT_COUNT"
    printf '%-18s %s\n' "Applications" "$DOKPLOY_APPLICATION_COUNT"
    printf '%-18s %s\n' "Services" "$DOKPLOY_SERVICE_COUNT"
    printf '%-18s %s\n' "Servers" "$DOKPLOY_SERVER_COUNT"
    printf '%-18s %s\n' "Domains" "$DOKPLOY_DOMAIN_COUNT"
    printf '%-18s %s\n' "Registries" "$DOKPLOY_REGISTRY_COUNT"
    printf '%-18s %s\n' "Git providers" "$DOKPLOY_GIT_PROVIDER_COUNT"
    printf '%-18s %s\n' "Volumes" "$DOKPLOY_VOLUME_COUNT"
    echo ""
    echo "Compatibility"
    echo ""
    printf '✓ %s application(s) can be migrated automatically\n' \
        "$DOKPLOY_APPLICATION_COUNT"
    if [ "$DOKPLOY_DOMAIN_COUNT" -gt 0 ] 2>/dev/null; then
        printf '⚠ %s domain(s) require DNS verification\n' "$DOKPLOY_DOMAIN_COUNT"
    fi
    if [ "$DOKPLOY_REGISTRY_COUNT" -gt 0 ] 2>/dev/null; then
        printf '⚠ %s registry(ies) require credentials\n' "$DOKPLOY_REGISTRY_COUNT"
    fi
    echo "⚠ Git providers, secrets and schedules require a Dokploy session"
    echo "✗ Historical deployments are summarized, not imported"
    echo ""
    echo "No changes have been made to Dokploy."
}

# Persists the read-only assessment under the Notploy config directory. This
# never touches the Dokploy installation itself.
write_migration_report() {
    local dir file
    dir="${NOTPLOY_CONFIG_PATH:-/etc/notploy}/migration"
    if mkdir -p "$dir" 2>/dev/null; then
        file="$dir/dokploy-$(date -u +%Y%m%dT%H%M%SZ).json"
        if dokploy_json > "$file" 2>/dev/null; then
            chmod 600 "$file" 2>/dev/null || true
            echo "Assessment report: $file"
        fi
    fi
}

# Prompts the user when a source installation is detected. Returns:
#   0 -> run the read-only migration assessment
#   1 -> decline; leave the source installation untouched
#   2 -> no interactive answer available; the caller must refuse to continue
resolve_migration_choice() {
    if [ "$MIGRATION_REQUESTED" = "1" ]; then
        return 0
    fi
    if [ "$MIGRATION_REQUESTED" = "-1" ]; then
        return 1
    fi
    if [ "$ASSUME_YES" = "1" ]; then
        return 0
    fi

    # `curl | sh` leaves stdin at EOF, so prefer the controlling terminal. This
    # also avoids consuming the rest of a piped script with `read`.
    local answer=""
    if [ -r /dev/tty ] && [ -w /dev/tty ]; then
        printf "Continue with migration analysis? [y/N] "
        read -r answer < /dev/tty || answer=""
    elif [ -t 0 ]; then
        printf "Continue with migration analysis? [y/N] "
        read -r answer || answer=""
    else
        return 2
    fi

    case "$answer" in
        y|Y|yes|YES) return 0 ;;
        *) return 1 ;;
    esac
}

# Prints the read-only system preflight shown before detection. Never exits:
# a missing Docker install is handled later by the fresh-install path.
check_system_preflight() {
    echo "Checking system..."

    if [ "$(uname -s)" = "Linux" ]; then
        echo "✓ Linux"
    else
        echo "✗ Linux"
    fi

    if command -v docker >/dev/null 2>&1; then
        echo "✓ Docker"
    else
        echo "✗ Docker (will be installed)"
    fi

    local mem_kb disk_kb
    mem_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null)"
    disk_kb="$(df -Pk / 2>/dev/null | awk 'NR==2 {print $4}')"
    if [ -n "$mem_kb" ] && [ "$mem_kb" -ge 1048576 ] 2>/dev/null; then
        if [ -n "$disk_kb" ] && [ "$disk_kb" -ge 2097152 ] 2>/dev/null; then
            echo "✓ Required resources"
        else
            echo "⚠ Required resources (low disk space)"
        fi
    else
        echo "⚠ Required resources (low memory, 1GB+ recommended)"
    fi
    echo ""
}

run_migration_assessment() {
    dokploy_inventory
    print_dokploy_report
    echo ""
    write_migration_report
    echo ""
    echo "Read-only assessment complete. Nothing has been migrated yet."
    echo "The Notploy migration engine will use this inventory to build a"
    echo "reviewable plan before any production-impacting operation."
}

# Detect version from environment variable or default to latest
detect_version() {
    local version="${NOTPLOY_VERSION}"
    
    if [ -z "$version" ]; then
        echo "Detecting latest stable version from GitHub..." >&2
        
        version=$(curl -fsSL --connect-timeout 10 -o /dev/null -w '%{url_effective}\n' \
            https://github.com/skygenesisenterprise/notploy/releases/latest 2>/dev/null | \
            sed 's#.*/tag/##')

        case "$version" in
            v[0-9]*) ;;
            *) version="" ;;
        esac

        if [ -z "$version" ]; then
            echo "Warning: Could not detect latest version from GitHub, using fallback version latest" >&2
            version="latest"
        else
            echo "Latest stable version detected: $version" >&2
        fi
    fi
    
    echo "$version"
}

# Maps a release tag to the matching Notploy image reference. Kept POSIX-safe so
# `curl ... | sh` works even where /bin/sh is dash.
resolve_docker_image() {
    case "$1" in
        v[0-9]*.[0-9]*.[0-9]*-app)
            printf 'ghcr.io/skygenesisenterprise/notploy:%s' "$1"
            ;;
        v[0-9]*.[0-9]*.[0-9]*)
            printf 'ghcr.io/skygenesisenterprise/notploy:%s-app' "$1"
            ;;
        latest)
            printf 'ghcr.io/skygenesisenterprise/notploy:latest'
            ;;
        *)
            printf 'ghcr.io/skygenesisenterprise/notploy:%s' "$1"
            ;;
    esac
}

# Function to detect if running in Proxmox LXC container
is_proxmox_lxc() {
    if [ -n "$container" ] && [ "$container" = "lxc" ]; then
        return 0
    fi
    
    if grep -q "container=lxc" /proc/1/environ 2>/dev/null; then
        return 0
    fi
    
    return 1
}

# Fails closed if a port required by Notploy is already taken. This is only
# enforced on the fresh-install path: during migration the ports belong to
# Dokploy and must not be claimed.
assert_required_ports() {
    command -v ss >/dev/null 2>&1 || return 0

    if ss -tulnp 2>/dev/null | grep ':80 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 80" >&2
        exit 1
    fi

    if ss -tulnp 2>/dev/null | grep ':443 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 443" >&2
        exit 1
    fi

    if ss -tulnp 2>/dev/null | grep ':3000 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 3000" >&2
        echo "Notploy requires port 3000 to be available. Please stop any service using this port." >&2
        exit 1
    fi
}

generate_random_password() {
    local password=""
    
    if command -v openssl >/dev/null 2>&1; then
        password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    elif [ -r /dev/urandom ]; then
        password=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
    else
        if command -v sha256sum >/dev/null 2>&1; then
            password=$(date +%s%N | sha256sum | base64 | head -c 32)
        elif command -v shasum >/dev/null 2>&1; then
            password=$(date +%s%N | shasum -a 256 | base64 | head -c 32)
        else
            password=$(echo "$(date +%s%N)-$(hostname)-$$-$RANDOM" | base64 | tr -d "=+/" | head -c 32)
        fi
    fi
    
    if [ -z "$password" ] || [ ${#password} -lt 20 ]; then
        echo "Error: Failed to generate random password" >&2
        exit 1
    fi
    
    echo "$password"
}

install_notploy() {
    if [ "$(uname)" = "Darwin" ]; then
        echo "This script must be run on Linux" >&2
        exit 1
    fi

    if [ -f /.dockerenv ]; then
        echo "This script must be run on Linux" >&2
        exit 1
    fi

    if [ "$OUTPUT_JSON" != "1" ]; then
        check_system_preflight
    fi

    # -----------------------------------------------------------------------
    # Read-only preflight: detect a supported existing installation before any
    # destructive or state-changing operation. A host running Dokploy must never
    # be treated as a fresh host by accident. This runs before the root check
    # because detection and the migration assessment are strictly read-only.
    # -----------------------------------------------------------------------
    if command -v docker >/dev/null 2>&1; then
        detect_dokploy
    else
        DOKPLOY_DETECTED=0
    fi

    if [ "$OUTPUT_JSON" = "1" ]; then
        if [ "$DOKPLOY_DETECTED" = "1" ]; then
            dokploy_inventory
        fi
        dokploy_json
        exit 0
    fi

    if [ "$DOKPLOY_DETECTED" = "1" ]; then
        if [ "$DRY_RUN" = "1" ]; then
            run_migration_assessment
            exit 0
        fi
        show_dokploy_detected

        if [ "$MIGRATION_REQUESTED" = "-1" ]; then
            echo "Fresh installation explicitly requested (--fresh)."
            echo "Dokploy will not be modified by this installer."
            echo ""
        else
            resolve_migration_choice
            migration_choice=$?
            case "$migration_choice" in
                0)
                    run_migration_assessment
                    exit 0
                    ;;
                1)
                    # Declining must leave the source installation untouched.
                    echo "Migration declined. No changes have been made to Dokploy."
                    echo "To install Notploy anyway, re-run with --fresh."
                    exit 0
                    ;;
                *)
                    cat >&2 <<'EOF'
No interactive input is available to confirm the migration choice.

An existing Dokploy installation was detected, so Notploy refuses to
continue silently and will not modify the host. Re-run with one of:

  curl -fsSL https://notploy.com/install.sh | sh -s -- --migrate
      Read-only migration assessment (recommended).

  curl -fsSL https://notploy.com/install.sh | sh -s -- --fresh
      Explicit fresh installation (subject to the normal safety checks).
EOF
                    exit 1
                    ;;
            esac
        fi
    else
        echo "No supported existing installation detected."
    fi

    if [ "$MIGRATION_REQUESTED" = "1" ]; then
        echo "Error: --migrate was requested but no Dokploy installation was detected." >&2
        exit 1
    fi

    if [ "$DRY_RUN" = "1" ]; then
        echo "Dry-run: preflight complete, no changes were made."
        exit 0
    fi

    # From here on the installer mutates the host and therefore requires root.
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root to install Notploy." >&2
        exit 1
    fi

    assert_required_ports

    VERSION_TAG=$(detect_version)
    # For self-hosted app image, the tag is typically vX.Y.Z-app; resolve_docker_image
    # maps the release tag to the image published by docker-publish.yml.
    DOCKER_IMAGE="$(resolve_docker_image "$VERSION_TAG")"

    echo "Installing Notploy version: ${VERSION_TAG}"

    command_exists() {
      command -v "$@" > /dev/null 2>&1
    }

    if command_exists docker; then
      echo "Docker already installed"
    else
      curl -sSL https://get.docker.com | sh -s -- --version $DOCKER_VERSION
      if command_exists apt-mark; then
        apt-mark hold docker-ce docker-ce-cli docker-ce-rootless-extras 2>/dev/null || true
      fi
    fi

    endpoint_mode=""
    if [ "$ENDPOINT_MODE" = "dnsrr" ]; then
        echo "ENDPOINT_MODE=dnsrr set"
        endpoint_mode="--endpoint-mode dnsrr"
    elif is_proxmox_lxc; then
        echo "⚠️ WARNING: Detected Proxmox LXC container environment!"
        endpoint_mode="--endpoint-mode dnsrr"
        echo "Waiting for 5 seconds before continuing..."
        sleep 5
    fi

    # Never tear down a detected source Swarm implicitly. The first migration
    # milestone is read-only, so a fresh install on top of a Dokploy Swarm
    # requires an explicit, deliberate override.
    if [ "$DOKPLOY_DETECTED" = "1" ] \
        && [ "$DOKPLOY_INSTALLATION_TYPE" = "swarm" ] \
        && [ "${NOTPLOY_ALLOW_DESTRUCTIVE:-0}" != "1" ]; then
        echo "Error: refusing to leave the existing Docker Swarm cluster that hosts Dokploy." >&2
        echo "Run the read-only migration assessment (--migrate) instead, or set" >&2
        echo "NOTPLOY_ALLOW_DESTRUCTIVE=1 if you really intend to destroy the source." >&2
        exit 1
    fi

    docker swarm leave --force 2>/dev/null || true

    get_ip() {
        local ip=""
        ip=$(curl -4s --connect-timeout 5 https://ifconfig.io 2>/dev/null)
        if [ -z "$ip" ]; then
            ip=$(curl -4s --connect-timeout 5 https://icanhazip.com 2>/dev/null)
        fi
        if [ -z "$ip" ]; then
            ip=$(curl -4s --connect-timeout 5 https://ipecho.net/plain 2>/dev/null)
        fi
        if [ -z "$ip" ]; then
            ip=$(curl -6s --connect-timeout 5 https://ifconfig.io 2>/dev/null)
        fi
        if [ -z "$ip" ]; then
            ip=$(curl -6s --connect-timeout 5 https://icanhazip.com 2>/dev/null)
        fi
        if [ -z "$ip" ]; then
            ip=$(curl -6s --connect-timeout 5 https://ipecho.net/plain 2>/dev/null)
        fi
        echo "$ip"
    }

    get_private_ip() {
        ip -o -4 addr show scope global 2>/dev/null \
            | awk '$2 !~ /^(docker|br-|veth)/ {print $4}' \
            | cut -d/ -f1 \
            | grep -E "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)" \
            | head -n1
    }

    advertise_addr="${ADVERTISE_ADDR:-$(get_private_ip)}"

    if [ -z "$advertise_addr" ]; then
        advertise_addr=$(get_ip)
    fi

    if [ -z "$advertise_addr" ]; then
        echo "ERROR: We couldn't detect your server IP address."
        echo "Please set the ADVERTISE_ADDR environment variable manually."
        exit 1
    fi
    echo "Using advertise address: $advertise_addr"

    swarm_init_args="${DOCKER_SWARM_INIT_ARGS:-}"
    
    if [ -n "$swarm_init_args" ]; then
        echo "Using custom swarm init arguments: $swarm_init_args"
        docker swarm init --advertise-addr $advertise_addr $swarm_init_args
    else
        docker swarm init --advertise-addr $advertise_addr
    fi
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to initialize Docker Swarm" >&2
        exit 1
    fi

    echo "Swarm initialized"

    docker network rm -f notploy-network 2>/dev/null || true
    docker network create --driver overlay --attachable notploy-network

    echo "Network created"

    mkdir -p /etc/notploy
    chmod 777 /etc/notploy

    # Generate (self) or verify (cloud/console) the instance identity before the
    # application starts, so it never boots without a trust anchor.
    bootstrap_identity

    POSTGRES_PASSWORD=$(generate_random_password)
    echo "$POSTGRES_PASSWORD" | docker secret create notploy_postgres_password - 2>/dev/null || true

    AUTH_SECRET=$(openssl rand -hex 32)
    echo "$AUTH_SECRET" | docker secret create notploy_auth_secret - 2>/dev/null || true

    echo "Generated secure database credentials and auth secret (stored in Docker Secrets)"

    docker service create \
    --name notploy-postgres \
    --constraint 'node.role==manager' \
    --network notploy-network \
    --env POSTGRES_USER=notploy \
    --env POSTGRES_DB=notploy \
    --secret source=notploy_postgres_password,target=/run/secrets/postgres_password \
    --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
    --mount type=volume,source=notploy-postgres,target=/var/lib/postgresql/data \
    $endpoint_mode \
    postgres:16

    product_env=""
    if [ "$NOTPLOY_PRODUCT" != "self" ]; then
        product_env="-e NOTPLOY_FLAVOR=$NOTPLOY_PRODUCT -e IS_CLOUD=true -e NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE=/etc/notploy/identity/entitlement-ca.pub"
    fi

    release_tag_env=""
    case "$VERSION_TAG" in
        v[0-9]*.[0-9]*.[0-9]*)
            release_tag_env="-e RELEASE_TAG=$VERSION_TAG"
            ;;
        v[0-9]*.[0-9]*.[0-9]*-app)
            release_tag_env="-e RELEASE_TAG=$VERSION_TAG"
            ;;
        latest)
            release_tag_env="-e RELEASE_TAG=latest"
            ;;
        *)
            release_tag_env="-e RELEASE_TAG=$VERSION_TAG"
            ;;
    esac
    
    docker service create \
      --name notploy \
      --replicas 1 \
      --network notploy-network \
      --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
      --mount type=bind,source=/etc/notploy,target=/etc/notploy \
      --mount type=volume,source=notploy,target=/root/.docker \
      --secret source=notploy_postgres_password,target=/run/secrets/postgres_password \
      --secret source=notploy_auth_secret,target=/run/secrets/notploy_auth_secret \
      --publish published=3000,target=3000,mode=host \
      --update-parallelism 1 \
      --update-order stop-first \
      --constraint 'node.role == manager' \
      $endpoint_mode \
      $release_tag_env \
      $product_env \
      -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
      -e BETTER_AUTH_SECRET_FILE=/run/secrets/notploy_auth_secret \
      $DOCKER_IMAGE

    sleep 4

    docker run -d \
        --name notploy-traefik \
        --restart always \
        --network notploy-network \
        -v /etc/notploy/traefik/traefik.yml:/etc/traefik/traefik.yml \
        -v /etc/notploy/traefik/dynamic:/etc/notploy/traefik/dynamic \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -p 80:80/tcp \
        -p 443:443/tcp \
        -p 443:443/udp \
        traefik:v3.6.25 2>/dev/null || docker run -d \
        --name notploy-traefik \
        --restart always \
        --network notploy-network \
        -v /etc/notploy/traefik/traefik.yml:/etc/traefik/traefik.yml \
        -v /etc/notploy/traefik/dynamic:/etc/notploy/traefik/dynamic \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -p 80:80/tcp \
        -p 443:443/tcp \
        -p 443:443/udp \
        traefik:v3.5

    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    BLUE="\033[0;34m"
    NC="\033[0m"

    format_ip_for_url() {
        local ip="$1"
        if echo "$ip" | grep -q ':'; then
            echo "[${ip}]"
        else
            echo "${ip}"
        fi
    }

    public_ip="${ADVERTISE_ADDR:-$(get_ip)}"
    private_ip=$(get_private_ip)
    formatted_addr=$(format_ip_for_url "$public_ip")
    echo ""
    printf "${GREEN}Congratulations, Notploy is installed!${NC}\n"
    printf "${BLUE}Wait 15 seconds for the server to start${NC}\n"
    printf "${YELLOW}Please go to http://${formatted_addr}:3000${NC}\n"
    if [ -n "$private_ip" ] && [ "$private_ip" != "$public_ip" ]; then
        printf "${YELLOW}If you are on the same local network, use http://${private_ip}:3000${NC}\n"
    fi
    printf "\n"
}

update_notploy() {
    VERSION_TAG=$(detect_version)
    DOCKER_IMAGE="$(resolve_docker_image "$VERSION_TAG")"

    echo "Updating Notploy to version: ${VERSION_TAG}"
    docker pull $DOCKER_IMAGE
    docker service update --image $DOCKER_IMAGE notploy
    echo "Notploy has been updated to version: ${VERSION_TAG}"
}

# When sourced (NOTPLOY_SOURCE_ONLY=1) only the definitions above are used.
if [ "${NOTPLOY_SOURCE_ONLY:-0}" != "1" ]; then
    if [ "$ACTION" = "update" ]; then
        update_notploy
    else
        install_notploy
    fi
fi
