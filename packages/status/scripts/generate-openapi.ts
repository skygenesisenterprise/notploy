/**
 * Materializes the OpenAPI contract to `openapi.json` at the package root.
 * Run with `pnpm generate:openapi`; the file is committed so consumers can
 * diff the contract.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOpenApiDocument } from "../src/api/openapi";
import { loadConfig } from "../src/config";

const config = loadConfig();
const document = buildOpenApiDocument(config.publicUrl);
const target = resolve(process.cwd(), "openapi.json");
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
process.stdout.write(
	`openapi.json written (${Object.keys(document.paths).length} paths)\n`,
);
