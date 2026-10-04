CREATE TYPE "public"."operationalEventCategory" AS ENUM('deployment', 'server', 'monitoring', 'dns', 'tls', 'secrets', 'git-provider', 'security', 'system');--> statement-breakpoint
CREATE TYPE "public"."operationalEventSeverity" AS ENUM('critical', 'warning', 'info', 'success');--> statement-breakpoint
CREATE TABLE "operational_event" (
	"eventId" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"category" "operationalEventCategory" NOT NULL,
	"severity" "operationalEventSeverity" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"fingerprint" text NOT NULL,
	"resourceType" text,
	"resourceId" text,
	"resourceName" text,
	"resourceHref" text,
	"requiresAction" boolean DEFAULT false NOT NULL,
	"acknowledgedAt" text,
	"resolvedAt" text,
	"occurrenceCount" integer DEFAULT 1 NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	"lastSeenAt" text NOT NULL
);--> statement-breakpoint
ALTER TABLE "operational_event" ADD CONSTRAINT "operational_event_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_event_org_fingerprint_idx" ON "operational_event" USING btree ("organizationId", "fingerprint");--> statement-breakpoint
CREATE INDEX "operational_event_org_recent_idx" ON "operational_event" USING btree ("organizationId", "lastSeenAt");--> statement-breakpoint
CREATE INDEX "operational_event_org_action_idx" ON "operational_event" USING btree ("organizationId", "requiresAction", "acknowledgedAt", "resolvedAt");
