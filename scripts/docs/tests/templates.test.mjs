import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
	extractTemplateHelpers,
	renderTemplateCatalog,
	validateBlueprints,
} from "../lib/templates.mjs";

const root = mkdtempSync(join(tmpdir(), "docs-templates-"));
after(() => rmSync(root, { recursive: true, force: true }));

const HELPERS = ["base64", "domain", "hash", "password"];

function blueprint(id, { compose, toml, meta, logo = true } = {}) {
	const dir = join(root, id);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "meta.json"),
		JSON.stringify(
			meta ?? {
				id,
				name: id,
				version: "1.0.0",
				description: "test",
				logo: "logo.svg",
				links: { github: "", website: "", docs: "" },
				tags: ["test"],
			},
		),
	);
	if (logo) writeFileSync(join(dir, "logo.svg"), "<svg />");
	writeFileSync(
		join(dir, "docker-compose.yml"),
		compose ??
			["services:", "  web:", "    image: nginx:alpine", "    ports:", "      - 80"].join(
				"\n",
			),
	);
	writeFileSync(
		join(dir, "template.toml"),
		toml ??
			[
				"[variables]",
				'main_domain = "${domain}"',
				"[config]",
				'env = ["APP_URL=https://${main_domain}"]',
				"[[config.domains]]",
				'serviceName = "web"',
				"port = 80",
				'host = "${main_domain}"',
			].join("\n"),
	);
	return dir;
}

function errorsFor(id) {
	const { issues } = validateBlueprints(root, HELPERS);
	return issues.filter((issue) => issue.file.startsWith(`${root}/${id}/`) && issue.severity === "error");
}

test("accepts a valid blueprint", () => {
	blueprint("valid");
	assert.deepEqual(errorsFor("valid"), []);
});

test("rejects a container_name without the opt-out marker", () => {
	blueprint("named", {
		compose: [
			"services:",
			"  web:",
			"    image: nginx:alpine",
			"    container_name: fixed-name",
		].join("\n"),
	});
	assert.ok(
		errorsFor("named").some((issue) => issue.code === "templates.compose-container-name"),
	);
});

test("accepts container_name when the documented marker is present", () => {
	blueprint("marked", {
		compose: [
			"# notploy: allow-container-names — legacy DNS dependency",
			"services:",
			"  web:",
			"    image: nginx:alpine",
			"    container_name: fixed-name",
		].join("\n"),
	});
	assert.deepEqual(errorsFor("marked"), []);
});

test("rejects host port mappings without the opt-out marker", () => {
	blueprint("ports", {
		compose: [
			"services:",
			"  web:",
			"    image: nginx:alpine",
			"    ports:",
			'      - "8080:80"',
		].join("\n"),
	});
	assert.ok(
		errorsFor("ports").some((issue) => issue.code === "templates.compose-ports"),
	);
});

test("rejects a domain that targets a missing service", () => {
	blueprint("domain", {
		toml: [
			"[variables]",
			'main_domain = "${domain}"',
			"[config]",
			"[[config.domains]]",
			'serviceName = "missing"',
			"port = 80",
			'host = "${main_domain}"',
		].join("\n"),
	});
	assert.ok(
		errorsFor("domain").some((issue) => issue.code === "templates.domain-service"),
	);
});

test("warns about undeclared variables but does not fail the blueprint", () => {
	const dir = blueprint("variables", {
		toml: [
			"[variables]",
			'db_password = "${password:32}"',
			"[config]",
			'env = ["DB_PASSWORD=${db_password}", "UNKNOWN=${not_declared}"]',
		].join("\n"),
	});
	const { issues } = validateBlueprints(root, HELPERS);
	const local = issues.filter((issue) => issue.file.startsWith(`${dir}/`));
	assert.ok(
		local.some(
			(issue) =>
				issue.code === "templates.undefined-variable" &&
				issue.severity === "warning" &&
				issue.message.includes("not_declared"),
		),
	);
	assert.ok(!local.some((issue) => issue.severity === "error"));
});

test("rejects malformed TOML and invalid Compose YAML", () => {
	blueprint("broken-toml", { toml: "[variables\nnope" });
	blueprint("broken-compose", { compose: "services: [unclosed" });
	assert.ok(errorsFor("broken-toml").some((issue) => issue.code === "templates.invalid-toml"));
	assert.ok(errorsFor("broken-compose").some((issue) => issue.code === "templates.invalid-compose"));
});

test("extracts implemented helpers from the processor source", () => {
	const source = `
		if (varName === "domain") return x;
		if (varName.startsWith("password:")) return y;
		varName === "uuid"
		if (varName.startsWith("jwt:")) return z;
	`;
	assert.deepEqual(extractTemplateHelpers(source), ["domain", "jwt", "password", "uuid"]);
});

test("renders a deterministic catalogue summary", () => {
	const blueprints = [
		{ id: "a", meta: { tags: ["monitoring", "database"] } },
		{ id: "b", meta: { tags: ["database"] } },
	];
	const first = renderTemplateCatalog(blueprints);
	assert.equal(first, renderTemplateCatalog(blueprints));
	assert.match(first, /\*\*2 blueprints\*\*/);
	assert.match(first, /\| `database` \| 2 \|/);
});
