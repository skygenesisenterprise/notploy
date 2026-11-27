# Notploy — developer & operator interface.
#
# A thin layer over the tools that already exist in the repository (pnpm,
# docker, docker compose). No build or deployment logic is duplicated here:
# every target just calls the corresponding tool or package script.
#
#   make help

SHELL := /bin/bash
.DEFAULT_GOAL := help

# --- Selectable configuration ---------------------------------------------
# NOTPLOY_VERSION overrides the image tag, NOTPLOY_REGISTRY the registry.
# NOTPLOY_PORT is left unset on purpose so docker-compose.yml keeps resolving
# it from .env (or from the 3000 default); pass NOTPLOY_PORT=8080 to override.
#
# The edition (self | cloud) is deliberately NOT one of them: it can only be
# chosen with a make goal, never by editing this file or .env — see "Inline
# edition flag" below. NOTPLOY_FLAVOR / NOTPLOY_PRODUCT / IS_CLOUD are derived
# from it and must not be set by hand.
NOTPLOY_VERSION ?= latest
NOTPLOY_REGISTRY ?= ghcr.io/skygenesisenterprise
# The cloud edition needs a signed entitlement.
NOTPLOY_ENTITLEMENT ?=
NOTPLOY_ENTITLEMENT_FILE ?=
NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE ?=

# --- Inline edition flag ---------------------------------------------------
# Select the edition for one invocation, without editing .env or exporting
# anything. Works with docker-build, docker-up and docker-dev:
#
#   make docker-up -- --cloud    # cloud (requires a signed entitlement)
#   make docker-dev self         # self-hosted (default)
#
# GNU make itself rejects `make docker-dev --self` (`--self` is parsed as an
# unknown make option before any recipe runs), hence the `--` separator or the
# bare word. Each edition maps to its Dockerfile target: self -> selfhosted,
# cloud -> cloud.
#
# --- Remembered product ----------------------------------------------------
# Each build records the product in PRODUCT_STATE, so a later command reuses
# the product that was built last:
#
#   make docker-up self   # build a fresh image + start self-hosted
#   make docker-up        # start the product built last, without rebuilding
#   make docker-down      # stop the stack — the image is kept for the next start
#
# Precedence: inline edition flag > the edition recorded by the last build >
# selfhosted. NOTPLOY_FLAVOR= / NOTPLOY_PRODUCT= passed by hand are rejected
# (see the warnings below): the flavor only follows the edition.
PRODUCT_STATE := .make-product

# Editions: self (default) and cloud.
GOAL_PRODUCT := $(firstword $(filter self cloud,$(patsubst --%,%,$(MAKECMDGOALS))))

ifneq ($(GOAL_PRODUCT),)
SELECTED_PRODUCT := $(GOAL_PRODUCT)
else ifneq ($(wildcard $(PRODUCT_STATE)),)
SELECTED_PRODUCT := $(shell cat $(PRODUCT_STATE))
else
SELECTED_PRODUCT := self
endif

# NOTPLOY_FLAVOR / NOTPLOY_PRODUCT are derived below: refuse a direct
# assignment instead of silently running a product that was not selected.
ifneq ($(filter $(origin NOTPLOY_FLAVOR),command line environment),)
$(warning NOTPLOY_FLAVOR is derived from the edition — use 'make <goal> self|cloud' instead; ignoring 'NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR)')
endif
ifneq ($(filter $(origin NOTPLOY_PRODUCT),command line environment),)
$(warning NOTPLOY_PRODUCT is derived from the edition — use 'make <goal> self|cloud' instead; ignoring 'NOTPLOY_PRODUCT=$(NOTPLOY_PRODUCT)')
endif

override NOTPLOY_PRODUCT := $(SELECTED_PRODUCT)
# `override` so the selection cannot be bypassed by a command-line assignment:
# the flavor always stays in sync with the chosen edition.
ifeq ($(SELECTED_PRODUCT),self)
override NOTPLOY_FLAVOR := selfhosted
else
override NOTPLOY_FLAVOR := cloud
endif

# Word form of the selected edition, written to / read from PRODUCT_STATE.
ifeq ($(NOTPLOY_FLAVOR),cloud)
PRODUCT_WORD := cloud
else
PRODUCT_WORD := self
endif

# Two editions: self (default, flavor `selfhosted`) and cloud. Both run the
# SAME image: only the runtime environment changes. Cloud is a protected
# edition: it requires a signed entitlement through the PKI layer.
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy
ifeq ($(NOTPLOY_FLAVOR),cloud)
override IS_CLOUD := true
else
override IS_CLOUD := false
endif

PNPM ?= pnpm
COMPOSE ?= docker compose

# --- Host ports the stack publishes -----------------------------------------
# The container always listens on 53; only the host side differs per mode:
#   production (`notploy`)      -> NOTPLOY_DNS_HOST_PORT,     default 53
#   development (`notploy`) -> NOTPLOY_DNS_DEV_HOST_PORT, default 5300
# Port 53 is taken on most developer machines (systemd-resolved, dnsmasq or
# libvirt, Pi-hole) and publishing it aborts the whole stack before a single
# container starts: "Error starting userland proxy: listen tcp4 0.0.0.0:53:
# bind: address already in use". Hence 5300 for the dev stack.
#
# Make does not read .env (compose does): it only resolves the ports here to be
# able to warn *before* compose dies on a bind error. Precedence is the usual
# one — command line / environment, then .env, then the mode's default.
env-file-default = $(or $($(1)),$(shell sed -n 's/^[[:space:]]*$(1)[[:space:]]*=[[:space:]]*\([^#]*\).*/\1/p' .env 2>/dev/null | tail -n 1),$(2))

# Host ports of the control plane (Traefik, app, LAN DNS) for `up` and `dev`.
CHECK_PORTS_UP := $(call env-file-default,NOTPLOY_DNS_HOST_PORT,53) $(call env-file-default,NOTPLOY_PORT,3000) $(call env-file-default,NOTPLOY_API_PORT,4000) 80 443 8080
CHECK_PORTS_DEV := $(call env-file-default,NOTPLOY_DNS_DEV_HOST_PORT,5300) $(call env-file-default,NOTPLOY_PORT,3000) $(call env-file-default,NOTPLOY_API_PORT,4000) 80 443 8080

# One recipe line: report every port about to be published that something else
# already holds, with its owner — docker's own error does not say which port it
# was. Ports already published by a running container are ours (a stack being
# restarted) and stay silent. Every statement ends with `;` so the snippet stays
# valid whether $(shell)/recipe expansion keeps or joins its lines.
dns-ports-check = busy() { command -v ss >/dev/null 2>&1 && ss -lntu "sport = :$$1" 2>/dev/null | grep -Eq 'LISTEN|UNCONN'; }; for p in $(1); do if busy "$$p" && [ -z "$$(docker ps -q --filter publish=$$p 2>/dev/null)" ]; then echo "==> WARNING: host port $$p is already in use so the stack cannot start (owner: sudo ss -lntup | grep ':$$p')"; echo "    stop that service or override the port in .env — see the ports section of docker-compose.yml"; fi; done

# Exported to every compose invocation so build target and image tag stay in
# sync with the selected flavor.
COMPOSE_ENV = NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR) NOTPLOY_BUILD_TARGET=platform NOTPLOY_IMAGE=$(NOTPLOY_IMAGE) NOTPLOY_VERSION=$(NOTPLOY_VERSION) IS_CLOUD=$(IS_CLOUD) \
	NOTPLOY_PRODUCT=$(NOTPLOY_PRODUCT) NOTPLOY_ENTITLEMENT=$(NOTPLOY_ENTITLEMENT) \
	NOTPLOY_ENTITLEMENT_FILE=$(NOTPLOY_ENTITLEMENT_FILE) NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE=$(NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE)

# A legacy `notploy-traefik` created outside Compose (install.sh, or the app's
# own traefik-setup) carries no `com.docker.compose.project` label, yet it
# occupies the fixed `container_name: notploy-traefik` the Compose `traefik`
# service needs — so `docker compose up` aborts with "Conflict. The container
# name ... is already in use". Remove it, but only when no Compose label is
# present, so a Compose-managed traefik is left untouched.
CLEAN_EXTERNAL_TRAEFIK = [ -z "$$(docker ps -aq -f 'name=^notploy-traefik$$')" ] || docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' notploy-traefik 2>/dev/null | grep -q . || { echo "==> removing non-Compose notploy-traefik container"; docker rm -f notploy-traefik >/dev/null; }

# `notploy-network` is `external` in docker-compose.yml (it must not be deleted
# by `docker compose down` while deployed apps are attached to it), so Compose no
# longer creates it. Create it here — exactly like install.sh / the server setup
# — before starting the stack on a fresh host.
ENSURE_NETWORK = docker network inspect notploy-network >/dev/null 2>&1 || { echo "==> creating notploy-network"; docker network create --driver overlay --attachable notploy-network >/dev/null; }

# --- Compose selection --------------------------------------------------------
# `client` and `api` build the same image; building one is enough.
COMPOSE_BUILD_SERVICE := api
COMPOSE_UP_PROFILES := --profile prod
COMPOSE_UP_SERVICES :=
COMPOSE_DEV_PROFILES := --profile dev
COMPOSE_DEV_SERVICE := api client
# Dev is a MODE of the same image, not a second image name: same NOTPLOY_IMAGE,
# only the tag/version and the build target change.
# Dev-only Traefik hostnames (the prod routers keep their real host / an
# unresolvable fallback), and the browser-facing API origin for WebSockets.
# The host DNS port and the dev license bypass are resolved by make, not left
# as `${VAR:-default}` for the shell: make consumes `${...}` as its own
# variable reference (with an undefined name) and would pass an empty value,
# making Compose fall back to port 53. env-file-default also honours .env.
COMPOSE_DEV_ENV := NOTPLOY_VERSION=dev NOTPLOY_BUILD_TARGET=dev NOTPLOY_MODE=development NODE_ENV=development NOTPLOY_DNS_HOST_PORT=$(call env-file-default,NOTPLOY_DNS_DEV_HOST_PORT,5300) NOTPLOY_DEV_APP_HOST=app.notploy.localhost NOTPLOY_DEV_API_HOST=api.notploy.localhost NEXT_PUBLIC_API_URL=http://api.notploy.localhost NOTPLOY_TEMPLATES_DIR=/usr/src/app/templates/blueprints NOTPLOY_GATEWAY_ERRORS_IMAGE=$(NOTPLOY_IMAGE):dev NOTPLOY_GATEWAY_ERRORS_COMMAND='pnpm exec tsx /usr/src/app/packages/server/src/gateway-errors/entry.ts' NOTPLOY_GATEWAY_ERRORS_WORKDIR=/usr/src/app NOTPLOY_ALLOW_UNLICENSED_DEV=$(call env-file-default,NOTPLOY_ALLOW_UNLICENSED_DEV,1)
STACK_PREPARE = $(CLEAN_EXTERNAL_TRAEFIK) ; $(ENSURE_NETWORK)

.PHONY: help install dev build test typecheck lint \
        docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-config docker-dev \
        self cloud --self --cloud \
        status-seed \
        clean

# No-op goals that only carry the edition flag (see GOAL_PRODUCT above). They
# exist so `make docker-build cloud` / `make docker-dev -- --self` have a rule
# to satisfy while the real target reads the edition from MAKECMDGOALS.
self cloud --self --cloud:
	@:

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Show this help
	@echo "Notploy — available commands:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables: NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR) NOTPLOY_VERSION=$(NOTPLOY_VERSION) NOTPLOY_IMAGE=$(NOTPLOY_IMAGE)"
	@echo "           IS_CLOUD=$(IS_CLOUD) NOTPLOY_PRODUCT=$(PRODUCT_WORD) NOTPLOY_PORT=$${NOTPLOY_PORT:-3000}"
	@echo "Edition:   $(PRODUCT_WORD)$$(test -f $(PRODUCT_STATE) && echo ' (saved by the last build)')"
	@echo "Image:     $(NOTPLOY_IMAGE) (the same image in dev and prod; only the mode changes)."
	@echo "Identity:  the container bootstraps the instance identity into the"
	@echo "           notploy-config volume at startup (self-hosted needs no network)."
	@echo "Examples:  make docker-up self              # build a fresh image + start self-hosted"
	@echo "           make docker-up                   # restart the image built last, no rebuild"
	@echo "           make docker-up cloud             # same image, cloud mode (needs entitlement)"
	@echo "           make docker-build self           # rebuild only, without starting"
	@echo "           make docker-dev                   # dev mode, edition of the last build"
	@echo "           make docker-dev self              # dev mode, self-hosted (default)"
	@echo "           make docker-dev cloud             # dev mode, cloud (needs entitlement)"
	@echo "           make status-seed                  # create the Notploy status page + components"

# ---------------------------------------------------------------------------
# Local development (host toolchain)
# ---------------------------------------------------------------------------
deps: ## Install workspace dependencies (pnpm install --frozen-lockfile)
	$(PNPM) install --frozen-lockfile

dev: ## Run the app in development mode on the host (pnpm dev)
	$(PNPM) dev

build: ## Build the workspace (pnpm build)
	$(PNPM) build

test: ## Run the test suites (pnpm test)
	$(PNPM) test

typecheck: ## Type-check the workspace (pnpm typecheck)
	$(PNPM) typecheck

lint: ## Lint/format check (pnpm lint)
	$(PNPM) lint

# ---------------------------------------------------------------------------
# Docker (root Dockerfile + docker-compose.yml)
#
# `notploy` (production) and `notploy` (development) both publish the
# dashboard on NOTPLOY_PORT (3000 by default): http://localhost:3000 in both
# modes. They share the port, so only one of them runs at a time — stop the
# other first with `make docker-down`.
# ---------------------------------------------------------------------------
# Both targets accept the inline edition flag (self | cloud), the same way
# docker-dev does. Both editions build/run the SAME image name:
#
#   make docker-up self          # build a fresh image + start self-hosted
#   make docker-up -- --cloud    # same image, cloud mode (needs entitlement)
#
# Semantics: an inline edition flag means "build a new image", so `docker-up
# <edition>` always triggers docker-build (prefixed, full rebuild) before
# starting. A plain `make docker-up` never rebuilds: it restarts the stack
# with the image built previously (PRODUCT_STATE). `make docker-down` only
# removes the containers, the image stays, so the next plain `make docker-up`
# relaunches instantly. Use `make docker-build <edition>` to rebuild ignoring
# PRODUCT_STATE.
docker-build: ## Build the single image (add: self | cloud, NOTPLOY_VERSION=<tag>)
	@echo "==> building edition=$(PRODUCT_WORD) flavor=$(NOTPLOY_FLAVOR) image=$(NOTPLOY_IMAGE):$(NOTPLOY_VERSION)"
	$(COMPOSE_ENV) $(COMPOSE) build $(COMPOSE_BUILD_SERVICE)
	@printf '%s\n' '$(PRODUCT_WORD)' > $(PRODUCT_STATE)

docker-up: ## Start the stack (add: self | cloud to build a fresh image first)
	@echo "==> starting edition=$(PRODUCT_WORD) flavor=$(NOTPLOY_FLAVOR) image=$(NOTPLOY_IMAGE):$(NOTPLOY_VERSION)"
	@$(STACK_PREPARE)
	@$(call dns-ports-check,$(CHECK_PORTS_UP))
	$(COMPOSE_ENV) $(COMPOSE) $(COMPOSE_UP_PROFILES) up -d $(COMPOSE_UP_SERVICES)

ifneq ($(GOAL_PRODUCT),)
docker-up: docker-build
endif

# Stops whatever is actually running. Compose only removes the containers of the
# enabled profiles, so the dev profile has to be added as soon as a notploy
# container exists — otherwise `docker compose down` leaves it running and fails
# to release the shared network ("Resource is still in use").
docker-down: ## Stop the running stack, dev containers included (volumes are preserved)
	@if [ -n "$($(COMPOSE) --profile dev ps -aq api client 2>/dev/null)" ]; then \
		echo "==> dev container found, stopping the whole stack"; \
		$(COMPOSE) --profile dev down --remove-orphans --timeout 15; \
	else \
		echo "==> no dev container, stopping the production stack"; \
		$(COMPOSE) --profile prod down --remove-orphans --timeout 15; \
	fi

docker-restart: ## Restart the stack
	$(COMPOSE_ENV) $(COMPOSE) --profile prod --profile dev restart

docker-logs: ## Follow the stack logs
	$(COMPOSE) --profile prod --profile dev logs -f

docker-ps: ## Show stack status
	$(COMPOSE) --profile prod --profile dev ps -a

docker-config: ## Validate and print the resolved Compose configuration
	$(COMPOSE_ENV) $(COMPOSE) --profile prod --profile dev config

# ---------------------------------------------------------------------------
# Status catalog seeding is host-side only; no Docker service is managed here.
status-seed: ## Create the Notploy status page and its components (idempotent)
	$(PNPM) --filter @notploy/status run seed -- $(SEED_ARGS)

docker-dev: ## Run the containerized dev server with hot reload
	@# Recreate the dev container every run: reusing one whose network endpoint is
	@# stale makes the daemon fail with "Could not attach to network ... not found".
	@$(COMPOSE) $(COMPOSE_DEV_PROFILES) rm -sf $(COMPOSE_DEV_SERVICE) >/dev/null 2>&1 || true
	@$(STACK_PREPARE)
	@$(call dns-ports-check,$(CHECK_PORTS_DEV))
	$(COMPOSE_ENV) $(COMPOSE_DEV_ENV) $(COMPOSE) $(COMPOSE_DEV_PROFILES) up --build --watch $(COMPOSE_DEV_SERVICE)

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove local build artifacts (.next, dist, tsbuildinfo, saved product)
	rm -rf apps/*/.next apps/*/dist packages/*/dist web/*/.next web/*/dist
	find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete
	rm -f $(PRODUCT_STATE)

# ---------------------------------------------------------------------------
# Production/self-hosted installation targets
# ---------------------------------------------------------------------------
.PHONY: install-production install-server status logs restart start stop update doctor backup uninstall

install-production: ## Install Notploy using Docker Swarm (production-ready, multi-node support)
	@chmod +x scripts/install-production.sh
	@./scripts/install-production.sh

install: ## Install Notploy locally for development/self-hosted (docker compose)
	@chmod +x scripts/make-install-helper.sh
	@./scripts/make-install-helper.sh

# Server management targets for the compose setup
start: ## Start the stack
	@$(COMPOSE_ENV) $(COMPOSE) $(COMPOSE_UP_PROFILES) up -d $(COMPOSE_UP_SERVICES)

stop: ## Stop the stack
	@$(COMPOSE_ENV) $(COMPOSE) down --remove-orphans

restart: ## Restart the stack
	@$(COMPOSE_ENV) $(COMPOSE) restart

status: ## Show stack status
	@$(COMPOSE_ENV) $(COMPOSE) ps

logs: ## Follow logs (optionally: make logs SERVICE=notploy)
	@if [ -n "$(SERVICE)" ]; then \
		$(COMPOSE_ENV) $(COMPOSE) logs -f $(SERVICE); \
	else \
		$(COMPOSE_ENV) $(COMPOSE) logs -f; \
	fi

update: ## Update to the published image (use NOTPLOY_VERSION=<tag> to pin)
	@echo "==> updating edition=$(PRODUCT_WORD) image=$(NOTPLOY_IMAGE):$(NOTPLOY_VERSION)"
	@$(COMPOSE_ENV) $(COMPOSE) pull
	@$(COMPOSE_ENV) $(COMPOSE) $(COMPOSE_UP_PROFILES) up -d --remove-orphans $(COMPOSE_UP_SERVICES)

doctor: ## Check installation health
	@echo "Notploy Doctor"
	@echo "==============="
	@echo ""
	@echo "System:"
	@command -v docker >/dev/null 2>&1 && echo "✓ Docker" || echo "✗ Docker missing"
	@docker compose version >/dev/null 2>&1 && echo "✓ Docker Compose" || echo "✗ Docker Compose missing"
	@echo ""
	@echo "Configuration:"
	@test -f .env && echo "✓ .env exists" || echo "✗ .env missing"
	@echo ""
	@echo "Runtime:"
	@docker compose ps 2>&1 | tail -5
	@echo ""
	@echo "Storage:"
	@docker volume ls | grep notploy && echo "✓ Notploy volumes present" || echo "✗ No volumes found"

backup: ## Create backup of data volumes (not implemented yet)
	@echo "Backup functionality - requires tar/rsync"
	@echo "To backup manually:"
	@echo "  docker run --rm -v notploy-postgres-data:/data -v \$PWD:/backup alpine tar czf /backup/postgres-$(shell date +%Y%m%d_%H%M%S).tar.gz -C /data ."

uninstall: ## Remove Notploy (data preserved)
	@chmod +x scripts/cleanup.sh
	@./scripts/cleanup.sh
