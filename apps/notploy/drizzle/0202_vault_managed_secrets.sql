CREATE TABLE "vault_secret" (
	"vaultSecretId" text PRIMARY KEY NOT NULL,
	"vaultProviderId" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "vault_secret" ADD CONSTRAINT "vault_secret_vaultProviderId_vault_provider_vaultProviderId_fk" FOREIGN KEY ("vaultProviderId") REFERENCES "public"."vault_provider"("vaultProviderId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vault_secret_provider_name_idx" ON "vault_secret" USING btree ("vaultProviderId","name");
