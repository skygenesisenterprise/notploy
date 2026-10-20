import { isIP } from "node:net";
import { cloudflareClient } from "@notploy/server/utils/dns/cloudflare";
import type { DnsClient } from "@notploy/server/utils/dns/types";
import { redactSecretValues } from "@notploy/server/utils/security/redact";

/**
 * Cloudflare-side DNS bootstrap for Notploy Cloud hostnames (issue https://github.com/skygenesisenterprise/notploy/issues/113 §2).
 *
 * Ownership and uniqueness stay in the `cloud_domain` ledger; Cloudflare is
 * only the resolution layer. A single wildcard record (`*.notploy.app`) is
 * enough for every generated hostname, so deployments never create DNS records
 * per tenant and the zone does not become an ownership database.
 *
 * Configuration is central and optional:
 * - `CLOUDFLARE_API_TOKEN` (required to enable)
 * - `NOTPLOY_CLOUD_DNS_ZONE_ID` (optional; resolved from the zone list)
 * - `NOTPLOY_CLOUD_INGRESS_TARGET` (A/AAAA IP or CNAME target of the ingress)
 * - `NOTPLOY_CLOUD_DNS_PROXIED` (defaults to `true`, Cloudflare terminates TLS)
 */

export const CLOUDFLARE_TOKEN_ENV = "CLOUDFLARE_API_TOKEN";
export const CLOUD_DNS_ZONE_ENV = "NOTPLOY_CLOUD_DNS_ZONE_ID";
export const CLOUD_DNS_TARGET_ENV = "NOTPLOY_CLOUD_INGRESS_TARGET";
export const CLOUD_DNS_PROXIED_ENV = "NOTPLOY_CLOUD_DNS_PROXIED";

const CACHE_TTL_MS = 5 * 60 * 1000;
const RECORD_COMMENT = "Managed by Notploy Cloud";

export interface CloudDnsConfig {
	apiToken: string;
	zoneId: string | null;
	target: string;
	proxied: boolean;
}

export interface CloudDnsResult {
	status: "ready" | "skipped";
	zoneId?: string;
	recordId?: string;
	reason?: string;
}

const cache = new Map<
	string,
	{ expiresAt: number; zoneId: string; recordId: string }
>();

/** Test-only hook: clears the in-memory wildcard cache. */
export const resetCloudDnsCache = () => cache.clear();

export const getCloudDnsConfig = (
	env: Record<string, string | undefined> = process.env,
): CloudDnsConfig | null => {
	const apiToken = env[CLOUDFLARE_TOKEN_ENV]?.trim();
	const target = env[CLOUD_DNS_TARGET_ENV]?.trim();
	if (!apiToken || !target) {
		return null;
	}
	return {
		apiToken,
		zoneId: env[CLOUD_DNS_ZONE_ENV]?.trim() || null,
		target,
		// Proxied by default: Cloudflare serves the wildcard TLS certificate at
		// the edge, which is what makes generated hostnames HTTPS with no
		// per-host ACME. Set to `false` for a DNS-only setup.
		proxied: (env[CLOUD_DNS_PROXIED_ENV] ?? "true").toLowerCase() !== "false",
	};
};

const recordTypeFor = (target: string): "A" | "AAAA" | "CNAME" => {
	const ip = isIP(target);
	if (ip === 4) return "A";
	if (ip === 6) return "AAAA";
	return "CNAME";
};

/** Longest matching zone for a hostname (`a.b.notploy.app` → `notploy.app`). */
export const selectZoneId = (
	zones: { id: string; name: string }[],
	base: string,
): string | null => {
	const matches = zones
		.filter((zone) => base === zone.name || base.endsWith(`.${zone.name}`))
		.sort((left, right) => right.name.length - left.name.length);
	return matches[0]?.id ?? null;
};

export const ensureCloudWildcardRecord = async ({
	base,
	env = process.env,
	force = false,
	now = Date.now(),
	client = cloudflareClient,
}: {
	base: string | null;
	env?: Record<string, string | undefined>;
	force?: boolean;
	now?: number;
	client?: Pick<DnsClient, "listZones" | "upsertRecord">;
}): Promise<CloudDnsResult> => {
	if (!base) {
		return { status: "skipped", reason: "No cloud domain base configured" };
	}

	const config = getCloudDnsConfig(env);
	if (!config) {
		return {
			status: "skipped",
			reason:
				"Cloudflare DNS is not configured (CLOUDFLARE_API_TOKEN / NOTPLOY_CLOUD_INGRESS_TARGET)",
		};
	}

	const cacheKey = `${base}|${config.target}|${config.proxied}|${config.zoneId ?? "auto"}`;
	const cached = cache.get(cacheKey);
	if (!force && cached && cached.expiresAt > now) {
		return {
			status: "ready",
			zoneId: cached.zoneId,
			recordId: cached.recordId,
		};
	}

	try {
		const zoneId =
			config.zoneId ??
			selectZoneId(
				await client.listZones({
					providerType: "cloudflare",
					apiToken: config.apiToken,
				}),
				base,
			);

		if (!zoneId) {
			throw new Error(`Cloudflare: no zone manages ${base}`);
		}

		const record = await client.upsertRecord(
			{ providerType: "cloudflare", apiToken: config.apiToken },
			{
				zoneId,
				type: recordTypeFor(config.target),
				name: `*.${base}`,
				content: config.target,
				ttl: 1,
				proxied: config.proxied,
				comment: RECORD_COMMENT,
			},
		);

		cache.set(cacheKey, {
			expiresAt: now + CACHE_TTL_MS,
			zoneId,
			recordId: record.id,
		});

		return { status: "ready", zoneId, recordId: record.id };
	} catch (error) {
		// Cloudflare errors are safe to surface, but a provider can echo the token
		// without any `key=value` shape, so mask the exact configured value too.
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(redactSecretValues(message, [config.apiToken]));
	}
};
