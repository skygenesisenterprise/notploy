CREATE TYPE "public"."cloudDomainStatus" AS ENUM('pending', 'active', 'error', 'released');--> statement-breakpoint
CREATE TABLE "cloud_domain" (
	"cloudDomainId" text PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"label" text NOT NULL,
	"organizationId" text NOT NULL,
	"projectId" text,
	"environmentId" text,
	"applicationId" text,
	"domainId" text,
	"port" integer DEFAULT 3000,
	"status" "cloudDomainStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	"releasedAt" text
);
--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "cloudManaged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cloud_domain" ADD CONSTRAINT "cloud_domain_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_domain" ADD CONSTRAINT "cloud_domain_projectId_project_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("projectId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_domain" ADD CONSTRAINT "cloud_domain_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_domain" ADD CONSTRAINT "cloud_domain_applicationId_application_applicationId_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."application"("applicationId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_domain" ADD CONSTRAINT "cloud_domain_domainId_domain_domainId_fk" FOREIGN KEY ("domainId") REFERENCES "public"."domain"("domainId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cloud_domain_hostname_unique" ON "cloud_domain" USING btree ("hostname");--> statement-breakpoint
CREATE UNIQUE INDEX "cloud_domain_application_live_unique" ON "cloud_domain" USING btree ("applicationId") WHERE "cloud_domain"."status" <> 'released';--> statement-breakpoint
CREATE INDEX "cloud_domain_organization_idx" ON "cloud_domain" USING btree ("organizationId");