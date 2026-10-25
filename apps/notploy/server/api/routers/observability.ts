/**
 * Observability router — external Prometheus/Grafana connections.
 *
 * Boundaries enforced here:
 * - Reads (`monitoring:read`) never touch Grafana: Prometheus-only paths.
 * - Connection testing is a configuration action (`server:create`), kept
 *   separate from reads. Credentials travel in the request only, are never
 *   persisted by these procedures, and never appear in responses or logs.
 * - Every backend URL passes the SSRF configuration-time guard and every
 *   outbound call carries an explicit timeout.
 */

import {
	createGrafanaClient,
	createPrometheusClient,
	isFreshSample,
	type ObservabilityConnectionState,
	ObservabilityError,
	PROMETHEUS_STALE_THRESHOLD_SECONDS,
	validateObservabilityBackendUrl,
} from "@notploy/server/services/observability/index";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";

const backendUrl = z.string().min(1).max(500);

const prometheusAuth = z
	.object({
		token: z.string().min(1).max(2000).optional(),
		username: z.string().min(1).max(256).optional(),
		password: z.string().min(1).max(2000).optional(),
	})
	.optional();

const connectionInput = z.object({
	url: backendUrl,
	auth: prometheusAuth,
});

const toAuth = (input: {
	auth?: { token?: string; username?: string; password?: string };
}) => {
	if (input.auth?.token)
		return { kind: "bearer" as const, token: input.auth.token };
	if (input.auth?.username && input.auth?.password) {
		return {
			kind: "basic" as const,
			username: input.auth.username,
			password: input.auth.password,
		};
	}
	return { kind: "none" as const };
};

const toTRPCError = (error: unknown): TRPCError => {
	if (error instanceof TRPCError) return error;
	if (error instanceof ObservabilityError) {
		const code =
			error.category === "auth"
				? "UNAUTHORIZED"
				: error.category === "timeout"
					? "TIMEOUT"
					: "BAD_GATEWAY";
		return new TRPCError({ code, message: error.message, cause: error });
	}
	if (error instanceof z.ZodError) {
		return new TRPCError({
			code: "BAD_REQUEST",
			message: "The observability backend URL is invalid.",
			cause: error,
		});
	}
	return new TRPCError({
		code: "BAD_GATEWAY",
		message: error instanceof Error ? error.message : "Backend request failed.",
		cause: error,
	});
};

export const observabilityRouter = createTRPCRouter({
	/**
	 * Configuration action: validate + probe an external Prometheus.
	 * Requires `server:create` so plain readers cannot exfiltrate or probe
	 * internal networks through backend URLs.
	 */
	testPrometheusConnection: withPermission("server", "create")
		.input(connectionInput)
		.mutation(async ({ input, ctx }) => {
			try {
				const url = validateObservabilityBackendUrl(input.url, "prometheus");
				const client = createPrometheusClient({
					baseUrl: url,
					auth: toAuth(input),
				});
				const [healthy, targets] = await Promise.all([
					client.health().catch(() => false),
					client.targets().catch(() => null),
				]);
				const result = {
					ok: healthy,
					url,
					capabilities: {
						prometheus: healthy,
						grafana: false,
						targets: targets !== null,
						alerts: false,
						rules: false,
						dashboards: false,
						externalLabels: true,
					},
					targetCount: targets?.length ?? 0,
					unhealthyTargets: (targets ?? []).filter(
						(target) => target.state !== "healthy",
					).length,
				};
				await audit(ctx, {
					action: "create",
					resourceType: "settings",
					resourceName: url,
					metadata: { backend: "prometheus", ok: healthy },
				});
				return result;
			} catch (error) {
				throw toTRPCError(error);
			}
		}),

	/** Prometheus instant query (read-only, Prometheus adapter only). */
	queryPrometheus: withPermission("monitoring", "read")
		.input(
			connectionInput.extend({
				expr: z.string().min(1).max(2000),
				time: z.string().datetime({ offset: true }).optional(),
			}),
		)
		.query(async ({ input }) => {
			try {
				const url = validateObservabilityBackendUrl(input.url, "prometheus");
				const client = createPrometheusClient({
					baseUrl: url,
					auth: toAuth(input),
				});
				return await client.queryInstant(
					{
						kind: "app.custom",
						labels: {},
						start: input.time ?? new Date().toISOString(),
					},
					input.expr,
				);
			} catch (error) {
				throw toTRPCError(error);
			}
		}),

	/** Active Prometheus targets with freshness states (read-only). */
	prometheusTargets: withPermission("monitoring", "read")
		.input(connectionInput)
		.query(async ({ input }) => {
			try {
				const url = validateObservabilityBackendUrl(input.url, "prometheus");
				const client = createPrometheusClient({
					baseUrl: url,
					auth: toAuth(input),
				});
				const targets = await client.targets();
				return targets.map((target) => {
					let state: ObservabilityConnectionState =
						target.state === "healthy" ? "healthy" : "unreachable";
					if (
						state === "healthy" &&
						!isFreshSample(
							target.lastScrapeAt,
							PROMETHEUS_STALE_THRESHOLD_SECONDS,
						)
					) {
						state = "stale";
					}
					return { ...target, state };
				});
			} catch (error) {
				throw toTRPCError(error);
			}
		}),

	/**
	 * Configuration action: validate + probe an external Grafana.
	 * Grafana is optional and independent: Prometheus works without it.
	 */
	testGrafanaConnection: withPermission("server", "create")
		.input(
			z.object({
				url: backendUrl,
				token: z.string().min(1).max(2000).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				const url = validateObservabilityBackendUrl(input.url, "grafana");
				const client = createGrafanaClient({
					baseUrl: url,
					token: input.token,
				});
				const healthy = await client.health().catch(() => false);
				const dashboards = healthy
					? await client.listDashboards().catch(() => null)
					: null;
				const result = {
					ok: healthy,
					url,
					dashboardCount: dashboards?.length ?? 0,
					dashboards: (dashboards ?? []).slice(0, 20),
				};
				await audit(ctx, {
					action: "create",
					resourceType: "settings",
					resourceName: url,
					metadata: { backend: "grafana", ok: healthy },
				});
				return result;
			} catch (error) {
				throw toTRPCError(error);
			}
		}),

	/** Grafana dashboards for deep links (read-only). */
	grafanaDashboards: withPermission("monitoring", "read")
		.input(
			z.object({
				url: backendUrl,
				token: z.string().min(1).max(2000).optional(),
				query: z.string().max(200).default("notploy"),
			}),
		)
		.query(async ({ input }) => {
			try {
				const url = validateObservabilityBackendUrl(input.url, "grafana");
				const client = createGrafanaClient({
					baseUrl: url,
					token: input.token,
				});
				return await client.listDashboards(input.query);
			} catch (error) {
				throw toTRPCError(error);
			}
		}),
});
