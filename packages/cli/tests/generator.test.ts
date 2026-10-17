import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	GeneratorError,
	generateFromSpec,
	hashSpec,
	type OpenAPISpec,
	parseSpec,
	renderCommands,
} from "../scripts/generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const specPath = path.join(ROOT, "openapi.json");
const generatedPath = path.join(ROOT, "src", "generated", "commands.ts");
const metaPath = path.join(ROOT, "src", "generated", "meta.ts");

function readSpec(): { spec: OpenAPISpec; raw: Buffer } {
	const raw = fs.readFileSync(specPath);
	return { spec: JSON.parse(raw.toString("utf8")) as OpenAPISpec, raw };
}

describe("generator", () => {
	it("generates the checked-in output deterministically", () => {
		const { spec, raw } = readSpec();
		const first = generateFromSpec(spec, hashSpec(raw));
		const second = generateFromSpec(spec, hashSpec(raw));

		expect(first.commandsFile).toBe(second.commandsFile);
		expect(first.metaFile).toBe(second.metaFile);
		expect(fs.readFileSync(generatedPath, "utf8")).toBe(first.commandsFile);
		expect(fs.readFileSync(metaPath, "utf8")).toBe(first.metaFile);
	});

	it("covers every group.action endpoint once", () => {
		const { spec } = readSpec();
		const result = generateFromSpec(spec, "hash");
		const endpoints = Object.keys(spec.paths).filter((entry) => {
			const [group, ...rest] = entry.replace(/^\//, "").split(".");
			return Boolean(group && rest.length);
		});
		expect(result.commandCount).toBe(endpoints.length);
		expect((result.commandsFile.match(/runApiCommand\(/g) ?? []).length).toBe(
			endpoints.length,
		);
		expect(result.commandsFile).toContain("registerGeneratedCommands");
		expect(result.metaFile).toContain("GENERATED_COMMAND_COUNT");
	});

	it("maps arrays, objects, nullable numbers, booleans and enums", () => {
		const spec: OpenAPISpec = {
			info: { version: "test" },
			paths: {
				"/thing.create": {
					post: {
						summary: "Create a thing",
						requestBody: {
							content: {
								"application/json": {
									schema: {
										type: "object",
										required: ["name"],
										properties: {
											name: { type: "string" },
											tags: {
												type: "array",
												items: { type: "string" },
											},
											metadata: { type: "object" },
											port: {
												anyOf: [{ type: "number" }, { type: "null" }],
											},
											enabled: { type: "boolean" },
											kind: {
												type: "string",
												enum: ["alpha", "beta"],
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const commands = parseSpec(spec);
		expect(commands).toHaveLength(1);
		const options = new Map(
			commands[0].options.map((option) => [option.name, option]),
		);
		expect(options.get("tags")).toMatchObject({
			type: "array",
			required: false,
		});
		expect(options.get("metadata")).toMatchObject({ type: "object" });
		expect(options.get("port")).toMatchObject({
			type: "number",
			nullable: true,
		});
		expect(options.get("enabled")).toMatchObject({
			type: "boolean",
			negatedFlag: "--no-enabled",
		});
		expect(options.get("kind")?.enumValues).toEqual(["alpha", "beta"]);
		expect(options.get("name")?.required).toBe(true);

		const rendered = renderCommands(spec, "abc", commands);
		expect(rendered).toContain('required: ["name"]');
		expect(rendered).toContain(
			'types: {"enabled":"boolean","metadata":"object","port":"number?","tags":"array"}',
		);
		expect(rendered).toContain('enums: {"kind":["alpha","beta"]}');
		expect(rendered).toContain("--no-enabled");
	});

	it("resolves local component refs in request bodies", () => {
		const spec: OpenAPISpec = {
			paths: {
				"/thing.update": {
					post: {
						requestBody: {
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Payload",
									},
								},
							},
						},
					},
				},
			},
			components: {
				schemas: {
					Payload: {
						type: "object",
						required: ["id"],
						properties: {
							id: { type: "string" },
							count: { type: "integer" },
						},
					},
				},
			},
		};

		const commands = parseSpec(spec);
		const options = new Map(
			commands[0].options.map((option) => [option.name, option]),
		);
		expect(options.get("id")?.required).toBe(true);
		expect(options.get("count")?.type).toBe("number");
	});

	it("fails clearly on reserved names and unsupported methods", () => {
		const reserved: OpenAPISpec = {
			paths: {
				"/thing.create": {
					post: {
						requestBody: {
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											profile: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
			},
		};
		expect(() => parseSpec(reserved)).toThrow(GeneratorError);

		const unsupported: OpenAPISpec = {
			paths: {
				"/thing.delete": {
					put: {},
				},
			},
		};
		expect(() => parseSpec(unsupported)).toThrow(/Unsupported HTTP method/);
	});
});
