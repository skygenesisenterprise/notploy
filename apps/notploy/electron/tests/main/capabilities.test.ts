import { describe, expect, it } from "vitest";
import {
	capabilitiesFromRouters,
	routersFromDocument,
} from "@/main/client/capabilities";
import { openApiDocument } from "../helpers/mock-server";

describe("routersFromDocument", () => {
	it("extracts the router of each path", () => {
		const document = {
			paths: {
				"/project.all": {},
				"/docker.getContainers": {},
				"/settings.health": {},
			},
		};
		expect(routersFromDocument(document)).toEqual([
			"docker",
			"project",
			"settings",
		]);
	});

	it("handles paths without a leading slash and REST-style paths", () => {
		expect(
			routersFromDocument({
				paths: { "network.all": {}, "/api/v1/thing": {} },
			}),
		).toEqual(["api", "network"]);
	});

	it("returns nothing for an empty or malformed document", () => {
		expect(routersFromDocument(undefined)).toEqual([]);
		expect(routersFromDocument({})).toEqual([]);
		expect(routersFromDocument({ paths: {} })).toEqual([]);
	});

	it("reads the routers of a generated document", () => {
		expect(routersFromDocument(openApiDocument(["project", "docker"]))).toEqual(
			["docker", "project"],
		);
	});
});

describe("capabilitiesFromRouters", () => {
	it("requires both router and application for deployments", () => {
		expect(capabilitiesFromRouters(["deployment"], false).deployments).toBe(
			false,
		);
		expect(
			capabilitiesFromRouters(["deployment", "application"], false).deployments,
		).toBe(true);
	});

	it("treats swarm and cluster as the same capability", () => {
		expect(capabilitiesFromRouters(["cluster"], false).swarm).toBe(true);
		expect(capabilitiesFromRouters(["swarm"], false).swarm).toBe(true);
		expect(capabilitiesFromRouters([], false).swarm).toBe(false);
	});

	it("never invents Kubernetes, which the API does not expose", () => {
		expect(
			capabilitiesFromRouters(["project", "docker"], false).kubernetes,
		).toBe(false);
	});

	it("reports Kubernetes when an instance advertises the router", () => {
		expect(capabilitiesFromRouters(["kubernetes"], false).kubernetes).toBe(
			true,
		);
	});

	it("carries the cloud flag through", () => {
		expect(capabilitiesFromRouters([], true).cloud).toBe(true);
	});
});
