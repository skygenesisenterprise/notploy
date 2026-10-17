import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OPENAPI_URL = process.env.NOTPLOY_OPENAPI_URL ?? "https://docs.notploy.com/openapi.json";
const OUTPUT_PATH = resolve(import.meta.dirname, "../openapi.json");

async function main() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);
  const response = await fetch(OPENAPI_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const spec = (await response.json()) as { paths?: Record<string, unknown>; info?: unknown };
  const paths = Object.keys(spec.paths ?? {});
  if (paths.length === 0) {
    throw new Error("The OpenAPI document contains no paths; refusing to overwrite openapi.json");
  }

  console.log(`Found ${paths.length} endpoints`);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  console.log(`Written to ${OUTPUT_PATH}`);
  console.log("Run 'pnpm generate' to refresh the advanced catalog and TOOLS.md.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
