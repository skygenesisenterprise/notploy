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
# The product (self | cloud | console) is deliberately NOT one of them: it can
# only be chosen with a make goal, never by editing this file or .env — see
# "Inline product flag" below. NOTPLOY_FLAVOR / NOTPLOY_PRODUCT / IS_CLOUD are
# derived from it and must not be set by hand.
NOTPLOY_VERSION ?= latest
NOTPLOY_REGISTRY ?= ghcr.io/skygenesisenterprise
# Protected products (cloud/console) need a signed entitlement.
NOTPLOY_ENTITLEMENT ?=
NOTPLOY_ENTITLEMENT_FILE ?=
NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE ?=

# --- Inline product flag ---------------------------------------------------
# Select the product for one invocation, without editing .env or exporting
# anything. Works with docker-build, docker-up and docker-dev:
#
#   make docker-build self       # self-hosted (default)
#   make docker-up -- --cloud    # cloud (requires a signed entitlement)
#   make docker-dev console      # console (requires a signed entitlement)
#
# GNU make itself rejects `make docker-dev --self` (`--self` is parsed as an
# unknown make option before any recipe runs), hence the `--` separator or the
# bare word. Each product maps to its Dockerfile target: self -> selfhosted,
# cloud -> cloud, console -> console.
#
# --- Remembered product ----------------------------------------------------
# `docker-build` records the product it built in PRODUCT_STATE, so the dev and
# prod flows stay equivalent:
#
#   make docker-build self   # build the self-hosted image
#   make docker-up           # start that self-hosted instance
#
# Precedence: inline product flag > the product recorded by the last
# docker-build > selfhosted. NOTPLOY_FLAVOR= / NOTPLOY_PRODUCT= passed by hand
# are rejected (see the warnings below): the flavor only follows the product.
PRODUCT_STATE := .make-product

GOAL_PRODUCT := $(firstword $(filter self cloud console,$(patsubst --%,%,$(MAKECMDGOALS))))

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
$(warning NOTPLOY_FLAVOR is derived from the product — use 'make <goal> self|cloud|console' instead; ignoring 'NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR)')
endif
ifneq ($(filter $(origin NOTPLOY_PRODUCT),command line environment),)
$(warning NOTPLOY_PRODUCT is derived from the product — use 'make <goal> self|cloud|console' instead; ignoring 'NOTPLOY_PRODUCT=$(NOTPLOY_PRODUCT)')
endif

override NOTPLOY_PRODUCT := $(SELECTED_PRODUCT)
# `override` so the selection cannot be bypassed by a command-line assignment:
# the flavor always stays in sync with the chosen product.
ifeq ($(SELECTED_PRODUCT),self)
override NOTPLOY_FLAVOR := selfhosted
else ifeq ($(SELECTED_PRODUCT),console)
override NOTPLOY_FLAVOR := console
else
override NOTPLOY_FLAVOR := cloud
endif

# Word form of the selected flavor, written to / read from PRODUCT_STATE.
ifeq ($(NOTPLOY_FLAVOR),cloud)
PRODUCT_WORD := cloud
else ifeq ($(NOTPLOY_FLAVOR),console)
PRODUCT_WORD := console
else
PRODUCT_WORD := self
endif

# Three modes: selfhosted (default, also spelled `self`), cloud and console.
# Cloud and console are protected products: they publish a cloud/console image
# and run with IS_CLOUD=true, and the PKI layer requires a signed entitlement.
ifeq ($(NOTPLOY_FLAVOR),cloud)
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy-cloud
override IS_CLOUD := true
else ifeq ($(NOTPLOY_FLAVOR),console)
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy-console
override IS_CLOUD := true
else
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy
override IS_CLOUD := false
endif

PNPM ?= pnpm
COMPOSE ?= docker compose

# Exported to every compose invocation so build target and image tag stay in
# sync with the selected flavor.
COMPOSE_ENV = NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR) NOTPLOY_IMAGE=$(NOTPLOY_IMAGE) NOTPLOY_VERSION=$(NOTPLOY_VERSION) IS_CLOUD=$(IS_CLOUD) \
	NOTPLOY_PRODUCT=$(NOTPLOY_PRODUCT) NOTPLOY_ENTITLEMENT=$(NOTPLOY_ENTITLEMENT) \
	NOTPLOY_ENTITLEMENT_FILE=$(NOTPLOY_ENTITLEMENT_FILE) NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE=$(NOTPLOY_ENTITLEMENT_PUBLIC_KEY_FILE)

.PHONY: help install dev build test typecheck lint \
        docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-config docker-dev \
        self cloud console --self --cloud --console \
        clean

# No-op goals that only carry the product flag (see GOAL_PRODUCT above). They
# exist so `make docker-build cloud` / `make docker-dev -- --self` have a rule
# to satisfy while the real target reads the product from MAKECMDGOALS.
self cloud console --self --cloud --console:
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
	@echo "Product:   $(PRODUCT_WORD)$$(test -f $(PRODUCT_STATE) && echo ' (saved by the last docker-build)')"
	@echo "Identity:  the container bootstraps the instance identity into the"
	@echo "           notploy-config volume at startup (self-hosted needs no network)."
	@echo "Examples:  make docker-build self             # build the self-hosted image"
	@echo "           make docker-up                     # start the product built above"
	@echo "           make docker-up cloud               # build + cloud on :3000"
	@echo "           make docker-up -- --console        # build + console on :3000"
	@echo "           make docker-build NOTPLOY_VERSION=local"
	@echo "           make docker-dev                    # dev, product of the last build"
	@echo "           make docker-dev self               # dev, self-hosted (default)"
	@echo "           make docker-dev console            # dev, console (needs entitlement)"

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
# `notploy` (production) and `notploy-dev` (development) both publish the
# dashboard on NOTPLOY_PORT (3000 by default): http://localhost:3000 in both
# modes. They share the port, so only one of them runs at a time — stop the
# other first with `make docker-down`.
# ---------------------------------------------------------------------------
# Both targets accept the inline product flag (self | cloud | console), the
# same way docker-dev does:
#
#   make docker-build            # self-hosted (default)
#   make docker-build cloud      # cloud image (needs entitlement at runtime)
#   make docker-up self          # build + start self-hosted
#   make docker-up -- --console  # build + start console
#
# docker-build records the product in PRODUCT_STATE, so the dev and prod flows
# are equivalent: `make docker-build self` followed by a plain `make docker-up`
# starts the self-hosted instance that was just built. docker-up depends on
# docker-build, so a single `make docker-up cloud` builds and starts cloud.
docker-build: ## Build the Notploy image (add: self | cloud | console, NOTPLOY_VERSION=<tag>)
	@echo "==> building product=$(PRODUCT_WORD) flavor=$(NOTPLOY_FLAVOR) image=$(NOTPLOY_IMAGE):$(NOTPLOY_VERSION)"
	$(COMPOSE_ENV) $(COMPOSE) build notploy
	@printf '%s\n' '$(PRODUCT_WORD)' > $(PRODUCT_STATE)

docker-up: docker-build ## Build then start the stack (add: self | cloud | console)
	@echo "==> starting product=$(PRODUCT_WORD) flavor=$(NOTPLOY_FLAVOR) image=$(NOTPLOY_IMAGE):$(NOTPLOY_VERSION)"
	$(COMPOSE_ENV) $(COMPOSE) up -d

# Stops whatever is actually running. Compose only removes the containers of the
# enabled profiles, so the dev profile has to be added as soon as a notploy-dev
# container exists — otherwise `docker compose down` leaves it running and fails
# to release the shared network ("Resource is still in use").
docker-down: ## Stop the running stack, dev container included (volumes are preserved)
	@if [ -n "$$($(COMPOSE) --profile dev ps -aq notploy-dev 2>/dev/null)" ]; then \
		echo "==> dev container found, stopping the whole stack"; \
		$(COMPOSE) --profile dev down --remove-orphans --timeout 15; \
	else \
		echo "==> no dev container, stopping the production stack"; \
		$(COMPOSE) down --remove-orphans --timeout 15; \
	fi

docker-restart: ## Restart the stack
	$(COMPOSE_ENV) $(COMPOSE) restart

docker-logs: ## Follow the stack logs
	$(COMPOSE) --profile dev logs -f

docker-ps: ## Show stack status
	$(COMPOSE) --profile dev ps -a

docker-config: ## Validate and print the resolved Compose configuration
	$(COMPOSE_ENV) $(COMPOSE) config

docker-dev: ## Run the containerized dev server with hot reload (http://localhost:3000)
	@# Recreate the dev container every run: reusing one whose network endpoint is
	@# stale makes the daemon fail with "Could not attach to network ... not found".
	@$(COMPOSE) --profile dev rm -sf notploy-dev >/dev/null 2>&1 || true
	$(COMPOSE_ENV) $(COMPOSE) --profile dev up --build --watch notploy-dev

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
	@$(COMPOSE_ENV) $(COMPOSE) up -d

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

update: ## Update to latest version (pull and rebuild/restart)
	@git pull
	@$(COMPOSE_ENV) $(COMPOSE) pull
	@$(COMPOSE_ENV) $(COMPOSE) up -d --build

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
