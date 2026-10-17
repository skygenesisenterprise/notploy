ALTER TABLE "ai" ADD COLUMN "lastTestStatus" text;--> statement-breakpoint
ALTER TABLE "ai" ADD COLUMN "lastTestMessage" text;--> statement-breakpoint
ALTER TABLE "ai" ADD COLUMN "lastTestedAt" text;--> statement-breakpoint
ALTER TABLE "ai" ADD COLUMN "lastTestLatencyMs" integer;--> statement-breakpoint
ALTER TABLE "ai" ADD COLUMN "verifiedCapabilities" text;