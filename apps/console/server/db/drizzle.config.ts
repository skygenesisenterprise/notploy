import { dbUrl } from "@notploy/server/db";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./server/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: dbUrl,
	},
	out: "drizzle",
	migrations: {
		table: "migrations",
		schema: "public",
	},
});
