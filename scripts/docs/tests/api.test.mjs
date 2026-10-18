import assert from "node:assert/strict";
import { test } from "node:test";
import { diffSpecs, tagSlugs, validateSpec } from "../lib/api.mjs";

function spec(paths, extra = {}) {
	return {
		openapi: "3.1.0",
		info: { title: "Test", version: "1.0.0" },
		tags: [{ name: "thing" }],
		components: {
			securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "x-api-key" } },
		},
		security: [{ apiKey: [] }],
		paths,
		...extra,
	};
}

test("validates security references and reports unknown schemes", () => {
	const document = spec({
		"/thing.get": {
			get: {
				tags: ["thing"],
				security: [{ Authorization: [] }],
				responses: { 200: { description: "ok" } },
			},
		},
	});
	const issues = validateSpec(document);
	assert.ok(
		issues.some((issue) => issue.code === "api.unknown-security"),
		"expected the legacy Authorization scheme to be reported",
	);
});

test("reports duplicate operation ids, undeclared tags and unresolved refs", () => {
	const document = spec({
		"/thing.get": {
			get: {
				operationId: "thingGet",
				tags: ["missing"],
				responses: { 200: { description: "ok" } },
			},
		},
		"/thing.other": {
			get: {
				operationId: "thingGet",
				tags: ["thing"],
				responses: {
					200: {
						description: "ok",
						content: {
							"application/json": { schema: { $ref: "#/components/schemas/Nope" } },
						},
					},
				},
			},
		},
	});
	const codes = validateSpec(document).map((issue) => issue.code);
	assert.ok(codes.includes("api.duplicate-operation-id"));
	assert.ok(codes.includes("api.undeclared-tag"));
	assert.ok(codes.includes("api.unresolved-ref"));
});

test("reports colliding tag slugs", () => {
	const result = tagSlugs({
		tags: [{ name: "gitProvider" }, { name: "gitprovider" }],
	});
	assert.deepEqual(result.slugs, ["gitprovider"]);
	assert.equal(result.issues[0].code, "api.duplicate-tag");
});

test("detects removed endpoints, required parameters and enum values", () => {
	const base = spec({
		"/thing.list": {
			get: {
				tags: ["thing"],
				parameters: [{ name: "limit", in: "query", required: false }],
				responses: { 200: { description: "ok" } },
			},
		},
		"/thing.create": {
			post: {
				tags: ["thing"],
				responses: { 200: { description: "ok" } },
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name"],
								properties: {
									name: { type: "string" },
									kind: { type: "string", enum: ["a", "b"] },
								},
							},
						},
					},
				},
			},
		},
	});
	const current = spec({
		"/thing.list": {
			get: {
				tags: ["thing"],
				parameters: [{ name: "limit", in: "query", required: true }],
				responses: { 200: { description: "ok" } },
			},
		},
		"/thing.create": {
			post: {
				tags: ["thing"],
				responses: { 200: { description: "ok" } },
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name"],
								properties: {
									name: { type: "string" },
									kind: { type: "string", enum: ["a"] },
								},
							},
						},
					},
				},
			},
		},
	});
	delete base.paths["/thing.removed"];
	base.paths["/thing.removed"] = {
		delete: { tags: ["thing"], responses: { 200: { description: "ok" } } },
	};
	delete current.paths["/thing.removed"];

	const issues = diffSpecs(base, current);
	const codes = issues.map((issue) => issue.code);
	assert.ok(codes.includes("api.breaking.endpoint-removed"));
	assert.ok(codes.includes("api.breaking.parameter-required"));
	assert.ok(codes.includes("api.breaking.enum-value-removed"));
});
