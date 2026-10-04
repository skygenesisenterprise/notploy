ALTER TABLE "dns_record" ADD COLUMN "comment" text;--> statement-breakpoint
ALTER TABLE "dns_record" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;