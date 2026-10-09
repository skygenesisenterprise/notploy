# Notploy web frontends — website & docs, developer interface.
#
# A thin layer over the tools that already exist in this directory (pnpm,
# docker, docker compose). No build logic is duplicated here: every target
# just calls the corresponding tool or package script.
#
#   make help

SHELL := /bin/bash
.DEFAULT_GOAL := help

# --- Selectable configuration ---------------------------------------------
# TAG overrides the image tag; the ports let you remap what the Compose file
# already exposes (see docker-compose.yml for the defaults):
#   website prod http://localhost:3000  docs prod http://localhost:3003
#
# Dev servers are different on purpose: web and docs are never run together,
# so both are published on the same DEV_PORT (3000) and only the selected one
# is started (see docker-dev). This way `make docker-dev web` and
# `make docker-dev docs` both answer on http://localhost:3000.
TAG ?= latest
DEV_PORT ?= 3000
WEBSITE_PORT ?= 3000
DOCS_PORT ?= 3003

# --- Inline target flag ----------------------------------------------------
# Choose what to run for one invocation, without editing anything:
#
#   make docker-up web     # website (prod)
#   make docker-up docs    # docs (prod)
#   make docker-dev docs   # docs dev server, with hot reload
#
# The bare word (web | docs) is what selects the target; each maps to the
# matching Compose service pair (website-* / docs-*).
#
# --- Remembered target -----------------------------------------------------
# Each build records the target in TARGET_STATE, so a later command reuses the
# target that was built last:
#
#   make docker-up web    # build a fresh image + start the website
#   make docker-up        # start the target built last, without rebuilding
#   make docker-down      # stop the stack — the image is kept for the next start
#
# Precedence: inline target flag > the target recorded by the last build > web.
TARGET_STATE := .make-target

GOAL_TARGET := $(firstword $(filter web docs,$(MAKECMDGOALS)))

ifneq ($(GOAL_TARGET),)
SELECTED_TARGET := $(GOAL_TARGET)
else ifneq ($(wildcard $(TARGET_STATE)),)
SELECTED_TARGET := $(shell cat $(TARGET_STATE))
else
SELECTED_TARGET := web
endif

# Resolve the target to its Compose services and host script name.
ifeq ($(SELECTED_TARGET),docs)
PROD_SERVICE := docs-prod
DEV_SERVICE := docs-dev
TARGET_IMAGE := notploy/docs
TARGET_SCRIPT := docs
TARGET_PORT := $(DOCS_PORT)
else
PROD_SERVICE := website-prod
DEV_SERVICE := website-dev
TARGET_IMAGE := notploy/website
TARGET_SCRIPT := website
TARGET_PORT := $(WEBSITE_PORT)
endif

# Both dev services are published on DEV_PORT; the non-selected one keeps its
# compose default, but is not started anyway.
ifeq ($(SELECTED_TARGET),docs)
DEV_PORT_ENV := WEBSITE_DEV_PORT=3001 DOCS_DEV_PORT=$(DEV_PORT)
else
DEV_PORT_ENV := WEBSITE_DEV_PORT=$(DEV_PORT) DOCS_DEV_PORT=3002
endif

PNPM ?= pnpm
COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml

# Exported to every compose invocation so the tag and ports stay in sync with
# the selected target.
COMPOSE_ENV = TAG=$(TAG) WEBSITE_DEV_PORT=3001 DOCS_DEV_PORT=3002 \
	WEBSITE_PORT=$(WEBSITE_PORT) DOCS_PORT=$(DOCS_PORT)
DEV_COMPOSE_ENV = TAG=$(TAG) $(DEV_PORT_ENV) \
	WEBSITE_PORT=$(WEBSITE_PORT) DOCS_PORT=$(DOCS_PORT)

.PHONY: help dev build typecheck format \
        docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-config docker-dev \
        web docs \
        clean

# No-op goals that only carry the target flag (see GOAL_TARGET above). They
# exist so `make docker-up docs` has a rule to satisfy while the real target
# reads the target from MAKECMDGOALS.
web docs:
	@:

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Show this help
	@echo "Notploy web — available commands:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Target:    $(SELECTED_TARGET)$$(test -f $(TARGET_STATE) && echo ' (saved by the last build)')"
	@echo "Services:  prod=$(PROD_SERVICE) dev=$(DEV_SERVICE) image=$(TARGET_IMAGE):$(TAG)"
	@echo "Ports:     website prod=$(WEBSITE_PORT)  docs prod=$(DOCS_PORT)  dev=$(DEV_PORT) (one at a time)"
	@echo "Examples:  make docker-up web              # build a fresh website image + start"
	@echo "           make docker-up docs             # build a fresh docs image + start"
	@echo "           make docker-up                  # restart the target built last, no rebuild"
	@echo "           make docker-dev docs            # docs dev server (http://localhost:$(DEV_PORT))"
	@echo "           make docker-build web           # rebuild only, without starting"

# ---------------------------------------------------------------------------
# Local development (host toolchain)
# ---------------------------------------------------------------------------
dev: ## Run the selected target in development on the host (add: web | docs)
	$(PNPM) $(TARGET_SCRIPT):dev

build: ## Build the selected target on the host (add: web | docs)
	$(PNPM) $(TARGET_SCRIPT):build

typecheck: ## Type-check both frontends (pnpm typecheck)
	$(PNPM) typecheck

format: ## Format sources with Prettier (pnpm format)
	$(PNPM) format

# ---------------------------------------------------------------------------
# Docker (web/Dockerfile.website + web/Dockerfile.docs, docker-compose.yml)
#
# Both prod services publish on their own port (website 3000, docs 3003), so
# they can run at the same time. Dev servers are mutually exclusive: they share
# DEV_PORT (3000) and docker-dev starts only the selected one.
# ---------------------------------------------------------------------------
# docker-up / docker-build accept the inline target flag (web | docs):
#
#   make docker-up web    # build a fresh image + start the website
#   make docker-up docs   # build a fresh image + start the docs
#
# An inline target flag means "build a new image", so `docker-up <target>`
# always triggers docker-build before starting. A plain `make docker-up` never
# rebuilds: it restarts the stack with the image built previously
# (TARGET_STATE). `make docker-down` only removes the containers; the image
# stays, so the next plain `make docker-up` relaunches instantly.
docker-build: ## Build the selected target image only (add: web | docs, TAG=<tag>)
	@echo "==> building target=$(SELECTED_TARGET) service=$(PROD_SERVICE) image=$(TARGET_IMAGE):$(TAG)"
	$(COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile prod build $(PROD_SERVICE)
	@printf '%s\n' '$(SELECTED_TARGET)' > $(TARGET_STATE)

docker-up: ## Start the selected target (add: web | docs to build a fresh image first)
	@echo "==> starting target=$(SELECTED_TARGET) service=$(PROD_SERVICE) image=$(TARGET_IMAGE):$(TAG)"
	$(COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile prod up -d $(PROD_SERVICE)

ifneq ($(GOAL_TARGET),)
docker-up: docker-build
endif

docker-down: ## Stop the running stack, dev containers included (images are preserved)
	$(COMPOSE) -f $(COMPOSE_FILE) --profile prod --profile dev down --remove-orphans --timeout 15

docker-restart: ## Restart the selected target (prod)
	$(COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile prod restart $(PROD_SERVICE)

docker-logs: ## Follow the selected target logs
	$(COMPOSE) -f $(COMPOSE_FILE) --profile prod --profile dev logs -f $(PROD_SERVICE) $(DEV_SERVICE)

docker-ps: ## Show stack status
	$(COMPOSE) -f $(COMPOSE_FILE) --profile prod --profile dev ps -a

docker-config: ## Validate and print the resolved Compose configuration
	$(COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile prod --profile dev config

docker-dev: ## Run the selected dev server on http://localhost:3000 (add: web | docs)
	@# web and docs share DEV_PORT, so make sure the other one (and a stale
	@# instance of this one) is gone before publishing the port.
	@$(COMPOSE) -f $(COMPOSE_FILE) --profile dev rm -sf website-dev docs-dev >/dev/null 2>&1 || true
	$(DEV_COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile dev up --build $(DEV_SERVICE)

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove local build artifacts (.next) and the saved target
	rm -rf apps/*/.next apps/*/dist
	find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete
	rm -f $(TARGET_STATE)
