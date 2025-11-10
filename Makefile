.PHONY: help install dev build start clean docker-build docker-push lint format typecheck test db-setup db-migrate db-studio

# Variables
APP_NAME = dokploy
DOCKER_TAG = latest

help: ## Affiche cette aide
	@echo "Commandes disponibles:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Installe les dépendances
	pnpm install

dev: ## Démarre le serveur de développement
	cd apps/$(APP_NAME) && pnpm dev

dev-turbopack: ## Démarre le serveur de développement avec Turbopack
	cd apps/$(APP_NAME) && pnpm dev-turbopack

build: ## Build l'application
	pnpm --filter=$(APP_NAME) build

start: ## Démarre l'application en production
	cd apps/$(APP_NAME) && pnpm start

clean: ## Nettoie les fichiers de build
	rm -rf apps/$(APP_NAME)/dist
	rm -rf apps/$(APP_NAME)/.next

docker-build: ## Build l'image Docker
	docker build -t notploy:$(DOCKER_TAG) .

docker-push: ## Push l'image Docker
	docker push notploy:$(DOCKER_TAG)

lint: ## Lance le linter
	cd apps/$(APP_NAME) && pnpm lint

format: ## Formate le code
	cd apps/$(APP_NAME) && pnpm format

typecheck: ## Vérifie les types TypeScript
	cd apps/$(APP_NAME) && pnpm typecheck

check: ## Lance tous les checks (lint, format, typecheck)
	cd apps/$(APP_NAME) && pnpm check

test: ## Lance les tests
	cd apps/$(APP_NAME) && pnpm test

db-setup: ## Setup la base de données
	cd apps/$(APP_NAME) && pnpm setup

db-migrate: ## Lance les migrations
	cd apps/$(APP_NAME) && pnpm migration:run

db-generate: ## Génère les fichiers de migration
	cd apps/$(APP_NAME) && pnpm migration:generate

db-studio: ## Ouvre Drizzle Studio
	cd apps/$(APP_NAME) && pnpm studio

db-push: ## Push le schéma en base
	cd apps/$(APP_NAME) && pnpm db:push

db-seed: ## Alimente la base de données
	cd apps/$(APP_NAME) && pnpm db:seed

reset-password: ## Réinitialise un mot de passe
	cd apps/$(APP_NAME) && pnpm reset-password

reset-2fa: ## Réinitialise la 2FA
	cd apps/$(APP_NAME) && pnpm reset-2fa

version: ## Affiche la version actuelle
	cd apps/$(APP_NAME) && pnpm version

# Commandes pour les environnements
dev-env: copy-env install db-setup ## Configure l'environnement de développement complet

copy-env: ## Copie les fichiers d'exemple .env
	@if [ ! -f apps/$(APP_NAME)/.env ]; then \
		cp apps/$(APP_NAME)/.env.example apps/$(APP_NAME)/.env; \
		echo "Fichier .env copié depuis .env.example"; \
	fi
	@if [ ! -f .env.production ]; then \
		cp .env.production.example .env.production; \
		echo "Fichier .env.production copié depuis .env.production.example"; \
	fi

# Docker avancé
docker-build-canary: ## Build l'image Docker pour la branche canary
	$(MAKE) docker-build DOCKER_TAG=canary

docker-push-canary: ## Push l'image Docker canary
	$(MAKE) docker-push DOCKER_TAG=canary

# Développement rapide
quick-dev: install db-setup dev ## Installation et démarrage rapide pour le développement