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
# FLAVOR=selfhosted (default) or FLAVOR=cloud; VERSION overrides the image tag.
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
	@echo "Examples:  make docker-up                 # self-hosted"
	@echo "           make docker-up FLAVOR=cloud   # cloud"
	@echo "           make docker-build VERSION=local"

# ---------------------------------------------------------------------------
# Local development (host toolchain)
# ---------------------------------------------------------------------------
install: ## Install workspace dependencies (pnpm install --frozen-lockfile)
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
# ---------------------------------------------------------------------------
docker-build: ## Build the Notploy image (FLAVOR=selfhosted|cloud, VERSION=<tag>)
	$(COMPOSE_ENV) $(COMPOSE) build

docker-up: ## Start the stack (http://localhost:3000)
	$(COMPOSE_ENV) $(COMPOSE) up -d

docker-down: ## Stop the stack (named volumes are preserved)
	$(COMPOSE) down

docker-restart: ## Restart the stack
	$(COMPOSE_ENV) $(COMPOSE) restart

docker-logs: ## Follow the stack logs
	$(COMPOSE) logs -f

docker-ps: ## Show stack status
	$(COMPOSE) ps

docker-config: ## Validate and print the resolved Compose configuration
	$(COMPOSE_ENV) $(COMPOSE) config

docker-dev: ## Run the containerized dev server with hot reload (http://localhost:3001)
	$(COMPOSE_ENV) $(COMPOSE) --profile dev up --watch notploy-dev

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove local build artifacts (.next, dist, tsbuildinfo)
	rm -rf apps/*/.next apps/*/dist packages/*/dist web/*/.next web/*/dist
	find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete
