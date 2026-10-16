import {
	assertDockerImageReference,
	assertOnionPort,
	assertOnionServiceName,
	DOCKER_IMAGE_REFERENCE_REGEX,
	getOnionServicePaths,
	onionStatusFromDockerState,
	renderTorrc,
	sanitizeOnionError,
	toContainerSafeName,
} from "@notploy/server/utils/onion/config";
import { describe, expect, it } from "vitest";

describe("renderTorrc", () => {
	const torrc = renderTorrc({
		hiddenServiceDir: "/var/lib/tor/hidden_service",
		serviceName: "web",
		targetPort: 3000,
		virtualPort: 80,
	});

	it("maps the onion port to the target service over the project network", () => {
		expect(torrc).toContain("HiddenServiceDir /var/lib/tor/hidden_service");
		expect(torrc).toContain("HiddenServiceVersion 3");
		expect(torrc).toContain("HiddenServicePort 80 web:3000");
	});

	it("never exposes a SOCKS or control port", () => {
		expect(torrc).toContain("SocksPort 0");
		expect(torrc).toContain("ControlPort 0");
		expect(torrc).not.toMatch(/SocksPort\s+(?!0)\d/);
	});

	it("keeps the Tor data directory inside the managed mount", () => {
		expect(torrc).toContain("DataDirectory /var/lib/tor");
	});

	it("refuses a service name that could break the directive", () => {
		for (const serviceName of [
			"web; rm -rf /",
			"web\nHiddenServicePort 80 x:1",
			"-web",
			"",
			"a".repeat(64),
		]) {
			expect(() =>
				renderTorrc({
					hiddenServiceDir: "/var/lib/tor/hidden_service",
					serviceName,
					targetPort: 3000,
					virtualPort: 80,
				}),
			).toThrow();
		}
	});

	it("refuses out-of-range ports", () => {
		for (const targetPort of [0, -1, 65536, 1.5, Number.NaN]) {
			expect(() =>
				renderTorrc({
					hiddenServiceDir: "/var/lib/tor/hidden_service",
					serviceName: "web",
					targetPort,
					virtualPort: 80,
				}),
			).toThrow();
		}
		expect(() =>
			renderTorrc({
				hiddenServiceDir: "/var/lib/tor/hidden_service",
				serviceName: "web",
				targetPort: 8080,
				virtualPort: 65536,
			}),
		).toThrow();
	});
});

describe("validators", () => {
	it("accepts compose service names and trims them", () => {
		expect(assertOnionServiceName("  my_service-1  ")).toBe("my_service-1");
		expect(assertOnionServiceName("web")).toBe("web");
	});

	it("rejects shell metacharacters in a service name", () => {
		for (const value of ["web`id`", "web$(id)", "web|cat", "web&&ls"]) {
			expect(() => assertOnionServiceName(value)).toThrow();
		}
	});

	it("accepts ports in range and rejects everything else", () => {
		expect(assertOnionPort(1)).toBe(1);
		expect(assertOnionPort(65535)).toBe(65535);
		expect(() => assertOnionPort(0)).toThrow(/between 1 and 65535/);
		expect(() => assertOnionPort(65536)).toThrow(/between 1 and 65535/);
	});

	it("accepts tagged images and rejects injected references", () => {
		expect(assertDockerImageReference("docker.io/dockurr/tor:latest")).toBe(
			"docker.io/dockurr/tor:latest",
		);
		expect(DOCKER_IMAGE_REFERENCE_REGEX.test("ghcr.io/x/tor@sha256:abc")).toBe(
			true,
		);
		expect(() => assertDockerImageReference("tor; rm -rf /")).toThrow();
		expect(() => assertDockerImageReference("$(id)")).toThrow();
	});
});

describe("sanitizeOnionError", () => {
	it("collapses a multi-line stderr into one bounded line", () => {
		const message = sanitizeOnionError(
			new Error(`docker: Error response\nline two\n\tline three`),
		);
		expect(message).toBe("docker: Error response line two line three");
	});

	it("truncates and falls back", () => {
		expect(sanitizeOnionError(new Error("x".repeat(900)))).toHaveLength(500);
		expect(sanitizeOnionError(new Error(""))).toBe(
			"The Tor Onion Service operation failed",
		);
		expect(sanitizeOnionError(undefined, "boom")).toBe("boom");
	});
});

describe("onionStatusFromDockerState", () => {
	it.each([
		["running", "running"],
		["restarting", "running"],
		["created", "stopped"],
		["exited", "stopped"],
		["dead", "stopped"],
		["missing", "idle"],
		[null, "idle"],
	])("maps %s to %s", (state, expected) => {
		expect(onionStatusFromDockerState(state)).toBe(expected);
	});
});

describe("getOnionServicePaths", () => {
	it("keeps the identity under the instance configuration tree", () => {
		const paths = getOnionServicePaths("abc123");

		expect(paths.root.endsWith("/onion/abc123")).toBe(true);
		expect(paths.dataDir).toBe(`${paths.root}/data`);
		expect(paths.hiddenServiceDir).toBe(`${paths.dataDir}/hidden_service`);
		expect(paths.torrcPath).toBe(`${paths.root}/torrc`);
		expect(paths.hostnamePath).toBe(`${paths.hiddenServiceDir}/hostname`);
		expect(paths.containerDataDir).toBe("/var/lib/tor");
		expect(paths.containerConfigPath).toBe("/etc/tor/torrc");
		expect(paths.containerHiddenServiceDir).toBe(
			"/var/lib/tor/hidden_service",
		);
	});

	it("derives a docker-safe container name", () => {
		expect(getOnionServicePaths("abc123").containerName).toBe(
			"notploy-onion-abc123",
		);
		expect(toContainerSafeName("notploy-onion-a b/c")).toBe(
			"notploy-onion-a-b-c",
		);
		expect(toContainerSafeName("-leading")).toBe("n-leading");
	});
});
