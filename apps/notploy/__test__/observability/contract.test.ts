import { describe, expect, it } from "vitest";
import {
	isAllowedObservabilityLabelKey,
	isFreshSample,
	toObservabilityLabels,
} from "@notploy/server/services/observability/types";
import {
	ObservabilityBackendError,
	validateObservabilityBackendUrl,
} from "@notploy/server/services/observability/backend-validation";

describe("observability labels", () => {
	it("maps resource refs to mastered label keys only", () => {
		expect(
			toObservabilityLabels({
				organizationId: "org_1",
				serverId: "srv_1",
				serviceId: "svc_1",
				serviceType: "application",
			}),
		).toEqual({
			notploy_org_id: "org_1",
			notploy_server_id: "srv_1",
			notploy_service_id: "svc_1",
			notploy_service_type: "application",
		});
	});

	it("rejects secret and unbounded label keys", () => {
		expect(isAllowedObservabilityLabelKey("notploy_server_id")).toBe(true);
		expect(isAllowedObservabilityLabelKey("token")).toBe(false);
		expect(isAllowedObservabilityLabelKey("password")).toBe(false);
		expect(isAllowedObservabilityLabelKey("user_agent")).toBe(false);
	});
});

describe("observability freshness", () => {
	it("treats missing or invalid timestamps as not fresh", () => {
		expect(isFreshSample(null, 60)).toBe(false);
		expect(isFreshSample("not-a-date", 60)).toBe(false);
	});

	it("marks samples beyond the threshold as stale", () => {
		const now = Date.parse("2026-10-25T12:00:00.000Z");
		expect(
			isFreshSample("2026-10-25T11:59:00.000Z", 60, now),
		).toBe(true);
		expect(
			isFreshSample("2026-10-25T11:58:00.000Z", 60, now),
		).toBe(false);
	});
});

describe("validateObservabilityBackendUrl", () => {
	it("accepts public backends and strips fragments", () => {
		expect(
			validateObservabilityBackendUrl(
				"https://prometheus.example.com:9090/api#frag",
				"prometheus",
			),
		).toBe("https://prometheus.example.com:9090/api");
	});

	it("allows private backends on Self by default", () => {
		expect(() =>
			validateObservabilityBackendUrl(
				"http://10.0.0.5:9090",
				"prometheus",
			),
		).not.toThrow();
	});

	it("blocks metadata, credentials, and non-http schemes", () => {
		for (const url of [
			"http://169.254.169.254/latest/meta-data",
			"http://metadata.google.internal/computeMetadata",
			"https://user:secret@grafana.example.com/",
			"file:///etc/prometheus.yml",
		]) {
			expect(() =>
				validateObservabilityBackendUrl(url, "grafana"),
			).toThrow(ObservabilityBackendError);
		}
	});

	it("blocks private backends when private networks are disabled", () => {
		expect(() =>
			validateObservabilityBackendUrl("http://localhost:3000", "grafana", {
				allowPrivateNetworks: false,
			}),
		).toThrow(ObservabilityBackendError);
		expect(() =>
			validateObservabilityBackendUrl(
				"https://grafana.example.com",
				"grafana",
				{ allowPrivateNetworks: false },
			),
		).not.toThrow();
	});
});
