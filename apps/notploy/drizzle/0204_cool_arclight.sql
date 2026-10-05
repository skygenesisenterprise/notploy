CREATE TYPE "public"."ObjectStorageCategory" AS ENUM('external', 'self-hosted');--> statement-breakpoint
CREATE TYPE "public"."ObjectStorageProviderType" AS ENUM('aws', 'cloudflare-r2', 'scaleway', 'wasabi', 'digitalocean', 'backblaze', 'ovh', 'linode', 'storj', 'idrive', 'minio', 'rustfs', 'ceph', 'seaweedfs', 'garage', 's3-compatible');--> statement-breakpoint
CREATE TABLE "object_storage_bucket" (
	"objectStorageBucketId" text PRIMARY KEY NOT NULL,
	"objectStorageProviderId" text NOT NULL,
	"name" text NOT NULL,
	"bucket" text NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"endpoint" text DEFAULT '' NOT NULL,
	"versioning" boolean DEFAULT false NOT NULL,
	"lifecycle" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "object_storage_provider" (
	"objectStorageProviderId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"providerType" "ObjectStorageProviderType" NOT NULL,
	"category" "ObjectStorageCategory" NOT NULL,
	"config" jsonb NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "objectStorageBucketId" text;--> statement-breakpoint
ALTER TABLE "object_storage_bucket" ADD CONSTRAINT "object_storage_bucket_objectStorageProviderId_object_storage_provider_objectStorageProviderId_fk" FOREIGN KEY ("objectStorageProviderId") REFERENCES "public"."object_storage_provider"("objectStorageProviderId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_storage_bucket" ADD CONSTRAINT "object_storage_bucket_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_storage_provider" ADD CONSTRAINT "object_storage_provider_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "object_storage_bucket_provider_name_idx" ON "object_storage_bucket" USING btree ("objectStorageProviderId","bucket");--> statement-breakpoint
CREATE INDEX "object_storage_bucket_org_idx" ON "object_storage_bucket" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "object_storage_provider_org_name_idx" ON "object_storage_provider" USING btree ("organizationId","name");--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_objectStorageBucketId_object_storage_bucket_objectStorageBucketId_fk" FOREIGN KEY ("objectStorageBucketId") REFERENCES "public"."object_storage_bucket"("objectStorageBucketId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "object_storage_provider" (
	"objectStorageProviderId", "name", "providerType", "category", "config", "organizationId", "createdAt"
)
SELECT
	'osp_' || d."destinationId",
	d."name" || ' (' || left(d."destinationId", 6) || ')',
	(CASE d."provider"
		WHEN 'AWS' THEN 'aws'
		WHEN 'Cloudflare' THEN 'cloudflare-r2'
		WHEN 'Scaleway' THEN 'scaleway'
		WHEN 'Wasabi' THEN 'wasabi'
		WHEN 'DigitalOcean' THEN 'digitalocean'
		WHEN 'Backblaze' THEN 'backblaze'
		WHEN 'OVH' THEN 'ovh'
		WHEN 'Linode' THEN 'linode'
		WHEN 'Storj' THEN 'storj'
		WHEN 'IDrive' THEN 'idrive'
		WHEN 'Minio' THEN 'minio'
		WHEN 'Ceph' THEN 'ceph'
		WHEN 'SeaweedFS' THEN 'seaweedfs'
		ELSE 's3-compatible'
	END)::"ObjectStorageProviderType",
	(CASE d."provider"
		WHEN 'Minio' THEN 'self-hosted'
		WHEN 'Ceph' THEN 'self-hosted'
		WHEN 'SeaweedFS' THEN 'self-hosted'
		ELSE 'external'
	END)::"ObjectStorageCategory",
	jsonb_build_object(
		'endpoint', d."endpoint",
		'region', d."region",
		'accessKeyId', d."accessKey",
		'secretAccessKey', d."secretAccessKey",
		'pathStyle', true,
		'allowInsecureTls', false,
		'additionalFlags', to_jsonb(coalesce(d."additionalFlags", ARRAY[]::text[]))
	),
	d."organizationId",
	to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM "destination" d
WHERE d."objectStorageBucketId" IS NULL;
--> statement-breakpoint
INSERT INTO "object_storage_bucket" (
	"objectStorageBucketId", "objectStorageProviderId", "name", "bucket", "region", "endpoint", "versioning", "lifecycle", "organizationId", "createdAt"
)
SELECT
	'osb_' || d."destinationId",
	'osp_' || d."destinationId",
	d."name",
	d."bucket",
	d."region",
	d."endpoint",
	false,
	'[]'::jsonb,
	d."organizationId",
	to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM "destination" d
WHERE d."objectStorageBucketId" IS NULL;
--> statement-breakpoint
UPDATE "destination"
SET "objectStorageBucketId" = 'osb_' || "destinationId"
WHERE "objectStorageBucketId" IS NULL;
