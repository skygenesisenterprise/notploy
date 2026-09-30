#!/usr/bin/env bash
#
# Installs the tooling Notploy needs at runtime to drive the host Docker Engine
# and to build/deploy applications (docker CLI, nixpacks, railpack, plus the few
# system utilities the deployment pipeline shells out to).
#
# Shared by the `dev` and `selfhosted` stages of the Dockerfile so both flavours
# expose exactly the same commands — a dev container without the docker CLI
# makes every Docker page (containers, images, volumes, events, disk usage)
# fail with `docker: not found`.
#
# Run as root inside a Debian-based image. Not meant to be executed on a host.
set -euo pipefail

DOCKER_VERSION="${DOCKER_VERSION:-28.5.2}"
NIXPACKS_VERSION="${NIXPACKS_VERSION:-1.41.0}"
RAILPACK_VERSION="${RAILPACK_VERSION:-0.15.4}"

log() { printf '[tooling] %s\n' "$*"; }

log "installing system packages"
apt-get update
apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	git-lfs \
	iproute2 \
	rsync
git lfs install
rm -rf /var/lib/apt/lists/*

# The docker CLI talks to the host engine through the mounted socket; the daemon
# itself is never started inside the container.
log "installing the docker CLI (${DOCKER_VERSION})"
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sh /tmp/get-docker.sh --version "${DOCKER_VERSION}"
rm -f /tmp/get-docker.sh

log "installing nixpacks (${NIXPACKS_VERSION})"
curl -sSL https://nixpacks.com/install.sh -o /tmp/nixpacks-install.sh
chmod +x /tmp/nixpacks-install.sh
/tmp/nixpacks-install.sh
rm -f /tmp/nixpacks-install.sh

log "installing railpack (${RAILPACK_VERSION})"
curl -sSL https://railpack.com/install.sh | bash

log "done"
