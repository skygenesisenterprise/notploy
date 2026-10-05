DO $$
BEGIN
	CREATE TYPE "public"."dnsRecordType" AS ENUM('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR');
EXCEPTION
	WHEN duplicate_object THEN
		NULL;
END $$;--> statement-breakpoint
DO $$
DECLARE
	v_label text;
BEGIN
	FOREACH v_label IN ARRAY ARRAY['hetzner', 'digitalocean', 'gandi', 'vultr', 'linode', 'desec', 'bunny', 'ns1', 'godaddy', 'namecheap', 'cloudns', 'powerdns', 'bind', 'technitium', 'coredns', 'unbound', 'custom', 'notploy-internal'] LOOP
		IF NOT EXISTS (
			SELECT 1
			FROM pg_enum e
			JOIN pg_type t ON t.oid = e.enumtypid
			JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE n.nspname = 'public'
				AND t.typname = 'DnsProviderType'
				AND e.enumlabel = v_label
		) THEN
			EXECUTE format('ALTER TYPE "public"."DnsProviderType" ADD VALUE %L', v_label);
		END IF;
	END LOOP;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dns_record" (
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
CREATE TABLE IF NOT EXISTS "dns_zone" (
	"dnsZoneId" text PRIMARY KEY NOT NULL,
	"dnsProviderId" text NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'internal' NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'dns_record_dnsZoneId_dns_zone_dnsZoneId_fk'
			AND connamespace = 'public'::regnamespace
	) THEN
		ALTER TABLE "dns_record" ADD CONSTRAINT "dns_record_dnsZoneId_dns_zone_dnsZoneId_fk" FOREIGN KEY ("dnsZoneId") REFERENCES "public"."dns_zone"("dnsZoneId") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'dns_zone_dnsProviderId_dns_provider_dnsProviderId_fk'
			AND connamespace = 'public'::regnamespace
	) THEN
		ALTER TABLE "dns_zone" ADD CONSTRAINT "dns_zone_dnsProviderId_dns_provider_dnsProviderId_fk" FOREIGN KEY ("dnsProviderId") REFERENCES "public"."dns_provider"("dnsProviderId") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'dns_zone_organizationId_organization_id_fk'
			AND connamespace = 'public'::regnamespace
	) THEN
		ALTER TABLE "dns_zone" ADD CONSTRAINT "dns_zone_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dns_record_zone_name_type_content_idx" ON "dns_record" USING btree ("dnsZoneId","type","name","content");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dns_record_zone_idx" ON "dns_record" USING btree ("dnsZoneId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dns_zone_provider_name_idx" ON "dns_zone" USING btree ("dnsProviderId","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dns_zone_org_idx" ON "dns_zone" USING btree ("organizationId");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "enableEnterpriseFeatures";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "licenseKey";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "isValidEnterpriseLicense";