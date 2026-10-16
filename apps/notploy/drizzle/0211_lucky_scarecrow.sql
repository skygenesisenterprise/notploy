CREATE TYPE "public"."communityContributionKind" AS ENUM('issue', 'pull-request');--> statement-breakpoint
CREATE TYPE "public"."communityEventType" AS ENUM('issue-opened', 'issue-closed', 'pull-request-opened', 'pull-request-review', 'pull-request-merged', 'pull-request-closed', 'release-published', 'repository-activity', 'other');--> statement-breakpoint
CREATE TYPE "public"."communitySourceStatus" AS ENUM('connected', 'syncing', 'error', 'rate-limited', 'needs-authorization');--> statement-breakpoint
CREATE TABLE "communityContributions" (
	"id" text PRIMARY KEY NOT NULL,
	"repositoryId" text NOT NULL,
	"kind" "communityContributionKind" NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"authorAvatarUrl" text,
	"url" text NOT NULL,
	"isDraft" boolean DEFAULT false NOT NULL,
	"reviewRequestedCount" integer DEFAULT 0 NOT NULL,
	"assigneeCount" integer DEFAULT 0 NOT NULL,
	"commentCount" integer DEFAULT 0 NOT NULL,
	"openedAt" timestamp with time zone NOT NULL,
	"updatedAtSource" timestamp with time zone,
	"attention" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attentionReasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"syncedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communityEvents" (
	"id" text PRIMARY KEY NOT NULL,
	"repositoryId" text NOT NULL,
	"repositoryFullName" text NOT NULL,
	"externalId" text NOT NULL,
	"type" "communityEventType" NOT NULL,
	"sourceType" text NOT NULL,
	"actor" text,
	"actorAvatarUrl" text,
	"title" text NOT NULL,
	"url" text,
	"occurredAt" timestamp with time zone NOT NULL,
	"syncedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communityReleases" (
	"id" text PRIMARY KEY NOT NULL,
	"repositoryId" text NOT NULL,
	"externalId" text NOT NULL,
	"tagName" text NOT NULL,
	"name" text,
	"isDraft" boolean DEFAULT false NOT NULL,
	"isPrerelease" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp with time zone,
	"url" text NOT NULL,
	"body" text,
	"author" text,
	"syncedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communityRepositories" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceId" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"fullName" text NOT NULL,
	"description" text,
	"language" text,
	"isArchived" boolean DEFAULT false NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"openIssues" integer DEFAULT 0 NOT NULL,
	"openPullRequests" integer DEFAULT 0 NOT NULL,
	"defaultBranch" text,
	"webUrl" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"license" text,
	"pushedAt" timestamp with time zone,
	"lastReleaseTag" text,
	"lastReleaseAt" timestamp with time zone,
	"health" jsonb,
	"syncedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communitySources" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"gitProviderId" text NOT NULL,
	"owner" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" "communitySourceStatus" DEFAULT 'connected' NOT NULL,
	"lastSyncedAt" timestamp with time zone,
	"lastSuccessfulSyncAt" timestamp with time zone,
	"lastError" text,
	"lastErrorAt" timestamp with time zone,
	"lastApiCalls" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communityContributions" ADD CONSTRAINT "communityContributions_repositoryId_communityRepositories_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."communityRepositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communityEvents" ADD CONSTRAINT "communityEvents_repositoryId_communityRepositories_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."communityRepositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communityReleases" ADD CONSTRAINT "communityReleases_repositoryId_communityRepositories_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."communityRepositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communityRepositories" ADD CONSTRAINT "communityRepositories_sourceId_communitySources_id_fk" FOREIGN KEY ("sourceId") REFERENCES "public"."communitySources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communitySources" ADD CONSTRAINT "communitySources_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communitySources" ADD CONSTRAINT "communitySources_gitProviderId_git_provider_gitProviderId_fk" FOREIGN KEY ("gitProviderId") REFERENCES "public"."git_provider"("gitProviderId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_contributions_repo_kind_number_idx" ON "communityContributions" USING btree ("repositoryId","kind","number");--> statement-breakpoint
CREATE INDEX "community_contributions_repository_idx" ON "communityContributions" USING btree ("repositoryId");--> statement-breakpoint
CREATE INDEX "community_contributions_updated_idx" ON "communityContributions" USING btree ("updatedAtSource");--> statement-breakpoint
CREATE UNIQUE INDEX "community_events_repo_external_idx" ON "communityEvents" USING btree ("repositoryId","externalId");--> statement-breakpoint
CREATE INDEX "community_events_occurred_idx" ON "communityEvents" USING btree ("occurredAt");--> statement-breakpoint
CREATE INDEX "community_events_repo_occurred_idx" ON "communityEvents" USING btree ("repositoryId","occurredAt");--> statement-breakpoint
CREATE INDEX "community_events_type_idx" ON "communityEvents" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "community_releases_repo_external_idx" ON "communityReleases" USING btree ("repositoryId","externalId");--> statement-breakpoint
CREATE INDEX "community_releases_repo_published_idx" ON "communityReleases" USING btree ("repositoryId","publishedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "community_repositories_source_full_name_idx" ON "communityRepositories" USING btree ("sourceId","fullName");--> statement-breakpoint
CREATE INDEX "community_repositories_source_idx" ON "communityRepositories" USING btree ("sourceId");--> statement-breakpoint
CREATE INDEX "community_repositories_pushed_idx" ON "communityRepositories" USING btree ("pushedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "community_sources_org_provider_owner_idx" ON "communitySources" USING btree ("organizationId","gitProviderId","owner");--> statement-breakpoint
CREATE INDEX "community_sources_org_idx" ON "communitySources" USING btree ("organizationId");