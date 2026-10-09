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
#   ""   -> migrate automatically when a supported Dokploy installation is detected
#   "1"  -> explicitly force the migration (--migrate)
#   "-1" -> force a fresh installation, never touching Dokploy (--fresh)
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
  --migrate                  Perform the Dokploy → Notploy migration (the default
                             whenever Dokploy is detected).
  --fresh                    Force a fresh installation even if Dokploy is present;
                             Dokploy is never modified.
  --dry-run                  Never install; only run the read-only preflight and
                             the Dokploy assessment.
  -y, --yes                  Assume yes for migration prompts (non-interactive).
  --json                     Emit the detection result as JSON and exit.

Environment:
  NOTPLOY_MIGRATION          Same as --migrate (1) or --fresh (0).
  NOTPLOY_CONFIG_MODE        Permissions for the config dir (default 700; 750 when
                             NOTPLOY_CONFIG_GROUP is set).
  NOTPLOY_CONFIG_GROUP       Group granted access to the config dir (optional).
  NOTPLOY_DOKPLOY_AUTH_SECRET  Dokploy's BETTER_AUTH_SECRET, to supply it explicitly
                             when it cannot be read from the running container.

Safety:
  An active Docker Swarm that this installer did not create is never left or
  modified. Run `docker swarm leave` manually first if you really intend to
  replace it.
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

NOTPLOY_CONFIG_DIR="${NOTPLOY_CONFIG_PATH:-/etc/notploy}"
INSTANCE_IDENTITY_DIR="$NOTPLOY_CONFIG_DIR/identity"
INSTANCE_VALIDITY_DAYS="${NOTPLOY_INSTANCE_VALIDITY_DAYS:-825}"
CA_VALIDITY_DAYS="${NOTPLOY_CA_VALIDITY_DAYS:-3650}"

# Permission model. The config directory holds the instance private keys, so it
# is private by default (0700 root-owned). Set NOTPLOY_CONFIG_GROUP to grant a
# single trusted group access (0750) when a non-root service must read it; the
# mode is never widened beyond that and never world-readable.
NOTPLOY_CONFIG_GROUP="${NOTPLOY_CONFIG_GROUP:-}"
if [ -n "${NOTPLOY_CONFIG_MODE:-}" ]; then
    CONFIG_DIR_MODE="$NOTPLOY_CONFIG_MODE"
elif [ -n "$NOTPLOY_CONFIG_GROUP" ]; then
    CONFIG_DIR_MODE="750"
else
    CONFIG_DIR_MODE="700"
fi

# Reports are not secrets, but they describe the host: keep them private too.
CONFIG_FILE_MODE="600"

# ---------------------------------------------------------------------------
# Privilege elevation (rootless + sudo)
#
# Mirrors the server setup script: the installer can run as a non-root user that
# has passwordless sudo. `SUDO_CMD` is empty when already root and `sudo`
# otherwise, and every privileged operation (Docker, writes under /etc, service
# management) is prefixed with it. When neither root nor a passwordless sudoer
# is available, read-only detection still runs, but mutating actions fail
# closed through require_elevation.
# ---------------------------------------------------------------------------
CURRENT_USER=""
SUDO_CMD=""
ELEVATED=0

detect_elevation() {
    CURRENT_USER="$(id -un 2>/dev/null || echo "${USER:-unknown}")"
    if [ "$(id -u)" = "0" ]; then
        SUDO_CMD=""
        ELEVATED=1
        [ "$OUTPUT_JSON" = "1" ] || echo "Running as root"
    elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
        SUDO_CMD="sudo"
        ELEVATED=1
        [ "$OUTPUT_JSON" = "1" ] || echo "Running as $CURRENT_USER with sudo privileges"
    else
        SUDO_CMD=""
        ELEVATED=0
        if [ "$OUTPUT_JSON" != "1" ]; then
            echo "Not running as root and passwordless sudo is unavailable." >&2
        fi
    fi
}

# Fails closed when a mutating action cannot obtain privileges.
require_elevation() {
    [ "$ELEVATED" = "1" ] && return 0
    echo "Error: root (or a non-root user with passwordless sudo) is required." >&2
    echo "Run this installer as root, or grant passwordless sudo first:" >&2
    echo "  echo '$CURRENT_USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/$CURRENT_USER" >&2
    echo "and re-run it." >&2
    exit 1
}

# Elevates a single command when running as a non-root sudoer.
sudo_run() {
    # shellcheck disable=SC2086
    $SUDO_CMD "$@"
}

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

    mkdir -p "$dir" || {
        echo "Error: cannot create the identity directory $dir" >&2
        exit 1
    }
    chmod 700 "$dir"

    if [ -f "$dir/instance.key" ] && [ "$FORCE_IDENTITY" != "1" ]; then
        if instance_identity_is_coherent; then
            echo "Instance identity already present and coherent at $dir, keeping it"
            return 0
        fi
        echo "Error: an instance identity exists at $dir but is incomplete or incoherent" >&2
        echo "(missing files, certificate not signed by the local CA, key/cert mismatch," >&2
        echo "or expired certificate). Refusing to overwrite it automatically: dependent" >&2
        echo "services may already trust it." >&2
        echo "Move it aside deliberately, or re-run with --force-identity to regenerate." >&2
        exit 1
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

# Development-only escape hatch: lets a protected product (cloud/console) run
# without a Notploy-signed entitlement on a local dev machine. It is never a
# production downgrade: the check is ignored whenever NODE_ENV=production, so a
# leaked environment variable cannot unlock a real host. Opt in explicitly with
# NOTPLOY_ALLOW_UNLICENSED_DEV=1; the dev Compose service sets it automatically.
allow_unlicensed_dev() {
    case "${NOTPLOY_ALLOW_UNLICENSED_DEV:-}" in
        1 | true | yes) ;;
        *) return 1 ;;
    esac
    [ "${NODE_ENV:-}" != "production" ] || return 1
    return 0
}

# Persists and verifies the signed entitlement required by protected products.
bootstrap_entitlement() {
    if allow_unlicensed_dev; then
        echo "Warning: running product '$NOTPLOY_PRODUCT' without a signed entitlement (development only)." >&2
        return 0
    fi

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
# Resources that are present on the host but whose Dokploy ownership could not
# be established. They are reported separately and never claimed as migratable.
DOKPLOY_UNATTRIBUTED_COUNT=0
# Attributed containers that are stopped: they cannot be reconstructed as-is.
DOKPLOY_STOPPED_COUNT=0

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
    $SUDO_CMD docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Labels}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy'
}

# `name|image` for Dokploy Swarm services, if a Swarm is active.
dokploy_services() {
    command -v docker >/dev/null 2>&1 || return 0
    $SUDO_CMD docker service ls --format '{{.Name}}|{{.Image}}' 2>/dev/null \
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
            version="$($SUDO_CMD docker image inspect "$image" \
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
    swarm_state="$($SUDO_CMD docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"

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

    networks="$($SUDO_CMD docker network ls --format '{{.Name}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy' | head -n1)"
    [ -n "$networks" ] && dokploy_evidence_add "Docker network '$networks'"

    volumes="$($SUDO_CMD docker volume ls --format '{{.Name}}' 2>/dev/null \
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

# Names of Docker networks that can be attributed to Dokploy (never Notploy's).
dokploy_networks() {
    command -v docker >/dev/null 2>&1 || return 0
    $SUDO_CMD docker network ls --format '{{.Name}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy'
}

# Returns 0 only when a container is *known* to belong to Dokploy. Provenance is
# accepted from Docker metadata alone: a Dokploy network attachment or an
# explicit `com.dokploy*` label. Arbitrary containers are never attributed, so
# they can never be advertised as automatically migratable.
container_is_dokploy_attributed() {
    local networks="$1" labels="$2"
    if printf '%s' "$networks" | tr ',' '\n' \
        | grep -i 'dokploy' | grep -qvi 'notploy'; then
        return 0
    fi
    if printf '%s' "$labels" | tr ',' '\n' | grep -qi 'com\.dokploy'; then
        return 0
    fi
    return 1
}

# Whether a container name belongs to Notploy's own infra and must be ignored.
is_notploy_infra_name() {
    case "$1" in
        notploy*|notploy-*) return 0 ;;
        *) return 1 ;;
    esac
}

# Extracts Host() rules from attributed Dokploy containers' Traefik labels.
dokploy_collect_domains() {
    command -v docker >/dev/null 2>&1 || return 0
    local name networks labels
    $SUDO_CMD docker ps -a --format '{{.Names}}|{{.Networks}}|{{.Labels}}' 2>/dev/null \
        | while IFS='|' read -r name networks labels; do
            is_notploy_infra_name "$name" && continue
            container_is_dokploy_attributed "$networks" "$labels" || continue
            printf '%s' "$labels" | tr ',' '\n'
        done \
        | grep -oE 'Host\([`"][^`"]+[`"]\)' \
        | sed -E 's/^Host\([`"]//; s/[`"]\)$//' \
        | sort -u
}

# Read-only inventory of the observable Dokploy surface.
#
# It deliberately separates what is *known* to belong to Dokploy from what
# merely runs on the host. Only attributed resources are presented as migration
# candidates. Secrets, git-provider credentials and registry credentials are
# never collected or printed here: they belong to the migration engine.
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
    DOKPLOY_UNATTRIBUTED_COUNT=0
    DOKPLOY_STOPPED_COUNT=0

    command -v docker >/dev/null 2>&1 || return 0

    local name image networks labels running stopped

    # Running containers: classified by provenance.
    while IFS='|' read -r name networks labels image; do
        [ -n "$name" ] || continue
        is_notploy_infra_name "$name" && continue
        case "$name" in
            *traefik*) continue ;;
        esac
        if container_is_dokploy_attributed "$networks" "$labels"; then
            DOKPLOY_APPLICATION_COUNT=$((DOKPLOY_APPLICATION_COUNT + 1))
        else
            DOKPLOY_UNATTRIBUTED_COUNT=$((DOKPLOY_UNATTRIBUTED_COUNT + 1))
        fi
    done <<EOF
$($SUDO_CMD docker ps --format '{{.Names}}|{{.Networks}}|{{.Labels}}|{{.Image}}' 2>/dev/null)
EOF

    # Stopped attributed containers cannot be reconstructed faithfully.
    while IFS='|' read -r name networks labels image; do
        [ -n "$name" ] || continue
        is_notploy_infra_name "$name" && continue
        case "$name" in
            *traefik*) continue ;;
        esac
        container_is_dokploy_attributed "$networks" "$labels" \
            && DOKPLOY_STOPPED_COUNT=$((DOKPLOY_STOPPED_COUNT + 1))
    done <<EOF
$($SUDO_CMD docker ps -a --filter status=exited --filter status=created --format '{{.Names}}|{{.Networks}}|{{.Labels}}|{{.Image}}' 2>/dev/null)
EOF

    # Swarm services are only attributed when their name or image says Dokploy.
    DOKPLOY_SERVICE_COUNT="$(dokploy_services | grep -c .)"

    # Compose projects are counted only when an attributed container carries them.
    DOKPLOY_PROJECT_COUNT="$(dokploy_attributed_projects | grep -c .)"

    DOKPLOY_SERVER_COUNT="$($SUDO_CMD docker node ls --format '{{.ID}}' 2>/dev/null | grep -c .)"
    DOKPLOY_DOMAIN_COUNT="$(dokploy_collect_domains | grep -c .)"
    DOKPLOY_REGISTRY_COUNT="$($SUDO_CMD docker ps -a --format '{{.Names}}|{{.Image}}' 2>/dev/null \
        | grep -iE 'registry|harbor|nexus|artifactory' \
        | grep -vi 'notploy' | grep -c .)"
    DOKPLOY_GIT_PROVIDER_COUNT=0
    DOKPLOY_VOLUME_COUNT="$($SUDO_CMD docker volume ls --format '{{.Name}}' 2>/dev/null \
        | grep -i 'dokploy' | grep -vi 'notploy' | grep -c .)"
    DOKPLOY_NETWORK_COUNT="$(dokploy_networks | grep -c .)"
}

# Compose project names carried by attributed containers, unique, one per line.
dokploy_attributed_projects() {
    command -v docker >/dev/null 2>&1 || return 0
    local name networks labels project
    $SUDO_CMD docker ps -a --format '{{.Names}}|{{.Networks}}|{{.Labels}}' 2>/dev/null \
        | while IFS='|' read -r name networks labels; do
            is_notploy_infra_name "$name" && continue
            container_is_dokploy_attributed "$networks" "$labels" || continue
            project="$(printf '%s' "$labels" | tr ',' '\n' \
                | grep -oE 'com\.docker\.compose\.project=[^,]+' \
                | head -n1 | cut -d= -f2)"
            [ -n "$project" ] && printf '%s\n' "$project"
        done | sort -u
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
    "networks": 0,
    "unattributed": 0,
    "stopped": 0
  },
  "migration": {
    "identified": 0,
    "compatible": 0,
    "automatic": 0,
    "manual": 0
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
    "networks": $DOKPLOY_NETWORK_COUNT,
    "unattributed": $DOKPLOY_UNATTRIBUTED_COUNT,
    "stopped": $DOKPLOY_STOPPED_COUNT
  },
  "migration": {
    "identified": $((DOKPLOY_APPLICATION_COUNT + DOKPLOY_SERVICE_COUNT + DOKPLOY_STOPPED_COUNT)),
    "compatible": $DOKPLOY_APPLICATION_COUNT,
    "automatic": $DOKPLOY_APPLICATION_COUNT,
    "manual": $((DOKPLOY_GIT_PROVIDER_COUNT + DOKPLOY_REGISTRY_COUNT + DOKPLOY_DOMAIN_COUNT + DOKPLOY_STOPPED_COUNT))
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
    echo "Notploy will migrate this installation automatically: the Dokploy"
    echo "database and configuration are imported into Notploy, its management"
    echo "containers are stopped, and your applications keep serving."
    echo ""
}

print_dokploy_report() {
    echo ""
    echo "Dokploy migration analysis"
    echo ""
    echo "Resources identified as Dokploy (per Docker metadata):"
    printf '  %-18s %s\n' "Projects" "$DOKPLOY_PROJECT_COUNT"
    printf '  %-18s %s\n' "Applications" "$DOKPLOY_APPLICATION_COUNT"
    printf '  %-18s %s\n' "Swarm services" "$DOKPLOY_SERVICE_COUNT"
    printf '  %-18s %s\n' "Stopped containers" "$DOKPLOY_STOPPED_COUNT"
    printf '  %-18s %s\n' "Servers/nodes" "$DOKPLOY_SERVER_COUNT"
    printf '  %-18s %s\n' "Domains" "$DOKPLOY_DOMAIN_COUNT"
    printf '  %-18s %s\n' "Registries" "$DOKPLOY_REGISTRY_COUNT"
    printf '  %-18s %s\n' "Git providers" "$DOKPLOY_GIT_PROVIDER_COUNT"
    printf '  %-18s %s\n' "Volumes" "$DOKPLOY_VOLUME_COUNT"
    printf '  %-18s %s\n' "Networks" "$DOKPLOY_NETWORK_COUNT"
    echo ""
    echo "Other resources on this host (ownership NOT established):"
    printf '  %-18s %s\n' "Unattributed containers" "$DOKPLOY_UNATTRIBUTED_COUNT"
    echo ""
    echo "Positive signals:"
    echo "- A migration plan can be reconstructed from container/image and"
    echo "  network metadata. No resource is presented as migratable unless its"
    echo "  Dokploy ownership could be established."
    if [ "$DOKPLOY_UNATTRIBUTED_COUNT" -gt 0 ] 2>/dev/null; then
        echo "- $DOKPLOY_UNATTRIBUTED_COUNT unattributed container(s) exist and are"
        echo "  deliberately excluded from the migration plan."
    fi
    if [ "$DOKPLOY_STOPPED_COUNT" -gt 0 ] 2>/dev/null; then
        echo "- $DOKPLOY_STOPPED_COUNT stopped attributed container(s) cannot be"
        echo "  reconstructed automatically and need manual handling."
    fi
    echo "- This is a read-only diagnostic; no automatic migration is attempted"
    echo "  from --dry-run or --json. The migration runs with the installer."
    echo ""
    echo "Limitations / manual intervention:"
    if [ "$DOKPLOY_DOMAIN_COUNT" -gt 0 ] 2>/dev/null; then
        printf '  - %s domain(s) require DNS verification\n' "$DOKPLOY_DOMAIN_COUNT"
    fi
    if [ "$DOKPLOY_REGISTRY_COUNT" -gt 0 ] 2>/dev/null; then
        printf '  - %s registry(ies) require credentials\n' "$DOKPLOY_REGISTRY_COUNT"
    fi
    echo "  - Git providers, secrets and schedules require a Dokploy session"
    echo "  - Historical deployments are summarized, not imported"
    echo ""
    echo "No changes have been made to Dokploy."
}

# Persists the read-only assessment under the Notploy config directory. This
# never touches the Dokploy installation itself.
write_migration_report() {
    local dir file
    dir="$NOTPLOY_CONFIG_DIR/migration"
    if mkdir -p "$dir" 2>/dev/null; then
        chmod "$CONFIG_DIR_MODE" "$dir" 2>/dev/null || true
        file="$dir/dokploy-$(date -u +%Y%m%dT%H%M%SZ).json"
        if dokploy_json > "$file" 2>/dev/null; then
            chmod "$CONFIG_FILE_MODE" "$file" 2>/dev/null || true
            echo "Assessment report: $file"
        else
            echo "Warning: could not write the assessment report to $file" >&2
        fi
    else
        echo "Warning: could not create the report directory $dir" >&2
    fi
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

# `$1` is "persist" (default) to store the report, or "dry" to only print it.
# Dry-run must never write to the host, so the report is not persisted there.
run_migration_assessment() {
    local persist="${1:-persist}"
    dokploy_inventory
    print_dokploy_report
    echo ""
    if [ "$persist" = "dry" ]; then
        echo "Dry-run: the assessment report was not written to disk."
    else
        write_migration_report
    fi
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

# ---------------------------------------------------------------------------
# Host state detection: Docker Swarm and existing Notploy.
#
# These functions are strictly read-only. The installer must know what already
# exists before it decides whether it is allowed to mutate the host.
# ---------------------------------------------------------------------------

# Echoes one of: none | inactive | active-manager | active-worker | active-unknown.
# `none` means Docker is unavailable (or not a Swarm); it is not an active node.
detect_swarm_state() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "none"
        return 0
    fi
    local state control
    state="$($SUDO_CMD docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)"
    case "$state" in
        active)
            control="$($SUDO_CMD docker info --format '{{.Swarm.ControlAvailable}}' 2>/dev/null)"
            case "$control" in
                true) echo "active-manager" ;;
                false) echo "active-worker" ;;
                *) echo "active-unknown" ;;
            esac
            ;;
        inactive) echo "inactive" ;;
        "") echo "none" ;;
        *) echo "active-unknown" ;;
    esac
}

# Sets NOTPLOY_INSTALLED=1 when a Notploy service or container is found.
NOTPLOY_INSTALLED=0
detect_notploy_installation() {
    NOTPLOY_INSTALLED=0
    command -v docker >/dev/null 2>&1 || return 0
    if $SUDO_CMD docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx 'notploy'; then
        NOTPLOY_INSTALLED=1
        return 0
    fi
    if $SUDO_CMD docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qE '^notploy$'; then
        NOTPLOY_INSTALLED=1
        return 0
    fi
    return 0
}

# True when `ss` is unavailable: the port check is then inconclusive. We warn
# instead of pretending the ports are free.
port_check_available() {
    command -v ss >/dev/null 2>&1
}

# True when a TCP port is in the LISTEN state. Parses the local address column
# so IPv4 (`0.0.0.0:80`), IPv6 (`[::]:80`) and wildcard (`*:80`) forms all match.
port_is_listening() {
    local port="$1"
    # No `-H`: header rows never end in a numeric port, so they are ignored
    # while older `ss` builds without `-H` still work.
    ss -ltn 2>/dev/null | awk -v wanted="$port" '
        {
            addr = $4
            n = split(addr, parts, ":")
            if (parts[n] == wanted) { found = 1 }
        }
        END { exit found ? 0 : 1 }
    '
}

# True when an existing Notploy container is publishing `port` on the host.
port_published_by_notploy() {
    local port="$1"
    command -v docker >/dev/null 2>&1 || return 1
    $SUDO_CMD docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null \
        | grep -E '^notploy' \
        | grep -qE "(:${port}->|:${port}/)"
}

# Prints the name of every Dokploy *management* container publishing `port`.
# Only names/images that identify Dokploy itself are selected, so a user
# application that merely sits on the Dokploy network is never matched and can
# never be stopped by the migration.
dokploy_container_port_publishers() {
    local port="$1"
    command -v docker >/dev/null 2>&1 || return 0
    local name image ports
    $SUDO_CMD docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null \
        | while IFS='|' read -r name image ports; do
            [ -n "$name" ] || continue
            is_notploy_infra_name "$name" && continue
            printf '%s' "$ports" | grep -qE "(^|[^0-9])${port}->" || continue
            printf '%s|%s' "$name" "$image" | grep -qi 'dokploy' && printf '%s\n' "$name"
        done
}

# Prints the name of every Dokploy *management* Swarm service publishing `port`.
dokploy_service_port_publishers() {
    local port="$1"
    command -v docker >/dev/null 2>&1 || return 0
    local name ports
    $SUDO_CMD docker service ls --format '{{.Name}}|{{.Ports}}' 2>/dev/null \
        | while IFS='|' read -r name ports; do
            [ -n "$name" ] || continue
            is_notploy_infra_name "$name" && continue
            printf '%s' "$ports" | grep -qE "(^|[^0-9])${port}->" || continue
            printf '%s' "$name" | grep -qi 'dokploy' && printf '%s\n' "$name"
        done
}

# True when a Dokploy management container or service publishes `port`.
port_published_by_dokploy() {
    [ -n "$(dokploy_container_port_publishers "$1")" ] && return 0
    [ -n "$(dokploy_service_port_publishers "$1")" ] && return 0
    return 1
}

# Reclaims the ports Notploy needs from Dokploy's own management containers and
# services. A reverse proxy or panel installed under a non-standard name is
# still recognised from its name/image and removed. Deployed applications are
# never targeted: they are neither named nor imaged after Dokploy.
reclaim_dokploy_ports() {
    command -v docker >/dev/null 2>&1 || return 0
    local port name service
    for port in 80 443 3000; do
        port_is_listening "$port" || continue
        while IFS= read -r service; do
            [ -n "$service" ] || continue
            echo "Reclaiming port $port from Dokploy service '$service'."
            $SUDO_CMD docker service rm "$service" >/dev/null 2>&1 || true
        done <<EOF
$(dokploy_service_port_publishers "$port")
EOF
        while IFS= read -r name; do
            [ -n "$name" ] || continue
            echo "Reclaiming port $port from Dokploy container '$name'."
            $SUDO_CMD docker rm -f "$name" >/dev/null 2>&1 || true
        done <<EOF
$(dokploy_container_port_publishers "$port")
EOF
    done
}

# Waits (bounded) for the required ports to be released after Dokploy is
# stopped: Docker keeps a published port bound for a short moment after the
# container or service that published it is removed.
wait_for_required_ports_free() {
    local timeout="${1:-30}" waited=0 port busy
    port_check_available || return 0
    while [ "$waited" -lt "$timeout" ]; do
        busy=0
        for port in 80 443 3000; do
            if port_is_listening "$port" && ! port_published_by_notploy "$port"; then
                busy=1
            fi
        done
        [ "$busy" = "0" ] && return 0
        sleep 2
        waited=$((waited + 2))
    done
    return 1
}

# Fails closed if a port required by Notploy is taken by a *third party*. A port
# already served by this host's own Notploy installation is allowed (reinstall /
# update path). During a Dokploy migration (`$1` = 1), a port still held by a
# Dokploy management container/service is treated as reclaimable instead of
# fatal, because Notploy is replacing it. Third-party services are never stopped.
assert_required_ports() {
    local reclaim_dokploy="${1:-0}"
    if ! port_check_available; then
        echo "Warning: 'ss' is not available; skipping the listening-port check." >&2
        echo "Ensure ports 80, 443 and 3000 are free before continuing." >&2
        return 0
    fi

    local port
    for port in 80 443 3000; do
        if port_is_listening "$port"; then
            if port_published_by_notploy "$port"; then
                echo "Port $port is served by the existing Notploy installation (reusing it)."
                continue
            fi
            if [ "$reclaim_dokploy" = "1" ] && port_published_by_dokploy "$port"; then
                echo "Port $port is held by Dokploy and will be reclaimed during migration."
                continue
            fi
            echo "Error: port $port is already in use by another service." >&2
            echo "Notploy requires ports 80, 443 and 3000 to be available." >&2
            echo "Stop the service using port $port and re-run the installer." >&2
            exit 1
        fi
    done
}

# Refuses to continue when the host runs a Docker Swarm this installer did not
# create. The installer never runs `docker swarm leave` automatically; replacing
# a Swarm is an explicit manual decision.
assert_swarm_safe_to_install() {
    SWARM_STATE="$(detect_swarm_state)"
    case "$SWARM_STATE" in
        active-manager|active-worker|active-unknown)
            if [ "$NOTPLOY_INSTALLED" = "1" ]; then
                return 0
            fi
            echo "Error: an active Docker Swarm was detected on this host, and it was" >&2
            echo "not created by Notploy. This installer refuses to leave or modify it." >&2
            echo "" >&2
            echo "If you really intend to replace it with a fresh Notploy install, run:" >&2
            echo "  docker swarm leave --force" >&2
            echo "then re-run the installer. Otherwise, keep the cluster and install" >&2
            echo "Notploy on a separate host." >&2
            exit 1
            ;;
        *)
            return 0
            ;;
    esac
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

# --- Mutating-operation helpers --------------------------------------------
# Every function below is only called after the safety checks passed, and each
# one fails loudly instead of hiding errors behind `|| true`.

# Creates (or reuses) the private config directory with least-privilege modes.
# Existing unrelated data is never removed; only permissions are tightened.
ensure_config_dir() {
    if [ -e "$NOTPLOY_CONFIG_DIR" ] && [ ! -d "$NOTPLOY_CONFIG_DIR" ]; then
        echo "Error: $NOTPLOY_CONFIG_DIR exists but is not a directory." >&2
        exit 1
    fi
    $SUDO_CMD mkdir -p "$NOTPLOY_CONFIG_DIR" 2>/dev/null || {
        echo "Error: cannot create the config directory $NOTPLOY_CONFIG_DIR." >&2
        exit 1
    }

    if [ -z "$SUDO_CMD" ]; then
        # Running as root: keep the config root-owned.
        chown root:root "$NOTPLOY_CONFIG_DIR" 2>/dev/null || true
    else
        # Running as a non-root user with sudo: hand the config directory to the
        # invoking user so later steps and the Notploy service can manage it.
        $SUDO_CMD chown -R "$CURRENT_USER" "$NOTPLOY_CONFIG_DIR" 2>/dev/null || true
    fi
    if [ -n "$NOTPLOY_CONFIG_GROUP" ]; then
        if $SUDO_CMD chgrp "$NOTPLOY_CONFIG_GROUP" "$NOTPLOY_CONFIG_DIR" 2>/dev/null; then
            :
        else
            echo "Warning: group '$NOTPLOY_CONFIG_GROUP' not found; keeping the default group." >&2
        fi
    fi

    $SUDO_CMD chmod "$CONFIG_DIR_MODE" "$NOTPLOY_CONFIG_DIR" 2>/dev/null || {
        echo "Error: cannot set permissions on $NOTPLOY_CONFIG_DIR." >&2
        exit 1
    }
    echo "Config directory ready: $NOTPLOY_CONFIG_DIR (mode $CONFIG_DIR_MODE)"
}

# True when the existing instance identity is complete and coherent: the
# certificate verifies against the local CA, its key matches the private key,
# and it is not expired. The mere presence of `instance.key` proves nothing.
instance_identity_is_coherent() {
    local dir="$INSTANCE_IDENTITY_DIR"
    [ -f "$dir/instance.key" ] || return 1
    [ -f "$dir/instance.crt" ] || return 1
    [ -f "$dir/ca.crt" ] || return 1
    command -v openssl >/dev/null 2>&1 || return 1

    openssl verify -CAfile "$dir/ca.crt" "$dir/instance.crt" >/dev/null 2>&1 || return 1
    openssl x509 -in "$dir/instance.crt" -checkend 0 -noout >/dev/null 2>&1 || return 1

    local cert_pub key_pub
    cert_pub="$(openssl x509 -in "$dir/instance.crt" -pubkey -noout 2>/dev/null \
        | openssl pkey -pubin -outform DER 2>/dev/null | openssl dgst -sha256 2>/dev/null)"
    key_pub="$(openssl pkey -in "$dir/instance.key" -pubout -outform DER 2>/dev/null \
        | openssl dgst -sha256 2>/dev/null)"
    [ -n "$cert_pub" ] && [ "$cert_pub" = "$key_pub" ] || return 1
    return 0
}

# Idempotent network creation: reuse a compatible overlay, refuse to delete or
# replace any other network that happens to share the name.
ensure_network() {
    if $SUDO_CMD docker network inspect notploy-network >/dev/null 2>&1; then
        local driver
        driver="$($SUDO_CMD docker network inspect notploy-network --format '{{.Driver}}' 2>/dev/null)"
        if [ "$driver" = "overlay" ]; then
            echo "Reusing the existing 'notploy-network' overlay network."
            return 0
        fi
        echo "Error: a network named 'notploy-network' already exists with driver '$driver'." >&2
        echo "Refusing to delete it. Handle that network deliberately, then re-run." >&2
        exit 1
    fi
    $SUDO_CMD docker network create --driver overlay --attachable notploy-network >/dev/null 2>&1 || {
        echo "Error: failed to create the 'notploy-network' overlay network." >&2
        exit 1
    }
    echo "Created overlay network 'notploy-network'."
}

# Idempotent secret creation. RNG value is generated before the call so a
# pre-existing secret is never overwritten.
ensure_secret() {
    local name="$1"
    local value="$2"
    if $SUDO_CMD docker secret inspect "$name" >/dev/null 2>&1; then
        echo "Secret '$name' already exists; reusing it."
        return 0
    fi
    if printf '%s' "$value" | $SUDO_CMD docker secret create "$name" - >/dev/null 2>&1; then
        echo "Created Docker secret '$name'."
        return 0
    fi
    echo "Error: failed to create the required Docker secret '$name'." >&2
    echo "Ensure Docker Swarm is active and this host is a manager." >&2
    exit 1
}

service_exists() {
    $SUDO_CMD docker service inspect "$1" >/dev/null 2>&1
}

# Polls a service until it converges (all replicas running, no update in
# progress / no rollback) or the bounded timeout expires. Returns non-zero on
# timeout or rollback so callers never report success prematurely.
wait_for_service_convergence() {
    local service="$1" timeout="${2:-180}" waited=0 replicas update_state running desired
    while [ "$waited" -lt "$timeout" ]; do
        if service_exists "$service"; then
            update_state="$($SUDO_CMD docker service inspect "$service" \
                --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}' 2>/dev/null)"
            case "$update_state" in
                rollback_started|rollback_paused|rollback_completed) return 1 ;;
            esac
            desired="$($SUDO_CMD docker service inspect "$service" \
                --format '{{.Spec.Mode.Replicated.Replicas}}' 2>/dev/null)"
            [ -n "$desired" ] || desired=1
            running="$($SUDO_CMD docker service ps "$service" \
                --filter desired-state=running \
                --format '{{.CurrentState}}' 2>/dev/null | grep -c '^Running')"
            if [ "$desired" != "0" ] && [ "$running" = "$desired" ] \
                && [ "$update_state" != "updating" ] && [ "$update_state" != "paused" ]; then
                return 0
            fi
        fi
        sleep 3
        waited=$((waited + 3))
    done
    return 1
}

assert_docker_ready() {
    command -v docker >/dev/null 2>&1 || {
        echo "Error: Docker is not installed." >&2
        exit 1
    }
    if ! $SUDO_CMD docker info >/dev/null 2>&1; then
        echo "Error: the Docker daemon is not reachable." >&2
        echo "Start Docker and ensure the current account can access it, then re-run." >&2
        exit 1
    fi
}

# Starts the Traefik reverse proxy on a pinned image. There is deliberately no
# automatic fallback to another (major/minor) version: a pull failure and a
# start failure are distinguished and reported instead of silently downgrading.
ensure_traefik_container() {
    local image="traefik:v3.6.25"

    if $SUDO_CMD docker inspect notploy-traefik >/dev/null 2>&1; then
        echo "Container 'notploy-traefik' already exists; leaving it untouched."
        return 0
    fi

    if ! $SUDO_CMD docker image inspect "$image" >/dev/null 2>&1; then
        echo "Pulling $image..."
        if ! $SUDO_CMD docker pull "$image" >/dev/null 2>&1; then
            echo "Error: could not pull $image from the registry." >&2
            echo "This looks like a registry/network problem, not a missing version." >&2
            echo "Check connectivity/registry access and re-run." >&2
            exit 1
        fi
    fi

    if ! $SUDO_CMD docker run -d \
        --name notploy-traefik \
        --restart always \
        --network notploy-network \
        -v "$NOTPLOY_CONFIG_DIR/traefik/traefik.yml:/etc/traefik/traefik.yml" \
        -v "$NOTPLOY_CONFIG_DIR/traefik/dynamic:/etc/notploy/traefik/dynamic" \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -p 80:80/tcp \
        -p 443:443/tcp \
        -p 443:443/udp \
        "$image" >/dev/null 2>&1; then
        echo "Error: failed to start the Traefik container with $image." >&2
        echo "Inspect with: docker logs notploy-traefik" >&2
        exit 1
    fi
    echo "Started Traefik container ($image)."
}

# ---------------------------------------------------------------------------
# Shared service creation
# ---------------------------------------------------------------------------

create_notploy_postgres_service() {
    local endpoint_mode="$1"
    if service_exists notploy-postgres; then
        echo "Service 'notploy-postgres' already exists; leaving it untouched."
        return 0
    fi
    $SUDO_CMD docker service create \
        --name notploy-postgres \
        --constraint 'node.role==manager' \
        --network notploy-network \
        --env POSTGRES_USER=notploy \
        --env POSTGRES_DB=notploy \
        --secret source=notploy_postgres_password,target=/run/secrets/postgres_password \
        --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
        --mount type=volume,source=notploy-postgres,target=/var/lib/postgresql/data \
        $endpoint_mode \
        postgres:16 >/dev/null || {
        echo "Error: failed to create the 'notploy-postgres' service." >&2
        exit 1
    }
    echo "Created service 'notploy-postgres'."
}

create_notploy_app_service() {
    local endpoint_mode="$1" product_env="$2" image="$3" release_tag_env="$4"
    if service_exists notploy; then
        echo "Service 'notploy' already exists; leaving it untouched."
        return 0
    fi
    $SUDO_CMD docker service create \
        --name notploy \
        --replicas 1 \
        --network notploy-network \
        --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
        --mount type=bind,source="$NOTPLOY_CONFIG_DIR",target=/etc/notploy \
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
        "$image" >/dev/null || {
        echo "Error: failed to create the 'notploy' service." >&2
        exit 1
    }
    echo "Created service 'notploy'."
}

# ---------------------------------------------------------------------------
# Dokploy → Notploy migration (server-level data adoption)
#
# Runs automatically (unless --fresh) when a Dokploy installation is detected.
# The migration is deliberately conservative:
#   - backups are always created before anything is touched,
#   - the Dokploy database and configuration are imported into Notploy's own
#     Swarm services,
#   - only Dokploy *management* containers/services are stopped, never the
#     deployed applications,
#   - the Dokploy overlay network is kept so existing applications keep their
#     routing until they are redeployed onto Notploy.
# `docker swarm leave` is never run automatically.
# ---------------------------------------------------------------------------

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

format_ip_for_url() {
    local ip="$1"
    if echo "$ip" | grep -q ':'; then
        echo "[${ip}]"
    else
        echo "${ip}"
    fi
}

# Initializes a single-node Docker Swarm on this host. Shared by the fresh
# install path and the migration path: a host running the Compose-based Dokploy
# has no Swarm yet, and Notploy cannot schedule its services without one.
initialize_swarm() {
    local advertise_addr="${ADVERTISE_ADDR:-$(get_private_ip)}"
    if [ -z "$advertise_addr" ]; then
        advertise_addr="$(get_ip)"
    fi
    if [ -z "$advertise_addr" ]; then
        echo "ERROR: We couldn't detect your server IP address." >&2
        echo "Please set the ADVERTISE_ADDR environment variable manually." >&2
        exit 1
    fi
    echo "Using advertise address: $advertise_addr"

    local swarm_init_args="${DOCKER_SWARM_INIT_ARGS:-}"
    if [ -n "$swarm_init_args" ]; then
        echo "Using custom swarm init arguments: $swarm_init_args"
        # shellcheck disable=SC2086
        $SUDO_CMD docker swarm init --advertise-addr "$advertise_addr" $swarm_init_args || {
            echo "Error: failed to initialize Docker Swarm." >&2
            exit 1
        }
    else
        $SUDO_CMD docker swarm init --advertise-addr "$advertise_addr" || {
            echo "Error: failed to initialize Docker Swarm." >&2
            exit 1
        }
    fi
    echo "Swarm initialized"
}

DOKPLOY_MIGRATABLE=0
DOKPLOY_MISSING=""
DOKPLOY_CONFIG_SOURCE="/etc/dokploy"
DOKPLOY_DB_NAME="dokploy"
DOKPLOY_DB_USER="dokploy"
DOKPLOY_NETWORK_NAME=""
DOKPLOY_POSTGRES_CONTAINER=""
DOKPLOY_AUTH_SECRET=""
DOKPLOY_AUTH_SECRET_READY=0
BACKUP_DIR=""
BACKUP_TS=""

# ID (or name) of the container running the Dokploy Postgres database.
dokploy_postgres_id() {
    local match
    match="$($SUDO_CMD docker ps -a --format '{{.ID}}|{{.Names}}' 2>/dev/null \
        | awk -F'|' '$2 ~ /dokploy-postgres/ {print $1; exit}')"
    if [ -z "$match" ]; then
        # Compose variants may name the container differently.
        match="$($SUDO_CMD docker ps -a --format '{{.ID}}|{{.Names}}|{{.Networks}}|{{.Image}}' 2>/dev/null \
            | awk -F'|' '$4 ~ /postgres/ {print $1; exit}')"
    fi
    printf '%s' "$match"
}

# Reads Dokploy's Better Auth secret from its running application container.
# Docker Swarm secrets are write-only through the API, so the value is only
# reachable from a container that has it mounted as a file. This must be called
# before Dokploy is stopped. Prints the secret, or nothing if it is unreachable.
dokploy_auth_secret_value() {
    command -v docker >/dev/null 2>&1 || return 0
    local cid value name
    cid="$($SUDO_CMD docker ps -q \
        --filter 'label=com.docker.swarm.service.name=dokploy' 2>/dev/null | head -n1)"
    if [ -z "$cid" ]; then
        cid="$($SUDO_CMD docker ps --format '{{.ID}}|{{.Names}}' 2>/dev/null \
            | awk -F'|' '$2 == "dokploy" || $2 ~ /^dokploy\.[0-9]+\./ {print $1; exit}')"
    fi
    [ -n "$cid" ] || return 0

    # Current Dokploy installs mount the secret as a file; accept the names used
    # across versions.
    for name in dokploy_auth_secret better_auth_secret auth_secret; do
        value="$($SUDO_CMD docker exec "$cid" cat "/run/secrets/$name" 2>/dev/null)"
        if [ -n "$value" ]; then
            printf '%s' "$value"
            return 0
        fi
    done

    # Older installations set BETTER_AUTH_SECRET inline instead of a Docker secret.
    value="$($SUDO_CMD docker inspect "$cid" \
        --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
        | sed -n 's/^BETTER_AUTH_SECRET=//p' | head -n1)"
    [ -n "$value" ] || return 0
    printf '%s' "$value"
}

# Resolves the secret Dokploy used for its encrypted-at-rest columns before any
# destructive step. Docker secrets are write-only through the API, so the value
# is recovered from Dokploy's still-running container. Fails closed when the
# database holds encrypted values but the secret cannot be recovered, instead of
# silently generating a new one (which would orphan those values and make
# deployments run with an empty environment).
resolve_dokploy_auth_secret() {
    DOKPLOY_AUTH_SECRET_READY=0
    DOKPLOY_AUTH_SECRET=""

    if [ -n "${NOTPLOY_DOKPLOY_AUTH_SECRET:-}" ]; then
        DOKPLOY_AUTH_SECRET="$NOTPLOY_DOKPLOY_AUTH_SECRET"
        DOKPLOY_AUTH_SECRET_READY=1
        echo "Using the Dokploy auth secret provided via NOTPLOY_DOKPLOY_AUTH_SECRET."
        return 0
    fi

    DOKPLOY_AUTH_SECRET="$(dokploy_auth_secret_value)"
    if [ -n "$DOKPLOY_AUTH_SECRET" ]; then
        DOKPLOY_AUTH_SECRET_READY=1
        echo "Recovered Dokploy's auth secret from its running container."
        return 0
    fi

    local encrypted
    encrypted="$(grep -c 'enc:v1:[A-Za-z0-9+/]' "$BACKUP_DIR/database.sql" 2>/dev/null || true)"
    case "$encrypted" in
        ''|*[!0-9]*) encrypted=0 ;;
    esac
    if [ "$encrypted" -gt 0 ]; then
        cat >&2 <<'EOF'
Error: Dokploy's auth secret could not be recovered, but the Dokploy database
contains encrypted values (enc:v1:...). Importing them without the original
secret would make environment variables, registry and git credentials
unreadable, and deployments would silently run with an empty environment.

Provide the secret explicitly and re-run the migration:
  NOTPLOY_DOKPLOY_AUTH_SECRET=<value> sh install.sh --migrate

The value is Dokploy's BETTER_AUTH_SECRET (or its dokploy_auth_secret).
No change was made to the Dokploy installation.
EOF
        exit 1
    fi

    echo "Dokploy's auth secret is not retrievable, but the database holds no encrypted values; continuing." >&2
    DOKPLOY_AUTH_SECRET_READY=1
    return 0
}

# Read-only: determines whether the detected Dokploy runtime can be migrated.
dokploy_detect_runtime() {
    DOKPLOY_MIGRATABLE=0
    DOKPLOY_MISSING=""
    DOKPLOY_CONFIG_SOURCE="${NOTPLOY_DOKPLOY_CONFIG_PATH:-/etc/dokploy}"
    DOKPLOY_DB_NAME="dokploy"
    DOKPLOY_DB_USER="dokploy"
    DOKPLOY_NETWORK_NAME="$(dokploy_networks | head -n1)"
    DOKPLOY_POSTGRES_CONTAINER="$(dokploy_postgres_id)"

    local missing=""
    if [ -z "$DOKPLOY_POSTGRES_CONTAINER" ]; then
        missing="$missing
  - the Dokploy Postgres container"
    fi
    if [ ! -d "$DOKPLOY_CONFIG_SOURCE" ]; then
        missing="$missing
  - the Dokploy config directory $DOKPLOY_CONFIG_SOURCE"
    fi
    if [ -z "$DOKPLOY_NETWORK_NAME" ]; then
        missing="$missing
  - the Dokploy Docker network"
    fi

    if [ -n "$missing" ]; then
        DOKPLOY_MISSING="$missing"
        return 1
    fi
    DOKPLOY_MIGRATABLE=1
}

backup_dokploy() {
    BACKUP_TS="$(date -u +%Y%m%dT%H%M%SZ)"
    BACKUP_DIR="$NOTPLOY_CONFIG_DIR/backups/dokploy-$BACKUP_TS"
    mkdir -p "$BACKUP_DIR" 2>/dev/null || {
        echo "Error: cannot create the backup directory $BACKUP_DIR." >&2
        exit 1
    }
    chmod 700 "$BACKUP_DIR" 2>/dev/null || true

    echo "Backing up the Dokploy configuration..."
    if command -v tar >/dev/null 2>&1; then
        $SUDO_CMD tar -czf "$BACKUP_DIR/config.tar.gz" \
            -C "$(dirname "$DOKPLOY_CONFIG_SOURCE")" \
            "$(basename "$DOKPLOY_CONFIG_SOURCE")" 2>/dev/null || {
            echo "Error: failed to back up $DOKPLOY_CONFIG_SOURCE." >&2
            exit 1
        }
    else
        $SUDO_CMD cp -a "$DOKPLOY_CONFIG_SOURCE" "$BACKUP_DIR/config-copy" 2>/dev/null || {
            echo "Error: failed to back up $DOKPLOY_CONFIG_SOURCE." >&2
            exit 1
        }
    fi

    echo "Backing up the Dokploy database..."
    # `--no-owner` drops ownership; `--no-acl` drops GRANTs that reference the
    # Dokploy role, which would otherwise abort the import under ON_ERROR_STOP.
    if ! $SUDO_CMD docker exec "$DOKPLOY_POSTGRES_CONTAINER" pg_dump -U "$DOKPLOY_DB_USER" \
        -d "$DOKPLOY_DB_NAME" --no-owner --no-acl > "$BACKUP_DIR/database.sql" 2>/dev/null; then
        echo "Error: failed to dump the Dokploy database." >&2
        exit 1
    fi
    if [ ! -s "$BACKUP_DIR/database.sql" ]; then
        echo "Error: the Dokploy database dump is empty." >&2
        exit 1
    fi
    echo "Backups stored in: $BACKUP_DIR"
}

copy_dokploy_config() {
    if [ "$NOTPLOY_CONFIG_DIR" = "$DOKPLOY_CONFIG_SOURCE" ]; then
        echo "Using the Dokploy config directory in place."
        return 0
    fi
    echo "Adopting the Dokploy configuration into $NOTPLOY_CONFIG_DIR..."
    $SUDO_CMD cp -a "$DOKPLOY_CONFIG_SOURCE/." "$NOTPLOY_CONFIG_DIR/" 2>/dev/null || {
        echo "Error: could not copy $DOKPLOY_CONFIG_SOURCE into $NOTPLOY_CONFIG_DIR." >&2
        exit 1
    }
    # `cp -a` under sudo preserves the (root) ownership; hand the adopted files
    # to the invoking user so normalization can rewrite and re-permission them.
    $SUDO_CMD chown -R "$CURRENT_USER" "$NOTPLOY_CONFIG_DIR" 2>/dev/null || true
}

# The Notploy application always reads its data from /etc/notploy inside the
# container (the config directory is bind-mounted there). Dokploy's own Traefik
# static config references /etc/dokploy, so the adopted copy is rewritten or the
# imported routes and ACME certificates would point at a path that does not
# exist in the Notploy container.
normalize_dokploy_config() {
    local dir="$NOTPLOY_CONFIG_DIR"
    local file

    # Every adopted *text* config file may embed absolute Dokploy paths (the
    # Traefik static config, dynamic provider files, compose definitions, ...).
    # Rewrite them all, not just traefik.yml, so nothing points at /etc/dokploy
    # which does not exist inside the Notploy container. `grep -I` skips binary
    # files and the backup directory is excluded so the pristine Dokploy state
    # (database.sql, config.tar.gz) can still be restored verbatim.
    if command -v grep >/dev/null 2>&1; then
        while IFS= read -r file; do
            [ -n "$file" ] || continue
            case "$file" in
                "$dir"/backups/*) continue ;;
            esac
            if sed "s#/etc/dokploy#/etc/notploy#g" "$file" > "$file.tmp" 2>/dev/null \
                && mv "$file.tmp" "$file"; then
                echo "Pointing the adopted config at /etc/notploy: $file"
            else
                rm -f "$file.tmp"
                echo "Warning: could not normalize $file." >&2
            fi
        done <<EOF
$(grep -rlI --exclude-dir=backups '/etc/dokploy' "$dir" 2>/dev/null)
EOF
    fi

    # Traefik refuses to start (or silently loses certificates) when acme.json is
    # group/world readable; enforce the required mode after the copy.
    local acme="$dir/traefik/dynamic/acme.json"
    if [ -f "$acme" ]; then
        chmod 600 "$acme" 2>/dev/null || true
    fi
}

# Removes only Dokploy's own management services/containers (the panel, its
# Postgres/Redis and its Traefik). Deployed applications are never touched.
stop_dokploy_infrastructure() {
    echo "Stopping Dokploy's own management services and containers..."
    local name
    for name in dokploy dokploy-postgres dokploy-redis dokploy-traefik; do
        if $SUDO_CMD docker service inspect "$name" >/dev/null 2>&1; then
            $SUDO_CMD docker service rm "$name" >/dev/null 2>&1 || {
                echo "Error: failed to remove the Dokploy service '$name'." >&2
                exit 1
            }
            echo "Removed Dokploy service '$name'."
        fi
    done
    for name in dokploy dokploy-postgres dokploy-redis dokploy-traefik; do
        if $SUDO_CMD docker inspect "$name" >/dev/null 2>&1; then
            $SUDO_CMD docker rm -f "$name" >/dev/null 2>&1 || {
                echo "Error: failed to remove the Dokploy container '$name'." >&2
                exit 1
            }
            echo "Removed Dokploy container '$name'."
        fi
    done
}

# Dokploy records absolute paths (/etc/dokploy/...) for certificates, SSH keys
# and compose sources. Notploy's container sees the adopted data at /etc/notploy,
# so the dump is rewritten before it is imported; the pristine dump is kept.
prepare_dokploy_dump() {
    local source="$BACKUP_DIR/database.sql"
    local target="$BACKUP_DIR/database-import.sql"
    if grep -q "/etc/dokploy" "$source" 2>/dev/null; then
        echo "Rewriting /etc/dokploy paths to /etc/notploy in the imported dump..." >&2
        if ! sed "s#/etc/dokploy#/etc/notploy#g" "$source" > "$target"; then
            echo "Error: could not rewrite the Dokploy dump paths." >&2
            exit 1
        fi
    else
        cp "$source" "$target" || {
            echo "Error: could not prepare the Dokploy dump for import." >&2
            exit 1
        }
    fi
    printf '%s' "$target"
}

restore_dokploy_database() {
    echo "Restoring the Dokploy database into Notploy's Postgres..."
    local import_dump
    import_dump="$(prepare_dokploy_dump)"
    local psql_image="postgres:16"
    if ! $SUDO_CMD docker image inspect "$psql_image" >/dev/null 2>&1; then
        $SUDO_CMD docker pull "$psql_image" >/dev/null 2>&1 || {
            echo "Error: could not pull $psql_image to restore the database." >&2
            exit 1
        }
    fi
    # ON_ERROR_STOP makes a partially applied import fail loudly instead of
    # leaving a silently corrupted instance. stdout/stderr are captured so the
    # psql diagnostic can be surfaced.
    # shellcheck disable=SC2086
    local restore_log="$BACKUP_DIR/restore.log"
    if ! $SUDO_CMD docker run --rm -i --network notploy-network \
        --env "PGPASSWORD=$POSTGRES_PASSWORD" \
        "$psql_image" \
        psql -v ON_ERROR_STOP=1 -h notploy-postgres -U notploy -d notploy \
        < "$import_dump" > "$restore_log" 2>&1; then
        echo "Error: failed to restore the Dokploy database." >&2
        tail -n 20 "$restore_log" >&2 2>/dev/null || true
        echo "The backup is preserved at $BACKUP_DIR/database.sql." >&2
        exit 1
    fi
    echo "Database imported. Notploy applies the remaining schema migrations on boot."
}

connect_dokploy_network() {
    [ -n "$DOKPLOY_NETWORK_NAME" ] || return 0
    echo "Joining $DOKPLOY_NETWORK_NAME so existing applications keep their routing..."
    local svc
    for svc in notploy notploy-postgres; do
        if service_exists "$svc"; then
            $SUDO_CMD docker service update --network-add "$DOKPLOY_NETWORK_NAME" "$svc" >/dev/null 2>&1 \
                || echo "Warning: could not attach '$svc' to $DOKPLOY_NETWORK_NAME." >&2
        fi
    done
    if $SUDO_CMD docker inspect notploy-traefik >/dev/null 2>&1; then
        $SUDO_CMD docker network connect "$DOKPLOY_NETWORK_NAME" notploy-traefik >/dev/null 2>&1 \
            || echo "Warning: could not attach 'notploy-traefik' to $DOKPLOY_NETWORK_NAME." >&2
    fi
}

migrate_dokploy() {
    require_elevation
    assert_docker_ready

    detect_notploy_installation
    if [ "$NOTPLOY_INSTALLED" = "1" ]; then
        echo "Error: an existing Notploy installation was detected on this host." >&2
        echo "A migration would overwrite its data; update it instead:" >&2
        echo "  curl -fsSL https://notploy.com/install.sh | sh -s -- update" >&2
        exit 1
    fi

    dokploy_detect_runtime
    if [ "$DOKPLOY_MIGRATABLE" != "1" ]; then
        cat >&2 <<'EOF'
Error: Dokploy resources were detected, but this host does not expose everything
required to migrate safely. Missing:
EOF
        printf '%s\n' "$DOKPLOY_MISSING" >&2
        cat >&2 <<'EOF'

No change was made to this host. Re-run with --fresh only if you really intend
to discard Dokploy and install Notploy from scratch.
EOF
        exit 1
    fi

    case "$(detect_swarm_state)" in
        active-manager|active-unknown) : ;;
        active-worker)
            echo "Error: this host is a Docker Swarm worker node." >&2
            echo "Notploy schedules its services on a manager node. Run the migration" >&2
            echo "on the Dokploy manager node, or promote this node first." >&2
            exit 1
            ;;
        *)
            # The standard Dokploy installation runs on Docker Compose, not on a
            # Swarm. Initializing a single-node Swarm here is what lets the
            # migration proceed instead of aborting on a host we are replacing.
            echo "No active Docker Swarm detected; initializing one for Notploy..."
            initialize_swarm
            ;;
    esac

    command -v openssl >/dev/null 2>&1 || {
        echo "Error: openssl is required to bootstrap the instance identity." >&2
        exit 1
    }

    echo ""
    echo "Starting the Dokploy → Notploy migration"
    echo "Dokploy version: ${DOKPLOY_VERSION:-unknown}"
    echo "Installation: $(installation_type_label "$DOKPLOY_INSTALLATION_TYPE")"
    echo "Importing the database '${DOKPLOY_DB_NAME}' from ${DOKPLOY_POSTGRES_CONTAINER}"
    echo "and the configuration from ${DOKPLOY_CONFIG_SOURCE}."
    echo ""

    ensure_config_dir
    backup_dokploy

    # Resolve the auth secret now: Dokploy still runs, and a recoverable failure
    # (database encrypted but secret unreadable) must abort before the config is
    # adopted or Dokploy is stopped. The dump written above is reused for the
    # encrypted-values check, so no second pg_dump is needed.
    resolve_dokploy_auth_secret

    copy_dokploy_config
    normalize_dokploy_config
    bootstrap_identity

    # Free ports 80/443/3000 held by Dokploy's own management containers before
    # Notploy binds them. Deployed applications are never touched. A proxy or
    # panel installed under a non-standard name is still reclaimed, and the
    # assertion below never lets Dokploy's own ports block the migration.
    stop_dokploy_infrastructure
    reclaim_dokploy_ports
    if ! wait_for_required_ports_free 30; then
        echo "Warning: some required ports are still busy after stopping Dokploy;" >&2
        echo "continuing because they belong to the Dokploy installation being replaced." >&2
    fi

    ensure_network
    assert_required_ports 1

    local endpoint_mode=""
    if is_proxmox_lxc; then
        echo "⚠️ WARNING: Detected a Proxmox LXC container environment!"
        endpoint_mode="--endpoint-mode dnsrr"
    fi

    POSTGRES_PASSWORD="$(generate_random_password)"
    ensure_secret notploy_postgres_password "$POSTGRES_PASSWORD"
    if [ -n "$DOKPLOY_AUTH_SECRET" ]; then
        echo "Reusing the Dokploy auth secret so imported encrypted values stay readable."
        AUTH_SECRET="$DOKPLOY_AUTH_SECRET"
    else
        AUTH_SECRET="$(openssl rand -hex 32)"
    fi
    ensure_secret notploy_auth_secret "$AUTH_SECRET"
    echo "Secure database credentials and auth secret stored as Docker Secrets."

    create_notploy_postgres_service "$endpoint_mode"
    echo "Waiting for the 'notploy-postgres' service to converge (up to 120s)..."
    if ! wait_for_service_convergence notploy-postgres 120; then
        echo "Error: the 'notploy-postgres' service did not converge." >&2
        $SUDO_CMD docker service ps notploy-postgres --no-trunc >&2 2>/dev/null || true
        exit 1
    fi
    restore_dokploy_database

    VERSION_TAG="$(detect_version)"
    DOCKER_IMAGE="$(resolve_docker_image "$VERSION_TAG")"
    echo "Installing Notploy version: ${VERSION_TAG} (image: ${DOCKER_IMAGE})"

    product_env=""
    if [ "$NOTPLOY_PRODUCT" != "self" ]; then
        product_env="-e NOTPLOY_FLAVOR=$NOTPLOY_PRODUCT -e IS_CLOUD=true -e NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE=/etc/notploy/identity/entitlement-ca.pub"
    fi
    release_tag_env="-e RELEASE_TAG=$VERSION_TAG"

    create_notploy_app_service "$endpoint_mode" "$product_env" "$DOCKER_IMAGE" "$release_tag_env"

    echo "Waiting for the 'notploy' service to converge (up to 180s)..."
    if wait_for_service_convergence notploy 180; then
        echo "Service 'notploy' converged."
    else
        echo "Error: the 'notploy' service did not converge within the timeout." >&2
        $SUDO_CMD docker service ps notploy --no-trunc >&2 2>/dev/null || true
        echo "Diagnose with: docker service ps notploy" >&2
        exit 1
    fi

    ensure_traefik_container
    connect_dokploy_network

    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    NC="\033[0m"

    public_ip="${ADVERTISE_ADDR:-$(get_ip)}"
    private_ip=$(get_private_ip)
    formatted_addr=$(format_ip_for_url "$public_ip")
    echo ""
    printf "${GREEN}Migration complete! Notploy is installed and running.${NC}\n"
    printf "${YELLOW}Please go to http://${formatted_addr}:3000${NC}\n"
    if [ -n "$private_ip" ] && [ "$private_ip" != "$public_ip" ]; then
        printf "${YELLOW}If you are on the same local network, use http://${private_ip}:3000${NC}\n"
    fi
    echo ""
    echo "Existing applications remain reachable through the '$DOKPLOY_NETWORK_NAME'"
    echo "overlay network and will move onto 'notploy-network' when redeployed."
    echo ""
    echo "Rollback: the previous state is preserved in:"
    echo "  $BACKUP_DIR"
    echo "To roll back, re-install Dokploy and restore that directory."
    echo ""
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
            run_migration_assessment dry
            exit 0
        fi
        show_dokploy_detected

        if [ "$MIGRATION_REQUESTED" = "-1" ]; then
            echo "Fresh installation explicitly requested (--fresh)."
            echo "Dokploy will not be modified by this installer."
            echo ""
        else
            # Automatic migration: a host running Dokploy is never treated as a
            # fresh host. `migrate_dokploy` performs its own root/safety checks.
            migrate_dokploy
            exit 0
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

    # From here on the installer mutates the host and therefore requires root
    # or a non-root user with passwordless sudo.
    require_elevation

    # Requisites are validated up-front so we never start mutating a host we
    # cannot finish configuring.
    if ! command -v docker >/dev/null 2>&1; then
        echo "Installing Docker $DOCKER_VERSION..."
        curl -fsSL https://get.docker.com | $SUDO_CMD sh -s -- --version "$DOCKER_VERSION" || {
            echo "Error: failed to install Docker." >&2
            exit 1
        }
        if command -v apt-mark >/dev/null 2>&1; then
            $SUDO_CMD apt-mark hold docker-ce docker-ce-cli docker-ce-rootless-extras 2>/dev/null \
                || echo "Warning: could not pin the Docker packages (apt-mark hold failed)." >&2
        fi
        if command -v systemctl >/dev/null 2>&1; then
            $SUDO_CMD systemctl enable --now docker >/dev/null 2>&1 \
                || echo "Warning: could not enable the Docker service automatically." >&2
        fi
    else
        echo "Docker already installed"
    fi

    assert_docker_ready

    command -v openssl >/dev/null 2>&1 || {
        echo "Error: openssl is required to bootstrap the instance identity." >&2
        exit 1
    }

    detect_notploy_installation
    if [ "$NOTPLOY_INSTALLED" = "1" ]; then
        echo "Error: an existing Notploy installation was detected on this host." >&2
        echo "A fresh install would disrupt it. To update it instead, run:" >&2
        echo "  curl -fsSL https://notploy.com/install.sh | sh -s -- update" >&2
        exit 1
    fi

    # Refuse before touching the host if a Swarm this installer does not own is
    # active. `docker swarm leave` is never run automatically.
    assert_swarm_safe_to_install

    assert_required_ports

    VERSION_TAG="$(detect_version)"
    # For self-hosted app image, the tag is typically vX.Y.Z-app; resolve_docker_image
    # maps the release tag to the image published by docker-publish.yml.
    DOCKER_IMAGE="$(resolve_docker_image "$VERSION_TAG")"

    echo "Installing Notploy version: ${VERSION_TAG} (image: ${DOCKER_IMAGE})"

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

    initialize_swarm

    ensure_network
    ensure_config_dir

    # Generate (self) or verify (cloud/console) the instance identity before the
    # application starts, so it never boots without a trust anchor.
    bootstrap_identity

    POSTGRES_PASSWORD="$(generate_random_password)"
    ensure_secret notploy_postgres_password "$POSTGRES_PASSWORD"
    AUTH_SECRET="$(openssl rand -hex 32)"
    ensure_secret notploy_auth_secret "$AUTH_SECRET"
    echo "Secure database credentials and auth secret stored as Docker Secrets."

    create_notploy_postgres_service "$endpoint_mode"

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

    create_notploy_app_service "$endpoint_mode" "$product_env" "$DOCKER_IMAGE" "$release_tag_env"

    echo "Waiting for the 'notploy' service to converge (up to 180s)..."
    if wait_for_service_convergence notploy 180; then
        echo "Service 'notploy' converged."
    else
        echo "Error: the 'notploy' service did not converge within the timeout." >&2
        $SUDO_CMD docker service ps notploy --no-trunc >&2 2>/dev/null || true
        echo "Diagnose with: docker service ps notploy" >&2
        exit 1
    fi

    ensure_traefik_container

    GREEN="\033[0;32m"
    YELLOW="\033[1;33m"
    BLUE="\033[0;34m"
    NC="\033[0m"

    public_ip="${ADVERTISE_ADDR:-$(get_ip)}"
    private_ip=$(get_private_ip)
    formatted_addr=$(format_ip_for_url "$public_ip")
    echo ""
    printf "${GREEN}Congratulations, Notploy is installed and the service is running!${NC}\n"
    printf "${YELLOW}Please go to http://${formatted_addr}:3000${NC}\n"
    if [ -n "$private_ip" ] && [ "$private_ip" != "$public_ip" ]; then
        printf "${YELLOW}If you are on the same local network, use http://${private_ip}:3000${NC}\n"
    fi
    printf "\n"
}

# Updating is a distinct operation from installing. It verifies the target is a
# real Notploy installation, pulls the image, updates the service, and waits for
# a bounded convergence before reporting success. On failure it prints a recovery
# procedure; note that rolling back the image does NOT undo database migrations.
update_notploy() {
    require_elevation

    assert_docker_ready
    detect_notploy_installation
    if [ "$NOTPLOY_INSTALLED" != "1" ]; then
        echo "Error: no existing Notploy installation was found on this host." >&2
        echo "Run the installer without the 'update' action to install it first." >&2
        exit 1
    fi
    if ! service_exists notploy; then
        echo "Error: the 'notploy' service is missing, so it cannot be updated." >&2
        echo "This is not a standard Swarm install; repair or reinstall it manually." >&2
        exit 1
    fi

    VERSION_TAG="$(detect_version)"
    DOCKER_IMAGE="$(resolve_docker_image "$VERSION_TAG")"

    echo "Preparing to update Notploy to version: ${VERSION_TAG} (image: ${DOCKER_IMAGE})"
    echo "Existing service configuration, secrets, volumes and mounts are preserved."

    # Precondition: the image must be fetchable before the running service is
    # touched, so a registry failure leaves the installation untouched.
    if ! $SUDO_CMD docker pull "$DOCKER_IMAGE" >/dev/null 2>&1; then
        echo "Error: could not pull ${DOCKER_IMAGE}." >&2
        echo "Nothing was changed; the running version is untouched." >&2
        echo "Check the version tag and registry connectivity, then retry." >&2
        exit 1
    fi

    if ! $SUDO_CMD docker service update --image "$DOCKER_IMAGE" notploy >/dev/null 2>&1; then
        echo "Error: 'docker service update' failed." >&2
        echo "Recover with: docker service rollback notploy" >&2
        exit 1
    fi

    echo "Waiting for the 'notploy' service to converge (up to 180s)..."
    if wait_for_service_convergence notploy 180; then
        echo "Notploy has been updated to version: ${VERSION_TAG}."
    else
        echo "Error: the update did not converge to a running state within the timeout." >&2
        $SUDO_CMD docker service ps notploy --no-trunc >&2 2>/dev/null || true
        echo "Recovery: 'docker service rollback notploy'" >&2
        echo "Note: an image rollback does not undo database schema migrations;" >&2
        echo "check the release notes if the new version changed the schema." >&2
        exit 1
    fi
}

# When sourced (NOTPLOY_SOURCE_ONLY=1) only the definitions above are used.
if [ "${NOTPLOY_SOURCE_ONLY:-0}" != "1" ]; then
    detect_elevation
    if [ "$ACTION" = "update" ]; then
        update_notploy
    else
        install_notploy
    fi
fi
