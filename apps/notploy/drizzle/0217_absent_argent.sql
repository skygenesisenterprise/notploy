CREATE TABLE "github_webhook_delivery" (
	"githubId" text NOT NULL,
	"deliveryId" text NOT NULL,
	"event" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"receivedAt" text NOT NULL,
	"processedAt" text,
	"errorMessage" text,
	CONSTRAINT "github_webhook_delivery_githubId_deliveryId_pk" PRIMARY KEY("githubId","deliveryId")
);
--> statement-breakpoint
ALTER TABLE "github" ADD COLUMN "githubInstallationSuspendedAt" text;--> statement-breakpoint
ALTER TABLE "github_webhook_delivery" ADD CONSTRAINT "github_webhook_delivery_githubId_github_githubId_fk" FOREIGN KEY ("githubId") REFERENCES "public"."github"("githubId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_webhook_delivery_receivedAt_idx" ON "github_webhook_delivery" USING btree ("receivedAt");