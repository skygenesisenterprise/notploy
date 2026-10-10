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
# already exposes. Everything defaults to the universal port 3000 — dev and
# prod, website and docs:
#   website dev/prod http://localhost:3000   docs dev/prod http://localhost:3000
#
# One service at a time: docker-up is prod only (it clears the dev stack and
# the prod service of the other target), docker-dev is dev only (it clears
# both prod services). Nothing from the other mode can keep port 3000 busy —
# see the Docker section below.
#
# Want two services side by side? Give them distinct ports, which stops the
# cross-target removal (dev servers stay mutually exclusive either way):
#   make docker-up web DOCS_PORT=3003
TAG ?= latest
DEV_PORT ?= 3000
WEBSITE_PORT ?= 3000
DOCS_PORT ?= 3000

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
# Each build and each docker-dev run records the target in TARGET_STATE, so a
# later command reuses the target that was used last:
#
#   make docker-up web    # build a fresh image + start the website
#   make docker-up        # start the target used last, without rebuilding
#   make docker-dev       # dev server of the target used last
#   make docker-down      # stop the stack — the image is kept for the next start
#
# Precedence: inline target flag > the target recorded by the last run > web.
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

# With a single shared port, only one prod service can run: docker-up removes
# the prod service of the other target first. Different port values opt out of
# that removal so both prod services can coexist.
ifeq ($(WEBSITE_PORT),$(DOCS_PORT))
ifneq ($(SELECTED_TARGET),docs)
OTHER_PROD_SERVICE := docs-prod
else
OTHER_PROD_SERVICE := website-prod
endif
else
OTHER_PROD_SERVICE :=
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
	@echo "Target:    $(SELECTED_TARGET)$$(test -f $(TARGET_STATE) && echo ' (saved by the last run)')"
	@echo "Services:  prod=$(PROD_SERVICE) dev=$(DEV_SERVICE) image=$(TARGET_IMAGE):$(TAG)"
	@echo "Modes:     docker-up = prod only (clears the dev stack and the other prod target)"
	@echo "           docker-dev = dev only (clears both prod targets)"
	@echo "Ports:     everything on one port — dev=$(DEV_PORT)  website prod=$(WEBSITE_PORT)  docs prod=$(DOCS_PORT) (one at a time)"
	@echo "Examples:  make docker-up web              # build a fresh website image + start"
	@echo "           make docker-up docs             # build a fresh docs image + start"
	@echo "           make docker-up                  # restart the target used last, no rebuild"
	@echo "           make docker-dev docs            # docs dev server (http://localhost:$(DEV_PORT))"
	@echo "           make docker-build web           # rebuild only, without starting"
	@echo "           make docker-up web DOCS_PORT=3003   # run both prod targets side by side"

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
# One port, one service: dev and prod, website and docs, everything publishes
# on 3000 by default (DEV_PORT / WEBSITE_PORT / DOCS_PORT). Mode exclusivity
# makes that safe — each command owns its mode and clears whatever would hold
# the port before starting:
#
#   docker-up   prod only: removes website-dev, docs-dev and deps, then the
#               prod service of the other target (unless the ports differ),
#               then starts the selected prod service on its port.
#   docker-dev  dev only: removes website-prod and docs-prod, then starts the
#               selected dev server (and any stale one) on DEV_PORT.
# ---------------------------------------------------------------------------
# docker-up / docker-build accept the inline target flag (web | docs):
#
#   make docker-up web    # build a fresh image + start the website
#   make docker-up docs   # build a fresh image + start the docs
#
# An inline target flag means "build a new image", so `docker-up <target>`
# always triggers docker-build before starting. A plain `make docker-up` never
# rebuilds: it restarts the stack with the image used previously
# (TARGET_STATE). `make docker-down` only removes the containers; the image
# stays, so the next plain `make docker-up` relaunches instantly.
docker-build: ## Build the selected target image only (add: web | docs, TAG=<tag>)
	@echo "==> building target=$(SELECTED_TARGET) service=$(PROD_SERVICE) image=$(TARGET_IMAGE):$(TAG)"
	$(COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile prod build $(PROD_SERVICE)
	@printf '%s\n' '$(SELECTED_TARGET)' > $(TARGET_STATE)

docker-up: ## Start the selected target in prod mode (add: web | docs to build a fresh image first)
	@# prod only — stop every dev container first so it cannot hold the port.
	@$(COMPOSE) -f $(COMPOSE_FILE) --profile dev rm -sf website-dev docs-dev deps >/dev/null 2>&1 || true
ifneq ($(OTHER_PROD_SERVICE),)
	@# one prod service per port: free it from the other target first.
	@$(COMPOSE) -f $(COMPOSE_FILE) --profile prod rm -sf $(OTHER_PROD_SERVICE) >/dev/null 2>&1 || true
endif
	@echo "==> starting target=$(SELECTED_TARGET) service=$(PROD_SERVICE) port=$(TARGET_PORT) image=$(TARGET_IMAGE):$(TAG)"
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

docker-dev: ## Run the selected dev server in dev mode on http://localhost:3000 (add: web | docs)
	@# dev only — drop the prod containers first, they would keep the ports.
	@$(COMPOSE) -f $(COMPOSE_FILE) --profile prod rm -sf website-prod docs-prod >/dev/null 2>&1 || true
	@# web and docs share DEV_PORT, so make sure the other one (and a stale
	@# instance of this one) is gone before publishing the port.
	@$(COMPOSE) -f $(COMPOSE_FILE) --profile dev rm -sf website-dev docs-dev >/dev/null 2>&1 || true
	@# Remember the target now: the dev server runs in the foreground, so the
	@# recipe only returns once you stop it.
	@printf '%s\n' '$(SELECTED_TARGET)' > $(TARGET_STATE)
	$(DEV_COMPOSE_ENV) $(COMPOSE) -f $(COMPOSE_FILE) --profile dev up --build $(DEV_SERVICE)

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove local build artifacts (.next) and the saved target
	rm -rf apps/*/.next apps/*/dist
	find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete
	rm -f $(TARGET_STATE)
