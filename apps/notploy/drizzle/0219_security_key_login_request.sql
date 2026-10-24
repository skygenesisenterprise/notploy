CREATE TABLE "security_key_login_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"approved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "security_key_login_request" ADD CONSTRAINT "security_key_login_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_key_login_request_user_id_idx" ON "security_key_login_request" USING btree ("user_id");
