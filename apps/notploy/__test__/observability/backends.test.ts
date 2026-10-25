import { afterEach, describe, expect, it, vi } from "vitest";
import { createGrafanaClient } from "@notploy/server/services/observability/grafana-client";
import {
	createPrometheusClient,
	PROMETHEUS_STALE_THRESHOLD_SECONDS,
} from "@notploy/server/services/observability/prometheus-client";
import { isFreshSample } from "@notploy/server/services/observability/types";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("prometheus client", () => {
	it("reports healthy on 200 from /-/healthy", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("", { status: 200 })),
		);
		const client = createPrometheusClient({
			baseUrl: "https://prometheus.example.com:9090",
		});
		await expect(client.health()).resolves.toBe(true);
	});

	it("maps instant queries without zero-filling absent data", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					status: "success",
					data: {
						resultType: "vector",
						result: [{ metric: {}, value: [1_790_000_000, "0.42"] }],
					},
				}),
			),
		);
		const client = createPrometheusClient({
			baseUrl: "https://prometheus.example.com:9090",
		});
		const result = await client.queryInstant(
			{ kind: "app.custom", labels: {}, start: new Date().toISOString() },
			"up",
		);
		expect(result.availability).toBe("available");
		expect(result.samples).toHaveLength(1);
		expect(result.samples[0]?.value).toBeCloseTo(0.42);
		expect(result.freshness.lastScrapeAt).not.toBeNull();
	});

	it("marks empty query results unavailable instead of zero", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({ status: "success", data: { result: [] } }),
			),
		);
		const client = createPrometheusClient({
			baseUrl: "https://prometheus.example.com:9090",
		});
		const result = await client.queryInstant(
			{ kind: "app.custom", labels: {}, start: new Date().toISOString() },
			"up",
		);
		expect(result.availability).toBe("unavailable");
		expect(result.samples).toHaveLength(0);
		expect(result.reason).toBeTruthy();
	});

	it("redacts credentials from target URLs and errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse({
					status: "success",
					data: {
						activeTargets: [
							{
								labels: { job: "node-exporter" },
								scrapeUrl: "http://admin:s3cret@example:9100/metrics",
								health: "down",
								lastScrape: "2026-10-25T12:00:00.000Z",
								lastError: "token=abc123 connection refused",
							},
						],
					},
				}),
			),
		);
		const client = createPrometheusClient({
			baseUrl: "https://prometheus.example.com:9090",
		});
		const targets = await client.targets();
		expect(targets).toHaveLength(1);
		expect(targets[0]?.url).not.toContain("s3cret");
		expect(targets[0]?.lastError).not.toContain("abc123");
		expect(targets[0]?.state).toBe("unreachable");
	});

	it("treats stale scrapes as stale, not healthy", () => {
		const old = new Date(
			Date.now() - (PROMETHEUS_STALE_THRESHOLD_SECONDS + 60) * 1000,
		).toISOString();
		expect(
			isFreshSample(old, PROMETHEUS_STALE_THRESHOLD_SECONDS),
		).toBe(false);
	});
});

describe("grafana client", () => {
	it("imports dashboards without overwriting by default", async () => {
		const seen: Array<{ url: string; body: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
				if (String(url).endsWith("/api/dashboards/db")) {
					seen.push({ url: String(url), body: String(init?.body) });
					return jsonResponse({ uid: "abc", url: "/d/abc/x" });
				}
				return jsonResponse({ database: "ok" });
			}),
		);
		const client = createGrafanaClient({
			baseUrl: "https://grafana.example.com",
			token: "glsa_secret",
		});
		await expect(client.health()).resolves.toBe(true);
		const imported = await client.importDashboard({ title: "Notploy" });
		expect(imported.uid).toBe("abc");
		expect(seen).toHaveLength(1);
		expect(JSON.parse(seen[0]?.body ?? "{}").overwrite).toBe(false);
	});
});
