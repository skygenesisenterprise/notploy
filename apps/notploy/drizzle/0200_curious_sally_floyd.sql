CREATE TYPE "public"."cicdProvider" AS ENUM('github', 'gitlab', 'bitbucket', 'gitea', 'generic');--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'gcp';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'oci';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'onepassword';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'vaultwarden';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'kubernetes';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'docker';--> statement-breakpoint
ALTER TYPE "public"."VaultProviderType" ADD VALUE 'generic';--> statement-breakpoint
CREATE TABLE "cicd_deployment" (
	"cicdDeploymentId" text PRIMARY KEY NOT NULL,
	"deploymentId" text NOT NULL,
	"organizationId" text NOT NULL,
	"projectId" text,
	"environmentId" text,
	"applicationId" text,
	"provider" "cicdProvider" DEFAULT 'github' NOT NULL,
	"repository" text NOT NULL,
	"commitSha" text NOT NULL,
	"ref" text,
	"workflow" text,
	"workflowRunId" text,
	"workflowRunUrl" text,
	"runNumber" integer,
	"actor" text,
	"externalDeploymentId" text,
	"externalId" text NOT NULL,
	"environmentUrl" text,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cicd_deployment" ADD CONSTRAINT "cicd_deployment_deploymentId_deployment_deploymentId_fk" FOREIGN KEY ("deploymentId") REFERENCES "public"."deployment"("deploymentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cicd_deployment" ADD CONSTRAINT "cicd_deployment_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cicd_deployment" ADD CONSTRAINT "cicd_deployment_projectId_project_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("projectId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cicd_deployment" ADD CONSTRAINT "cicd_deployment_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cicd_deployment" ADD CONSTRAINT "cicd_deployment_applicationId_application_applicationId_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."application"("applicationId") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cicd_deployment_deploymentId_unique" ON "cicd_deployment" USING btree ("deploymentId");--> statement-breakpoint
CREATE UNIQUE INDEX "cicd_deployment_provider_externalId_unique" ON "cicd_deployment" USING btree ("provider","externalId");--> statement-breakpoint
CREATE INDEX "cicd_deployment_projectId_idx" ON "cicd_deployment" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "cicd_deployment_organizationId_idx" ON "cicd_deployment" USING btree ("organizationId");