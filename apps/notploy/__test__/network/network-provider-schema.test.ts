import {
	apiCreateNetworkProvider,
	apiUpdateNetworkProvider,
} from "@notploy/server/db/schema";
import { describe, expect, it } from "vitest";

const wireguardConfig = {
	providerType: "wireguard" as const,
	cidr: "10.80.0.0/16",
};

describe("apiCreateNetworkProvider", () => {
	it("accepts a native Docker provider", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "local-docker",
			config: { providerType: "docker", defaultDriver: "bridge" },
		});
		expect(result.success).toBe(true);
	});

	it("applies defaults for a WireGuard provider", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "sge-private",
			config: wireguardConfig,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.config).toMatchObject({
				interfaceName: "wg0",
				listenPort: 51820,
			});
			expect(result.data.peers).toEqual([]);
		}
	});

	it("accepts peers inside the network", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "sge-private",
			config: wireguardConfig,
			peers: [
				{ name: "server-fr", address: "10.80.0.2" },
				{ name: "server-jp", address: "10.80.0.3", allowedIps: ["10.80.1.0/24"] },
			],
		});
		expect(result.success).toBe(true);
	});

	it("rejects an invalid tunnel CIDR", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "bad",
			config: { providerType: "wireguard", cidr: "999.1.1.0/24" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects duplicate peer addresses", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "dupes",
			config: wireguardConfig,
			peers: [
				{ name: "a", address: "10.80.0.2" },
				{ name: "b", address: "10.80.0.2" },
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid peer addresses and allowed IPs", () => {
		expect(
			apiCreateNetworkProvider.safeParse({
				name: "peer-ip",
				config: wireguardConfig,
				peers: [{ name: "a", address: "not-an-ip" }],
			}).success,
		).toBe(false);

		expect(
			apiCreateNetworkProvider.safeParse({
				name: "peer-allowed",
				config: wireguardConfig,
				peers: [{ name: "a", address: "10.80.0.2", allowedIps: ["nope"] }],
			}).success,
		).toBe(false);
	});

	it("rejects overlapping allowed IP ranges", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "overlap",
			config: wireguardConfig,
			peers: [
				{ name: "a", address: "10.80.0.2", allowedIps: ["10.81.0.0/16"] },
				{ name: "b", address: "10.80.0.3", allowedIps: ["10.81.4.0/24"] },
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects a custom provider with a non-http endpoint", () => {
		const result = apiCreateNetworkProvider.safeParse({
			name: "bad-custom",
			config: { providerType: "custom", baseUrl: "dns.internal" },
		});
		expect(result.success).toBe(false);
	});
});

describe("apiUpdateNetworkProvider", () => {
	it("requires the provider id", () => {
		expect(
			apiUpdateNetworkProvider.safeParse({
				name: "test",
				config: { providerType: "docker" },
			}).success,
		).toBe(false);
	});

	it("accepts an update with the id and defaults", () => {
		const result = apiUpdateNetworkProvider.safeParse({
			networkProviderId: "abc",
			name: "test",
			config: { providerType: "docker" },
		});
		expect(result.success).toBe(true);
	});
});
