CREATE TYPE "public"."onionServiceStatus" AS ENUM('idle', 'deploying', 'running', 'stopped', 'error');--> statement-breakpoint
CREATE TABLE "onionService" (
	"onionServiceId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"composeId" text NOT NULL,
	"serviceName" text NOT NULL,
	"targetPort" integer NOT NULL,
	"virtualPort" integer DEFAULT 80 NOT NULL,
	"onionAddress" text,
	"identityPath" text,
	"status" "onionServiceStatus" DEFAULT 'idle' NOT NULL,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onionService" ADD CONSTRAINT "onionService_composeId_compose_composeId_fk" FOREIGN KEY ("composeId") REFERENCES "public"."compose"("composeId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onionService_composeId_idx" ON "onionService" USING btree ("composeId");--> statement-breakpoint
CREATE UNIQUE INDEX "onionService_address_idx" ON "onionService" USING btree ("onionAddress");--> statement-breakpoint
CREATE UNIQUE INDEX "onionService_target_idx" ON "onionService" USING btree ("composeId","serviceName","virtualPort");