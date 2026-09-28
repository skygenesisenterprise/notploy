import { describe, expect, it } from "vitest";
import { EMPTY_CAPABILITIES } from "../src/core/domain";
import {
	createKubernetesAdapter,
	KUBERNETES_UNAVAILABLE_REASON,
	UnavailableKubernetesAdapter,
} from "../src/services/kubernetes-adapter";

describe("Kubernetes adapter", () => {
	it("is unavailable when the instance exposes no kubernetes router", async () => {
		const adapter = createKubernetesAdapter({
			...EMPTY_CAPABILITIES,
			docker: true,
		});
		expect(adapter.available).toBe(false);
		expect(adapter.unavailableReason).toBe(KUBERNETES_UNAVAILABLE_REASON);
		expect(await adapter.clusters()).toEqual([]);
		expect(await adapter.namespaces()).toEqual([]);
		expect(await adapter.resources()).toEqual([]);
	});

	it("is unavailable when no capability report exists at all", () => {
		expect(createKubernetesAdapter(undefined).available).toBe(false);
	});

	it("does not invent resources even if the router is advertised", async () => {
		const adapter = createKubernetesAdapter({
			...EMPTY_CAPABILITIES,
			kubernetes: true,
		});
		// The extension has no implementation yet, so it must stay honest rather
		// than return placeholder clusters.
		expect(adapter.available).toBe(false);
		expect(await adapter.clusters()).toEqual([]);
		expect(adapter.unavailableReason).toContain("no implementation");
	});

	it("explains the situation in the reason shown to users", () => {
		const adapter = new UnavailableKubernetesAdapter(
			KUBERNETES_UNAVAILABLE_REASON,
		);
		expect(adapter.unavailableReason).toContain("does not expose");
		expect(adapter.unavailableReason).toContain("kubernetes");
	});
});
