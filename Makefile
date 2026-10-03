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
# NOTPLOY_FLAVOR=selfhosted (default) or NOTPLOY_FLAVOR=cloud;
# NOTPLOY_VERSION overrides the image tag.
# NOTPLOY_PORT is left unset on purpose so docker-compose.yml keeps resolving
# it from .env (or from the 3000 default); pass NOTPLOY_PORT=8080 to override.
NOTPLOY_FLAVOR ?= selfhosted
NOTPLOY_VERSION ?= latest
NOTPLOY_REGISTRY ?= ghcr.io/skygenesisenterprise

ifeq ($(NOTPLOY_FLAVOR),cloud)
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy-cloud
IS_CLOUD ?= true
else
NOTPLOY_IMAGE ?= $(NOTPLOY_REGISTRY)/notploy
IS_CLOUD ?= false
endif

PNPM ?= pnpm
COMPOSE ?= docker compose

# Exported to every compose invocation so build target and image tag stay in
# sync with the selected flavor.
COMPOSE_ENV = NOTPLOY_FLAVOR=$(NOTPLOY_FLAVOR) NOTPLOY_IMAGE=$(NOTPLOY_IMAGE) NOTPLOY_VERSION=$(NOTPLOY_VERSION) IS_CLOUD=$(IS_CLOUD)

.PHONY: help install dev build test typecheck lint \
        docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-config docker-dev \
        clean

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
	@echo "           IS_CLOUD=$(IS_CLOUD) NOTPLOY_PORT=$${NOTPLOY_PORT:-3000}"
	@echo "Examples:  make docker-up                      # self-hosted on :3000"
	@echo "           make docker-up NOTPLOY_FLAVOR=cloud  # cloud on :3000"
	@echo "           make docker-dev                     # dev (hot reload) on :3000"
	@echo "           make docker-build NOTPLOY_VERSION=local"

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
docker-build: ## Build the Notploy image (NOTPLOY_FLAVOR=selfhosted|cloud, NOTPLOY_VERSION=<tag>)
	$(COMPOSE_ENV) $(COMPOSE) build

docker-up: ## Start the stack in production mode (http://localhost:3000)
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
clean: ## Remove local build artifacts (.next, dist, tsbuildinfo)
	rm -rf apps/*/.next apps/*/dist packages/*/dist web/*/.next web/*/dist
	find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete

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
