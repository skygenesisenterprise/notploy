ALTER TABLE "certificate" ADD COLUMN "notBefore" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "notAfter" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "commonName" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "subjectAltNames" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "createdAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "webServerSettings" ADD COLUMN "customCertResolver" text;