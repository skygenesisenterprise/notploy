ALTER TABLE "dns_record" ADD COLUMN IF NOT EXISTS "comment" text;--> statement-breakpoint
ALTER TABLE "dns_record" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;