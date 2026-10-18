/**
 * Generates CLI commands from the Notploy OpenAPI spec.
 *
 * Usage:
 *   tsx scripts/generate.ts            # write generated files
 *   tsx scripts/generate.ts --check    # fail if generated files are stale
 *   tsx scripts/generate.ts --spec <path> --out <path> --meta <path>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromSpec, hashSpec, type OpenAPISpec } from "./generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function argumentValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index === -1) return undefined;
	return process.argv[index + 1];
}

const specPath = path.resolve(
	argumentValue("--spec") ?? path.join(ROOT, "openapi.json"),
);
const outPath = path.resolve(
	argumentValue("--out") ?? path.join(ROOT, "src", "generated", "commands.ts"),
);
const metaPath = path.resolve(
	argumentValue("--meta") ?? path.join(ROOT, "src", "generated", "meta.ts"),
);
const check = process.argv.includes("--check");

function firstDifference(expected: string, actual: string): number | undefined {
	const expectedLines = expected.split("\n");
	const actualLines = actual.split("\n");
	const max = Math.max(expectedLines.length, actualLines.length);
	for (let i = 0; i < max; i += 1) {
		if (expectedLines[i] !== actualLines[i]) return i + 1;
	}
	return undefined;
}

function writeFile(filePath: string, content: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf8");
}

function checkFile(filePath: string, expected: string): boolean {
	if (!fs.existsSync(filePath)) {
		console.error(`stale: ${path.relative(ROOT, filePath)} does not exist`);
		return false;
	}
	const actual = fs.readFileSync(filePath, "utf8");
	if (actual === expected) return true;
	const line = firstDifference(expected, actual);
	console.error(
		`stale: ${path.relative(ROOT, filePath)} differs from openapi.json${line ? ` at line ${line}` : ""}`,
	);
	return false;
}

function main(): void {
	const raw = fs.readFileSync(specPath);
	const spec = JSON.parse(raw.toString("utf8")) as OpenAPISpec;
	const hash = hashSpec(raw);
	const result = generateFromSpec(spec, hash);

	if (result.skippedEndpoints.length > 0) {
		console.warn(
			`Skipped ${result.skippedEndpoints.length} endpoint(s) that are not tRPC commands (REST-only routes):`,
		);
		for (const endpoint of result.skippedEndpoints) {
			console.warn(`  ${endpoint}`);
		}
	}

	if (check) {
		const commandsOk = checkFile(outPath, result.commandsFile);
		const metaOk = checkFile(metaPath, result.metaFile);
		if (!commandsOk || !metaOk) {
			console.error("Run 'pnpm run generate' and commit the result.");
			process.exitCode = 1;
			return;
		}
		console.log(
			`Generated output is up to date (${result.commandCount} commands, ${result.groupCount} groups).`,
		);
		return;
	}

	writeFile(outPath, result.commandsFile);
	writeFile(metaPath, result.metaFile);
	console.log(
		`Generated ${result.commandCount} commands in ${result.groupCount} groups -> ${path.relative(ROOT, outPath)}, ${path.relative(ROOT, metaPath)}`,
	);
}

try {
	main();
} catch (error) {
	console.error(
		`Generation failed: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
}
