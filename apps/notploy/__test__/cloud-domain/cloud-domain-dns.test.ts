import {
	ensureCloudWildcardRecord,
	getCloudDnsConfig,
	resetCloudDnsCache,
	selectZoneId,
} from "@notploy/server/services/cloud-domain-dns";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "cf-sentinel-token-value";

const env = {
	CLOUDFLARE_API_TOKEN: TOKEN,
	NOTPLOY_CLOUD_INGRESS_TARGET: "203.0.113.10",
};

const createClient = (zones = [{ id: "zone-1", name: "notploy.app" }]) => ({
	listZones: vi.fn(async () => zones),
	upsertRecord: vi.fn(async () => ({ id: "record-1" })),
});

beforeEach(() => {
	resetCloudDnsCache();
});

describe("getCloudDnsConfig", () => {
	it("requires both the API token and the ingress target", () => {
		expect(getCloudDnsConfig({})).toBeNull();
		expect(
			getCloudDnsConfig({ CLOUDFLARE_API_TOKEN: TOKEN }),
		).toBeNull();
	});

	it("proxies by default and can be switched to DNS-only", () => {
		expect(getCloudDnsConfig(env)).toMatchObject({ proxied: true });
		expect(
			getCloudDnsConfig({ ...env, NOTPLOY_CLOUD_DNS_PROXIED: "false" }),
		).toMatchObject({ proxied: false });
	});

	it("accepts an explicit zone id", () => {
		expect(
			getCloudDnsConfig({ ...env, NOTPLOY_CLOUD_DNS_ZONE_ID: "zone-explicit" }),
		).toMatchObject({ zoneId: "zone-explicit" });
	});
});

describe("selectZoneId", () => {
	it("uses the most specific zone", () => {
		expect(
			selectZoneId(
				[
					{ id: "apex", name: "notploy.app" },
					{ id: "sub", name: "cloud.notploy.app" },
				],
				"cloud.notploy.app",
			),
		).toBe("sub");
	});

	it("returns null when no zone manages the name", () => {
		expect(
			selectZoneId([{ id: "other", name: "example.com" }], "notploy.app"),
		).toBeNull();
	});
});

describe("ensureCloudWildcardRecord", () => {
	it("is skipped when no base or no Cloudflare configuration exists", async () => {
		const client = createClient();
		await expect(
			ensureCloudWildcardRecord({ base: null, env, client }),
		).resolves.toMatchObject({ status: "skipped" });
		await expect(
			ensureCloudWildcardRecord({ base: "notploy.app", env: {}, client }),
		).resolves.toMatchObject({ status: "skipped" });
		expect(client.upsertRecord).not.toHaveBeenCalled();
	});

	it("creates the wildcard A record on the matching zone", async () => {
		const client = createClient();

		const result = await ensureCloudWildcardRecord({
			base: "notploy.app",
			env,
			client,
		});

		expect(result).toMatchObject({
			status: "ready",
			zoneId: "zone-1",
			recordId: "record-1",
		});
		expect(client.upsertRecord).toHaveBeenCalledWith(
			{ providerType: "cloudflare", apiToken: TOKEN },
			expect.objectContaining({
				zoneId: "zone-1",
				type: "A",
				name: "*.notploy.app",
				content: "203.0.113.10",
				proxied: true,
			}),
		);
	});

	it("uses a CNAME for a hostname ingress and AAAA for IPv6", async () => {
		const cnameClient = createClient();
		await ensureCloudWildcardRecord({
			base: "notploy.app",
			env: { ...env, NOTPLOY_CLOUD_INGRESS_TARGET: "ingress.notploy.app" },
			client: cnameClient,
		});
		expect(cnameClient.upsertRecord).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ type: "CNAME", content: "ingress.notploy.app" }),
		);

		resetCloudDnsCache();
		const ipv6Client = createClient();
		await ensureCloudWildcardRecord({
			base: "notploy.app",
			env: { ...env, NOTPLOY_CLOUD_INGRESS_TARGET: "2001:db8::1" },
			client: ipv6Client,
		});
		expect(ipv6Client.upsertRecord).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ type: "AAAA" }),
		);
	});

	it("does not call Cloudflare again within the cache window", async () => {
		const client = createClient();
		await ensureCloudWildcardRecord({ base: "notploy.app", env, client });
		await ensureCloudWildcardRecord({
			base: "notploy.app",
			env,
			client,
			now: Date.now() + 60_000,
		});

		expect(client.listZones).toHaveBeenCalledTimes(1);
		expect(client.upsertRecord).toHaveBeenCalledTimes(1);
	});

	it("bypasses the cache when forced", async () => {
		const client = createClient();
		await ensureCloudWildcardRecord({ base: "notploy.app", env, client });
		await ensureCloudWildcardRecord({
			base: "notploy.app",
			env,
			client,
			force: true,
		});

		expect(client.upsertRecord).toHaveBeenCalledTimes(2);
	});

	it("fails explicitly when no zone manages the base", async () => {
		const client = createClient([{ id: "other", name: "example.com" }]);

		await expect(
			ensureCloudWildcardRecord({ base: "notploy.app", env, client }),
		).rejects.toThrow("no zone manages notploy.app");
	});

	it("never leaks the API token in an error", async () => {
		const client = createClient();
		client.upsertRecord.mockRejectedValueOnce(
			new Error(`Cloudflare rejected token ${TOKEN}`),
		);

		const error = await ensureCloudWildcardRecord({
			base: "notploy.app",
			env,
			client,
		}).catch((thrown: unknown) => thrown);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).not.toContain(TOKEN);
		expect((error as Error).message).toContain("Cloudflare rejected");
	});
});
