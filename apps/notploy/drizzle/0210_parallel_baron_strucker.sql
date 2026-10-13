CREATE TYPE "public"."RegistryAuthMethod" AS ENUM('none', 'basic', 'token');--> statement-breakpoint
CREATE TYPE "public"."RegistryCredentialSource" AS ENUM('secret', 'inline');--> statement-breakpoint
CREATE TYPE "public"."RegistryProviderType" AS ENUM('docker-hub', 'ghcr', 'gitlab', 'ecr', 'gar', 'acr', 'quay', 'artifactory', 'harbor', 'zot', 'distribution', 'nexus', 'generic-oci');--> statement-breakpoint
ALTER TABLE "registry" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "providerType" "RegistryProviderType" DEFAULT 'generic-oci' NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "namespace" text;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "authMethod" "RegistryAuthMethod" DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "credentialSource" "RegistryCredentialSource" DEFAULT 'inline' NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "vaultSecretId" text;--> statement-breakpoint
ALTER TABLE "registry" ADD COLUMN "allowAnonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registry" ADD CONSTRAINT "registry_vaultSecretId_vault_secret_vaultSecretId_fk" FOREIGN KEY ("vaultSecretId") REFERENCES "public"."vault_secret"("vaultSecretId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Registries created before the OCI redesign only carried a URL, so their
-- provider is deduced from the endpoint they already point at. Anything
-- unrecognised keeps the generic OCI path, which speaks to them all the same.
UPDATE "registry" SET "providerType" = CASE
	WHEN "registryUrl" = '' OR "registryUrl" ILIKE '%docker.io%' OR "registryUrl" ILIKE '%docker.com%' THEN 'docker-hub'
	WHEN "registryUrl" ILIKE '%ghcr.io%' THEN 'ghcr'
	WHEN "registryUrl" ILIKE '%gitlab%' THEN 'gitlab'
	WHEN "registryUrl" ILIKE '%dkr.ecr.%' THEN 'ecr'
	WHEN "registryUrl" ILIKE '%-docker.pkg.dev%' OR "registryUrl" ILIKE '%gcr.io%' THEN 'gar'
	WHEN "registryUrl" ILIKE '%azurecr.io%' THEN 'acr'
	WHEN "registryUrl" ILIKE '%quay.io%' THEN 'quay'
	WHEN "registryUrl" ILIKE '%artifactory%' OR "registryUrl" ILIKE '%jfrog%' THEN 'artifactory'
	WHEN "registryUrl" ILIKE '%harbor%' THEN 'harbor'
	WHEN "registryUrl" ILIKE '%nexus%' THEN 'nexus'
	ELSE 'generic-oci'
END::"RegistryProviderType";--> statement-breakpoint
-- A registry stored without credentials was reaching its endpoint anonymously.
UPDATE "registry" SET "authMethod" = 'none'
	WHERE coalesce("username", '') = '' AND coalesce("password", '') = '';