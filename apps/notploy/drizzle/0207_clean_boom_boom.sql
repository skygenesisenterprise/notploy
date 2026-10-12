CREATE TYPE "public"."trafficDeviceType" AS ENUM('desktop', 'mobile', 'tablet', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."trafficSourceStatus" AS ENUM('active', 'degraded', 'not-configured', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."trafficSourceType" AS ENUM('traefik', 'web-instrumentation', 'external');--> statement-breakpoint
CREATE TYPE "public"."trafficStatusClass" AS ENUM('2xx', '3xx', '4xx', '5xx', 'other');--> statement-breakpoint
CREATE TABLE "trafficAudienceAggregates" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"bucketStart" timestamp with time zone NOT NULL,
	"bucketSeconds" integer NOT NULL,
	"path" text NOT NULL,
	"referrerHost" text DEFAULT '' NOT NULL,
	"deviceType" "trafficDeviceType" DEFAULT 'unknown' NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trafficAudienceEvents" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"bucketStart" timestamp with time zone NOT NULL,
	"bucketSeconds" integer NOT NULL,
	"name" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trafficAudienceSessions" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"sessionId" text NOT NULL,
	"visitorId" text NOT NULL,
	"dayBucket" text NOT NULL,
	"startedAt" timestamp with time zone NOT NULL,
	"deviceType" "trafficDeviceType" DEFAULT 'unknown' NOT NULL,
	"referrerHost" text DEFAULT '' NOT NULL,
	"entryPath" text DEFAULT '/' NOT NULL,
	"pageviews" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trafficHttpAggregates" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"bucketStart" timestamp with time zone NOT NULL,
	"bucketSeconds" integer NOT NULL,
	"statusClass" "trafficStatusClass" NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"bytesIn" bigint DEFAULT 0 NOT NULL,
	"bytesOut" bigint DEFAULT 0 NOT NULL,
	"latencyCount" integer DEFAULT 0 NOT NULL,
	"latencyMsSum" bigint DEFAULT 0 NOT NULL,
	"latencyMsMax" integer DEFAULT 0 NOT NULL,
	"latencyBuckets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trafficHttpRoutes" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"dayStart" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"statusClass" "trafficStatusClass" NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"bytesIn" bigint DEFAULT 0 NOT NULL,
	"bytesOut" bigint DEFAULT 0 NOT NULL,
	"latencyMsSum" bigint DEFAULT 0 NOT NULL,
	"latencyMsMax" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trafficSources" (
	"id" text PRIMARY KEY NOT NULL,
	"propertyId" text NOT NULL,
	"type" "trafficSourceType" NOT NULL,
	"status" "trafficSourceStatus" DEFAULT 'not-configured' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"publicKey" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lastEventAt" timestamp with time zone,
	"lastAggregatedAt" timestamp with time zone,
	"lastError" text,
	"lastErrorAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webProperties" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"matchesSubdomains" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trafficAudienceAggregates" ADD CONSTRAINT "trafficAudienceAggregates_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trafficAudienceEvents" ADD CONSTRAINT "trafficAudienceEvents_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trafficAudienceSessions" ADD CONSTRAINT "trafficAudienceSessions_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trafficHttpAggregates" ADD CONSTRAINT "trafficHttpAggregates_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trafficHttpRoutes" ADD CONSTRAINT "trafficHttpRoutes_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trafficSources" ADD CONSTRAINT "trafficSources_propertyId_webProperties_id_fk" FOREIGN KEY ("propertyId") REFERENCES "public"."webProperties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webProperties" ADD CONSTRAINT "webProperties_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_audience_aggregate_key_idx" ON "trafficAudienceAggregates" USING btree ("propertyId","bucketStart","path","referrerHost","deviceType");--> statement-breakpoint
CREATE INDEX "traffic_audience_aggregate_time_idx" ON "trafficAudienceAggregates" USING btree ("propertyId","bucketStart");--> statement-breakpoint
CREATE INDEX "traffic_audience_aggregate_path_idx" ON "trafficAudienceAggregates" USING btree ("propertyId","path","bucketStart");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_audience_event_key_idx" ON "trafficAudienceEvents" USING btree ("propertyId","bucketStart","name");--> statement-breakpoint
CREATE INDEX "traffic_audience_event_time_idx" ON "trafficAudienceEvents" USING btree ("propertyId","bucketStart");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_audience_session_key_idx" ON "trafficAudienceSessions" USING btree ("propertyId","sessionId");--> statement-breakpoint
CREATE INDEX "traffic_audience_session_day_idx" ON "trafficAudienceSessions" USING btree ("propertyId","dayBucket");--> statement-breakpoint
CREATE INDEX "traffic_audience_session_visitor_idx" ON "trafficAudienceSessions" USING btree ("propertyId","visitorId","dayBucket");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_http_aggregate_key_idx" ON "trafficHttpAggregates" USING btree ("propertyId","bucketStart","statusClass");--> statement-breakpoint
CREATE INDEX "traffic_http_aggregate_time_idx" ON "trafficHttpAggregates" USING btree ("propertyId","bucketStart");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_http_route_key_idx" ON "trafficHttpRoutes" USING btree ("propertyId","dayStart","route","statusClass");--> statement-breakpoint
CREATE INDEX "traffic_http_route_rank_idx" ON "trafficHttpRoutes" USING btree ("propertyId","dayStart","route");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_sources_property_type_idx" ON "trafficSources" USING btree ("propertyId","type");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_sources_public_key_idx" ON "trafficSources" USING btree ("publicKey");--> statement-breakpoint
CREATE UNIQUE INDEX "web_properties_org_domain_idx" ON "webProperties" USING btree ("organizationId","domain");--> statement-breakpoint
CREATE INDEX "web_properties_org_platform_idx" ON "webProperties" USING btree ("organizationId","platform");