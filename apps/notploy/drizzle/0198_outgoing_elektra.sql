CREATE TYPE "public"."dnsRecordType" AS ENUM('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR');--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'hetzner';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'digitalocean';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'gandi';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'vultr';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'linode';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'desec';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'bunny';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'ns1';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'godaddy';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'namecheap';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'cloudns';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'powerdns';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'bind';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'technitium';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'coredns';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'unbound';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'custom';--> statement-breakpoint
ALTER TYPE "public"."DnsProviderType" ADD VALUE 'notploy-internal';--> statement-breakpoint
CREATE TABLE "dns_record" (
	"dnsRecordId" text PRIMARY KEY NOT NULL,
	"dnsZoneId" text NOT NULL,
	"type" "dnsRecordType" NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"ttl" integer DEFAULT 300 NOT NULL,
	"ownership" text DEFAULT 'managed' NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_zone" (
	"dnsZoneId" text PRIMARY KEY NOT NULL,
	"dnsProviderId" text NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'internal' NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dns_record" ADD CONSTRAINT "dns_record_dnsZoneId_dns_zone_dnsZoneId_fk" FOREIGN KEY ("dnsZoneId") REFERENCES "public"."dns_zone"("dnsZoneId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dns_zone" ADD CONSTRAINT "dns_zone_dnsProviderId_dns_provider_dnsProviderId_fk" FOREIGN KEY ("dnsProviderId") REFERENCES "public"."dns_provider"("dnsProviderId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dns_zone" ADD CONSTRAINT "dns_zone_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dns_record_zone_name_type_content_idx" ON "dns_record" USING btree ("dnsZoneId","type","name","content");--> statement-breakpoint
CREATE INDEX "dns_record_zone_idx" ON "dns_record" USING btree ("dnsZoneId");--> statement-breakpoint
CREATE UNIQUE INDEX "dns_zone_provider_name_idx" ON "dns_zone" USING btree ("dnsProviderId","name");--> statement-breakpoint
CREATE INDEX "dns_zone_org_idx" ON "dns_zone" USING btree ("organizationId");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "enableEnterpriseFeatures";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "licenseKey";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "isValidEnterpriseLicense";