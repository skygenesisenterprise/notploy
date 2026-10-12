# Notploy Community Discord bot — development and operations tasks.
#
# All commands run from this directory (packages/discord). Docker targets build
# from the repository root because the monorepo is a single pnpm workspace.

SHELL := /bin/bash

.DEFAULT_GOAL := help

# Compose is run from this directory, so relative paths (context ../..) and the
# default `.env` resolution match docker-compose.yml.
COMPOSE ?= docker compose
DISCORD_IMAGE ?= ghcr.io/skygenesisenterprise/notploy-discord
NOTPLOY_VERSION ?= latest
COMPOSE_ENV = DISCORD_IMAGE=$(DISCORD_IMAGE) NOTPLOY_VERSION=$(NOTPLOY_VERSION)

# ------------------------------------------------------------------
# Local development
# ------------------------------------------------------------------

.PHONY: install
install: ## Install workspace dependencies from the repository root
	pnpm install --frozen-lockfile

.PHONY: build
build: ## Compile the package with tsc
	pnpm run build

.PHONY: dev
dev: ## Run the bot in watch mode (requires a filled-in .env)
	pnpm run dev

.PHONY: start
start: ## Run the compiled bot (requires `make build` first)
	pnpm run start

.PHONY: register
register: ## Register the slash commands with Discord
	pnpm run commands:register

.PHONY: test
test: ## Run the test suite once
	pnpm run test

.PHONY: test-watch
test-watch: ## Run the test suite in watch mode
	pnpm run test:watch

.PHONY: lint
lint: ## Run Biome checks
	pnpm run lint

.PHONY: lint-fix
lint-fix: ## Run Biome checks and fix issues
	pnpm run lint:fix

.PHONY: typecheck
typecheck: ## Type-check without emitting
	pnpm run typecheck

.PHONY: check
check: lint typecheck test ## Full local gate: lint + typecheck + tests

# ------------------------------------------------------------------
# Docker (community bot)
# ------------------------------------------------------------------

.PHONY: docker-build
docker-build: ## Build the notploy-discord image (context is the repo root)
	$(COMPOSE_ENV) $(COMPOSE) build notploy-discord

.PHONY: docker-up
docker-up: ## Start the bot (builds if needed; requires a filled-in .env)
	$(COMPOSE_ENV) $(COMPOSE) up -d --build notploy-discord

.PHONY: docker-down
docker-down: ## Stop the bot
	$(COMPOSE) down --remove-orphans

.PHONY: docker-logs
docker-logs: ## Follow the bot logs
	$(COMPOSE) logs -f notploy-discord

.PHONY: docker-ps
docker-ps: ## Show the stack status
	$(COMPOSE) --profile dev ps -a

.PHONY: docker-config
docker-config: ## Validate and print the resolved Compose configuration
	$(COMPOSE_ENV) $(COMPOSE) config

.PHONY: docker-dev
docker-dev: ## Run the bot with hot reload (bind-mounts the package sources)
	$(COMPOSE_ENV) $(COMPOSE) --profile dev up --build --watch notploy-discord-dev

.PHONY: docker-restart
docker-restart: docker-down docker-up ## Restart the bot with a fresh build

.PHONY: docker-clean
docker-clean: ## Remove the local image and stopped containers
	$(COMPOSE) down --rmi local -v --remove-orphans

# ------------------------------------------------------------------
# Help
# ------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'
