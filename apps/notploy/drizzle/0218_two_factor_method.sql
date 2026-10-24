ALTER TABLE "user" ADD COLUMN "two_factor_method" text;--> statement-breakpoint
CREATE TABLE "security_key_backup_code" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "security_key_backup_code" ADD CONSTRAINT "security_key_backup_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_key_backup_code_user_id_idx" ON "security_key_backup_code" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "security_key_backup_code_hash_idx" ON "security_key_backup_code" USING btree ("code_hash");
