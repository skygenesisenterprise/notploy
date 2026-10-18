import { readFileSync } from "node:fs";

const HTTP_METHODS = new Set([
	"get",
	"put",
	"post",
	"delete",
	"patch",
	"options",
	"head",
	"trace",
]);

export function loadSpecFile(path) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		throw new Error(`cannot read ${path}: ${error.message}`);
	}
	try {
		return { spec: JSON.parse(raw), raw };
	} catch (error) {
		throw new Error(`${path} is not valid JSON: ${error.message}`);
	}
}

/** Every operation in the spec, sorted by path then method. */
export function operationEntries(spec) {
	const entries = [];
	for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
		if (!pathItem || typeof pathItem !== "object") continue;
		for (const [method, operation] of Object.entries(pathItem)) {
			if (!HTTP_METHODS.has(method)) continue;
			entries.push({ path, method, operation });
		}
	}
	return entries.sort(
		(a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
	);
}

/**
 * Fumadocs derives the page name from the tag with `tag.toLowerCase()`, which
 * is why `gitProvider` becomes `gitprovider.mdx`.
 */
export function tagSlug(tag) {
	return String(tag).toLowerCase();
}

export function tagSlugs(spec) {
	const names = (spec.tags ?? []).map((tag) => tag?.name).filter(Boolean);
	const seen = new Map();
	const issues = [];
	for (const name of names) {
		const slug = tagSlug(name);
		if (seen.has(slug)) {
			issues.push({
				severity: "error",
				code: "api.duplicate-tag",
				message: `tags "${seen.get(slug)}" and "${name}" both map to the reference page "${slug}.mdx"`,
			});
		}
		seen.set(slug, name);
	}
	return { slugs: [...seen.keys()].sort(), issues };
}

function resolvePointer(spec, pointer) {
	if (!pointer.startsWith("#/")) return undefined;
	let current = spec;
	for (const raw of pointer.slice(2).split("/")) {
		const segment = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
		if (!current || typeof current !== "object") return undefined;
		current = current[segment];
	}
	return current;
}

function walkRefs(value, visit, location = "#") {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => walkRefs(entry, visit, `${location}/${index}`));
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, entry] of Object.entries(value)) {
		if (key === "$ref" && typeof entry === "string") {
			visit(entry, location);
			continue;
		}
		walkRefs(entry, visit, `${location}/${key}`);
	}
}

/** Structural checks that do not need a running server. */
export function validateSpec(spec) {
	const issues = [];
	const report = (severity, code, message) =>
		issues.push({ severity, code, message });

	if (!spec || typeof spec !== "object") {
		report("error", "api.spec", "the OpenAPI document is not an object");
		return issues;
	}
	if (!spec.info?.title) {
		report("warning", "api.info", "openapi.info.title is missing");
	}
	const entries = operationEntries(spec);
	if (entries.length === 0) {
		report("error", "api.no-operations", "the OpenAPI document has no operations");
	}

	const operationIds = new Map();
	const declaredTags = new Set((spec.tags ?? []).map((tag) => tag?.name));
	const securitySchemes = new Set(
		Object.keys(spec.components?.securitySchemes ?? {}),
	);
	const checkSecurity = (security) => {
		for (const requirement of security ?? []) {
			for (const name of Object.keys(requirement)) {
				if (!securitySchemes.has(name)) {
					report(
						"error",
						"api.unknown-security",
						`security scheme "${name}" is referenced but not defined in components.securitySchemes`,
					);
				}
			}
		}
	};
	checkSecurity(spec.security);

	for (const { path, method, operation } of entries) {
		const label = `${method.toUpperCase()} ${path}`;
		const operationId = operation.operationId;
		if (operationId) {
			if (operationIds.has(operationId)) {
				report(
					"error",
					"api.duplicate-operation-id",
					`operationId "${operationId}" is used by both ${operationIds.get(operationId)} and ${label}`,
				);
			} else {
				operationIds.set(operationId, label);
			}
		}
		if (!operation.responses || Object.keys(operation.responses).length === 0) {
			report("warning", "api.no-responses", `${label} declares no responses`);
		}
		for (const tag of operation.tags ?? []) {
			if (!declaredTags.has(tag)) {
				report(
					"error",
					"api.undeclared-tag",
					`${label} uses tag "${tag}" which is not declared in the top-level tags list`,
				);
			}
		}
		checkSecurity(operation.security);
	}

	walkRefs(spec, (ref) => {
		if (!ref.startsWith("#/")) {
			report(
				"error",
				"api.external-ref",
				`external $ref "${ref}" cannot be resolved without network access`,
			);
			return;
		}
		if (resolvePointer(spec, ref) === undefined) {
			report("error", "api.unresolved-ref", `$ref "${ref}" does not resolve`);
		}
	});

	return issues;
}

function required(schema) {
	return new Set(Array.isArray(schema?.required) ? schema.required : []);
}

function resolveSchema(spec, schema) {
	let current = schema;
	const seen = new Set();
	while (current?.$ref) {
		if (seen.has(current.$ref)) return current;
		seen.add(current.$ref);
		current = resolvePointer(spec, current.$ref);
	}
	return current ?? {};
}

function propertiesOf(spec, schema) {
	const resolved = resolveSchema(spec, schema);
	return resolved.properties ?? {};
}

/**
 * Advisory comparison of a base spec against the current one. Broken clients
 * are reported as warnings: a removed endpoint may be intentional, so the PR
 * author reviews the list instead of every change being blocked.
 */
export function diffSpecs(base, current) {
	const issues = [];
	const report = (code, message) =>
		issues.push({ severity: "warning", code, message });

	const before = new Map(
		operationEntries(base).map((entry) => [
			`${entry.method} ${entry.path}`,
			entry.operation,
		]),
	);
	const after = new Map(
		operationEntries(current).map((entry) => [
			`${entry.method} ${entry.path}`,
			entry.operation,
		]),
	);

	for (const [key, operation] of before) {
		const next = after.get(key);
		if (!next) {
			report("api.breaking.endpoint-removed", `${key} was removed`);
			continue;
		}

		const beforeParameters = new Map(
			(operation.parameters ?? []).map((parameter) => [parameter.name, parameter]),
		);
		const afterParameters = new Map(
			(next.parameters ?? []).map((parameter) => [parameter.name, parameter]),
		);
		for (const [name, parameter] of beforeParameters) {
			const nextParameter = afterParameters.get(name);
			if (!nextParameter) {
				report(
					"api.breaking.parameter-removed",
					`${key}: parameter "${name}" was removed`,
				);
			} else if (!parameter.required && nextParameter.required) {
				report(
					"api.breaking.parameter-required",
					`${key}: parameter "${name}" is now required`,
				);
			}
		}

		const beforeBody = propertiesOf(
			base,
			operation.requestBody?.content?.["application/json"]?.schema,
		);
		const afterSchema =
			next.requestBody?.content?.["application/json"]?.schema;
		const afterBody = propertiesOf(current, afterSchema);
		const beforeRequired = required(
			resolveSchema(
				base,
				operation.requestBody?.content?.["application/json"]?.schema,
			),
		);
		const afterRequired = required(resolveSchema(current, afterSchema));

		for (const name of Object.keys(beforeBody)) {
			if (!(name in afterBody)) {
				report(
					"api.breaking.request-property-removed",
					`${key}: request body property "${name}" was removed`,
				);
			} else if (!beforeRequired.has(name) && afterRequired.has(name)) {
				report(
					"api.breaking.request-property-required",
					`${key}: request body property "${name}" is now required`,
				);
			}
		}

		for (const [name, beforeProperty] of Object.entries(beforeBody)) {
			const afterProperty = afterBody[name];
			if (!afterProperty) continue;
			const beforeEnum = beforeProperty?.enum;
			const afterEnum = afterProperty?.enum;
			if (Array.isArray(beforeEnum) && Array.isArray(afterEnum)) {
				for (const value of beforeEnum) {
					if (!afterEnum.includes(value)) {
						report(
							"api.breaking.enum-value-removed",
							`${key}: property "${name}" no longer accepts "${value}"`,
						);
					}
				}
			}
			const beforeType = beforeProperty?.type;
			const afterType = afterProperty?.type;
			if (beforeType && afterType && beforeType !== afterType) {
				report(
					"api.breaking.property-type-changed",
					`${key}: property "${name}" changed type from "${beforeType}" to "${afterType}"`,
				);
			}
		}
	}

	return issues;
}
