ALTER TABLE "passkey" RENAME TO "security_key";--> statement-breakpoint
ALTER TABLE "security_key" DROP CONSTRAINT "passkey_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "passkey_userId_idx";--> statement-breakpoint
DROP INDEX "passkey_credentialID_idx";--> statement-breakpoint
ALTER TABLE "security_key" ADD CONSTRAINT "security_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_key_user_id_idx" ON "security_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_key_credential_id_idx" ON "security_key" USING btree ("credential_id");