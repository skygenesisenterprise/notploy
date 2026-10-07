CREATE TYPE "public"."NetworkProviderType" AS ENUM('docker', 'wireguard', 'tailscale', 'openvpn', 'custom');--> statement-breakpoint
CREATE TABLE "network_peer" (
	"networkPeerId" text PRIMARY KEY NOT NULL,
	"networkProviderId" text NOT NULL,
	"name" text NOT NULL,
	"serverId" text,
	"address" text NOT NULL,
	"publicKey" text,
	"endpoint" text,
	"allowedIps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_provider" (
	"networkProviderId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"providerType" "NetworkProviderType" NOT NULL,
	"config" jsonb NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "isolatedNetwork" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "network" ADD COLUMN "networkProviderId" text;--> statement-breakpoint
ALTER TABLE "network_peer" ADD CONSTRAINT "network_peer_networkProviderId_network_provider_networkProviderId_fk" FOREIGN KEY ("networkProviderId") REFERENCES "public"."network_provider"("networkProviderId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_peer" ADD CONSTRAINT "network_peer_serverId_server_serverId_fk" FOREIGN KEY ("serverId") REFERENCES "public"."server"("serverId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_peer" ADD CONSTRAINT "network_peer_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_provider" ADD CONSTRAINT "network_provider_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "network_peer_provider_address_idx" ON "network_peer" USING btree ("networkProviderId","address");--> statement-breakpoint
CREATE INDEX "network_peer_provider_idx" ON "network_peer" USING btree ("networkProviderId");--> statement-breakpoint
CREATE UNIQUE INDEX "network_provider_org_name_idx" ON "network_provider" USING btree ("organizationId","name");--> statement-breakpoint
ALTER TABLE "network" ADD CONSTRAINT "network_networkProviderId_network_provider_networkProviderId_fk" FOREIGN KEY ("networkProviderId") REFERENCES "public"."network_provider"("networkProviderId") ON DELETE set null ON UPDATE no action;