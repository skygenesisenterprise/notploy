# Notploy GitHub App — development and operations tasks.
#
# All commands run from this directory (packages/github). Docker targets build
# from the repository root because the monorepo is a single pnpm workspace.

SHELL := /bin/bash

.DEFAULT_GOAL := help

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
dev: ## Rebuild on file changes
	pnpm run dev

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
# Docker (GitHub App service)
# ------------------------------------------------------------------

.PHONY: docker-build
docker-build: ## Build the notploy-github image (context is the repo root)
	docker build -f packages/github/Dockerfile -t notploy-github:local ..

.PHONY: docker-up
docker-up: ## Start the GitHub App service (requires a filled-in .env)
	docker compose --env-file .env up -d --build

.PHONY: docker-down
docker-down: ## Stop the GitHub App service
	docker compose down

.PHONY: docker-logs
docker-logs: ## Follow the service logs
	docker compose logs -f notploy-github

.PHONY: docker-restart
docker-restart: docker-down docker-up ## Restart the service with a fresh build

.PHONY: docker-clean
docker-clean: ## Remove the local image and stopped containers
	docker compose down --rmi local -v

# ------------------------------------------------------------------
# Help
# ------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'
