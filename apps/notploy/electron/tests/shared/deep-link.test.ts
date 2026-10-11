import { describe, expect, it } from "vitest";
import { deepLinkFromArgv, resolveDeepLink } from "@/main/deep-links";
import { noopLogger } from "@/main/logging";
import { formatDeepLink, isDeepLink, parseDeepLink } from "@/shared/deep-link";

describe("parseDeepLink", () => {
	it("reads a bare section", () => {
		expect(parseDeepLink("notploy://overview")).toEqual({
			section: "overview",
			instance: undefined,
		});
	});

	it("reads the instance from the query, not the host", () => {
		// A connection may legitimately be named "projects"; keeping the instance
		// out of the path is what makes that unambiguous.
		expect(parseDeepLink("notploy://projects/42?instance=projects")).toEqual({
			section: "projects",
			resource: { kind: "project", id: "42" },
			instance: "projects",
		});
	});

	it("reads a project", () => {
		expect(parseDeepLink("notploy://projects/6541")).toEqual({
			section: "projects",
			resource: { kind: "project", id: "6541" },
			instance: undefined,
		});
	});

	it("reads an environment nested under its project", () => {
		expect(parseDeepLink("notploy://projects/1/environments/2")).toEqual({
			section: "projects",
			resource: { kind: "environment", projectId: "1", id: "2" },
			instance: undefined,
		});
	});

	it("reads a database with its engine", () => {
		expect(parseDeepLink("notploy://databases/postgres/5512")).toEqual({
			section: "databases",
			resource: { kind: "database", engine: "postgres", id: "5512" },
			instance: undefined,
		});
	});

	it("rejects a database whose engine is not one the API has", () => {
		// Falls back to the section rather than inventing an engine.
		expect(parseDeepLink("notploy://databases/cassandra/1")).toEqual({
			section: "databases",
			instance: undefined,
		});
	});

	it("accepts the single-slash form the OS can deliver", () => {
		expect(parseDeepLink("notploy:deployments/88")).toEqual({
			section: "deployments",
			resource: { kind: "deployment", id: "88" },
			instance: undefined,
		});
	});

	it("decodes percent-encoded identifiers", () => {
		expect(parseDeepLink("notploy://applications/a%2Fb")).toEqual({
			section: "applications",
			resource: { kind: "application", id: "a/b" },
			instance: undefined,
		});
	});

	it("returns undefined for anything malformed", () => {
		for (const input of [
			"",
			"   ",
			"https://notploy.com",
			"notploy://",
			"notploy://not-a-section",
			"not a url at all",
		]) {
			expect(parseDeepLink(input), input).toBeUndefined();
		}
	});

	it("degrades a resource it cannot represent to its section", () => {
		// The section is still a useful destination; refusing outright would drop
		// the user somewhere unrelated.
		expect(parseDeepLink("notploy://overview/something/else")).toEqual({
			section: "overview",
			instance: undefined,
		});
	});
});

describe("formatDeepLink", () => {
	it("round-trips every resource kind", () => {
		const targets = [
			{ section: "overview" as const },
			{
				section: "projects" as const,
				resource: { kind: "project" as const, id: "7" },
			},
			{
				section: "projects" as const,
				resource: { kind: "environment" as const, projectId: "7", id: "8" },
			},
			{
				section: "applications" as const,
				resource: { kind: "application" as const, id: "9" },
			},
			{
				section: "deployments" as const,
				resource: { kind: "deployment" as const, id: "10" },
			},
			{
				section: "databases" as const,
				resource: {
					kind: "database" as const,
					engine: "redis" as const,
					id: "11",
				},
			},
			{
				section: "infrastructure" as const,
				resource: { kind: "server" as const, id: "12" },
			},
			{ section: "connections" as const, instance: "production" },
		];

		for (const target of targets) {
			const url = formatDeepLink(target);
			expect(parseDeepLink(url), url).toEqual({
				section: target.section,
				resource: "resource" in target ? target.resource : undefined,
				instance: "instance" in target ? target.instance : undefined,
			});
		}
	});

	it("round-trips the configuration sections, which carry no resource", () => {
		const sections = [
			"tags",
			"certificates",
			"ssh-keys",
			"registries",
			"destinations",
		] as const;

		for (const section of sections) {
			const url = formatDeepLink({ section });
			expect(url, section).toBe(`notploy://${section}`);
			expect(parseDeepLink(url), url).toEqual({ section, instance: undefined });
		}
	});

	it("keeps the instance on a configuration link", () => {
		expect(parseDeepLink("notploy://ssh-keys?instance=staging")).toEqual({
			section: "ssh-keys",
			instance: "staging",
		});
	});

	it("encodes an instance name that needs escaping", () => {
		const url = formatDeepLink({
			section: "overview",
			instance: "Notploy Production (EU)",
		});
		expect(parseDeepLink(url)?.instance).toBe("Notploy Production (EU)");
	});
});

describe("isDeepLink", () => {
	it("recognises the scheme and only the scheme", () => {
		expect(isDeepLink("notploy://overview")).toBe(true);
		expect(isDeepLink("  NOTPLOY://overview")).toBe(true);
		expect(isDeepLink("notploy:overview")).toBe(true);
		expect(isDeepLink("https://notploy.com")).toBe(false);
		expect(isDeepLink("notploy")).toBe(false);
	});
});

describe("deepLinkFromArgv", () => {
	it("finds the link in a second-instance command line", () => {
		expect(
			deepLinkFromArgv([
				"/usr/bin/notploy",
				"--flag",
				"notploy://databases/mysql/3?instance=staging",
			]),
		).toBe("notploy://databases/mysql/3?instance=staging");
	});

	it("returns undefined when the command line carries no link", () => {
		expect(deepLinkFromArgv(["/usr/bin/notploy"])).toBeUndefined();
	});
});

describe("resolveDeepLink", () => {
	it("drops an unparseable link instead of throwing", () => {
		expect(resolveDeepLink("notploy://nope", noopLogger)).toBeUndefined();
		expect(resolveDeepLink(undefined, noopLogger)).toBeUndefined();
	});

	it("resolves a valid one", () => {
		expect(resolveDeepLink("notploy://monitoring", noopLogger)).toEqual({
			section: "monitoring",
			instance: undefined,
		});
	});
});
