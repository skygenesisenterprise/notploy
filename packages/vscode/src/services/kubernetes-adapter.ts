import { KUBERNETES_ROUTER } from "../core/capabilities";
import type { InstanceCapabilities } from "../core/domain";

/**
 * Kubernetes integration surface.
 *
 * **Status: not available.** The Notploy API has no Kubernetes router — the
 * cluster and swarm procedures in the OpenAPI document manage Docker Swarm
 * (`cluster.getNodes`, `swarm.getNodes`), not Kubernetes. The extension
 * therefore must not list fake clusters, namespaces or pods.
 *
 * What exists instead is this adapter boundary: when a `kubernetes` router
 * appears in an instance's OpenAPI document, capability detection flips
 * `capabilities.kubernetes` to true and {@link createKubernetesAdapter} can
 * return an implementation backed by those procedures. Until then the
 * Infrastructure view reports the reason instead of inventing resources.
 */

export interface KubernetesCluster {
	id: string;
	name: string;
	version?: string;
}

export interface KubernetesNamespace {
	name: string;
	status?: string;
}

export interface KubernetesResource {
	ref: KubernetesResourceRef;
	name: string;
	status?: string;
	/** Free-form labels/annotations worth showing in a tooltip. */
	details?: Record<string, string>;
}

export interface KubernetesResourceRef {
	clusterId: string;
	namespace?: string;
	kind: KubernetesResourceKind;
}

export type KubernetesResourceKind =
	| "namespace"
	| "deployment"
	| "pod"
	| "service";

export interface KubernetesAdapter {
	/** Whether the instance can actually serve Kubernetes data. */
	readonly available: boolean;
	/** Why it cannot, when `available` is false. Shown in the tree. */
	readonly unavailableReason?: string;
	clusters(): Promise<KubernetesCluster[]>;
	namespaces(clusterId?: string): Promise<KubernetesNamespace[]>;
	resources(ref?: KubernetesResourceRef): Promise<KubernetesResource[]>;
}

/**
 * Returned whenever the instance does not advertise the Kubernetes router.
 * Every method rejects or returns empty so nothing can be rendered that the
 * API did not provide.
 */
export class UnavailableKubernetesAdapter implements KubernetesAdapter {
	readonly available = false;
	readonly unavailableReason: string;

	constructor(reason: string) {
		this.unavailableReason = reason;
	}

	async clusters(): Promise<KubernetesCluster[]> {
		return [];
	}

	async namespaces(): Promise<KubernetesNamespace[]> {
		return [];
	}

	async resources(): Promise<KubernetesResource[]> {
		return [];
	}
}

/** Wording used in the tree and in troubleshooting docs. */
export const KUBERNETES_UNAVAILABLE_REASON =
	`The Notploy API does not expose a "${KUBERNETES_ROUTER}" router yet, so no Kubernetes ` +
	"clusters, namespaces, pods or services can be listed. The extension is ready to " +
	"enable them as soon as the instance advertises the router.";

export function createKubernetesAdapter(
	capabilities: InstanceCapabilities | undefined,
): KubernetesAdapter {
	if (capabilities?.kubernetes) {
		// A Kubernetes router exists on the instance. Wire the implementation to
		// it here when it lands; until then, treat it exactly like the absent
		// case so the UI cannot promise data it cannot fetch.
		return new UnavailableKubernetesAdapter(
			"This instance advertises a Kubernetes router, but this version of the extension has no " +
				"implementation for it yet. Update the extension.",
		);
	}
	return new UnavailableKubernetesAdapter(KUBERNETES_UNAVAILABLE_REASON);
}
