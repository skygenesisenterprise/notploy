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
            update) ACTION="update" ;;
            -h|--help)
                echo "Usage: install.sh [--self|--cloud|--console] [--force-identity] [update]"
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

        openssl x509 -req -in "$dir/instance.csr" \
            -CA "$dir/ca.crt" -CAkey "$dir/ca.key" -CAcreateserial \
            -days "$INSTANCE_VALIDITY_DAYS" -sha256 \
            -extfile <(cat <<EXT
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth,serverAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EXT
            ) -out "$dir/instance.crt" >/dev/null 2>&1 || {
            echo "Error: failed to sign the instance certificate" >&2
            exit 1
        }
        chmod 644 "$dir/instance.crt"
        rm -f "$dir/instance.csr" "$dir/ca.srl"

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
    VERSION_TAG=$(detect_version)
    # For self-hosted app image, the tag is typically vX.Y.Z-app, but we need to handle the image
    # Based on docker-publish.yml, for -app suffix, the image is 'notploy'
    if [[ "$VERSION_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}-app"
    elif [[ "$VERSION_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-app$ ]]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}"
    elif [ "$VERSION_TAG" = "latest" ]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:latest"
    else
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}"
    fi
    
    echo "Installing Notploy version: ${VERSION_TAG}"
    if [ "$(id -u)" != "0" ]; then
        echo "This script must be run as root" >&2
        exit 1
    fi

    if [ "$(uname)" = "Darwin" ]; then
        echo "This script must be run on Linux" >&2
        exit 1
    fi

    if [ -f /.dockerenv ]; then
        echo "This script must be run on Linux" >&2
        exit 1
    fi

    if ss -tulnp | grep ':80 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 80" >&2
        exit 1
    fi

    if ss -tulnp | grep ':443 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 443" >&2
        exit 1
    fi

    if ss -tulnp | grep ':3000 ' >/dev/null 2>&1; then
        echo "Error: something is already running on port 3000" >&2
        echo "Notploy requires port 3000 to be available. Please stop any service using this port." >&2
        exit 1
    fi

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
    if [[ "$VERSION_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}-app"
    elif [[ "$VERSION_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-app$ ]]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}"
    elif [ "$VERSION_TAG" = "latest" ]; then
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:latest"
    else
        DOCKER_IMAGE="ghcr.io/skygenesisenterprise/notploy:${VERSION_TAG}"
    fi

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
