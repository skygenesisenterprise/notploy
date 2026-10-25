import { redactSecrets } from "../../utils/security/redact";
import { validateObservabilityBackendUrl } from "./backend-validation";
import { normalizeConnectorError, ObservabilityError } from "./errors";
import type {
	MetricSample,
	NormalizedMetricResult,
	ObservabilityFreshness,
	ObservabilityProviderCapabilities,
	ObservabilityTargetView,
	TypedMetricQuery,
} from "./types";

export const PROMETHEUS_TIMEOUT_MS = 15_000;
export const PROMETHEUS_STALE_THRESHOLD_SECONDS = 120;

export type PrometheusAuth =
	| { kind: "none" }
	| { kind: "bearer"; token: string }
	| { kind: "basic"; username: string; password: string };

export interface PrometheusClientOptions {
	baseUrl: string;
	auth?: PrometheusAuth;
	timeoutMs?: number;
	/** Self-hosted defaults to true (internal scrapes); Cloud passes false. */
	allowPrivateNetworks?: boolean;
}

const authHeaders = (auth: PrometheusAuth): Record<string, string> => {
	if (auth.kind === "bearer") return { Authorization: `Bearer ${auth.token}` };
	if (auth.kind === "basic") {
		const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString(
			"base64",
		);
		return { Authorization: `Basic ${encoded}` };
	}
	return {};
};

interface PrometheusVectorResponse {
	status: string;
	data?: {
		resultType?: string;
		result?: Array<{
			metric?: Record<string, string>;
			value?: [number, string];
		}>;
	};
}

interface PrometheusMatrixResponse {
	status: string;
	data?: {
		resultType?: string;
		result?: Array<{
			metric?: Record<string, string>;
			values?: Array<[number, string]>;
		}>;
	};
}

interface PrometheusTargetsResponse {
	status: string;
	data?: {
		activeTargets?: Array<{
			discoveredLabels?: Record<string, string>;
			labels?: Record<string, string>;
			scrapeUrl?: string;
			health?: string;
			lastScrape?: string;
			lastError?: string;
		}>;
	};
}

/**
 * Minimal Prometheus HTTP adapter (reads only, no Grafana dependency).
 *
 * - Base URL is validated configuration-time (SSRF guard).
 * - Every request carries an explicit timeout; no unbounded waits.
 * - Errors are typed and redacted — tokens never leak into messages.
 */
export const createPrometheusClient = (options: PrometheusClientOptions) => {
	const baseUrl = validateObservabilityBackendUrl(
		options.baseUrl,
		"prometheus",
		{ allowPrivateNetworks: options.allowPrivateNetworks ?? true },
	);
	const auth = options.auth ?? { kind: "none" };
	const timeoutMs = options.timeoutMs ?? PROMETHEUS_TIMEOUT_MS;

	const request = async <T>(
		path: string,
		params?: Record<string, string>,
	): Promise<T> => {
		const url = new URL(`${baseUrl}${path}`);
		for (const [key, value] of Object.entries(params ?? {})) {
			url.searchParams.set(key, value);
		}
		let response: Response;
		try {
			response = await fetch(url.toString(), {
				headers: { Accept: "application/json", ...authHeaders(auth) },
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			throw normalizeConnectorError(error, "prometheus", timeoutMs);
		}
		if (response.status === 401 || response.status === 403) {
			throw new ObservabilityError({
				category: "auth",
				backend: "prometheus",
				message: "The prometheus backend rejected the credentials.",
				statusCode: response.status,
			});
		}
		if (!response.ok) {
			throw new ObservabilityError({
				category: "network",
				backend: "prometheus",
				message: `The prometheus backend answered with HTTP ${response.status}.`,
				statusCode: response.status,
			});
		}
		try {
			return (await response.json()) as T;
		} catch (error) {
			throw new ObservabilityError({
				category: "invalid_response",
				backend: "prometheus",
				message: "The prometheus backend returned an unreadable response.",
				cause: error,
			});
		}
	};

	const toSamples = (
		values: Array<[number, string]> | undefined,
	): MetricSample[] =>
		(values ?? []).map(([timestamp, raw]) => {
			const parsed = Number.parseFloat(raw);
			return {
				timestamp: new Date(timestamp * 1000).toISOString(),
				value: Number.isFinite(parsed) ? parsed : null,
			};
		});

	const freshnessOf = (samples: MetricSample[]): ObservabilityFreshness => {
		const times = samples
			.map((sample) => Date.parse(sample.timestamp))
			.filter((time) => Number.isFinite(time))
			.sort((a, b) => a - b);
		return {
			lastScrapeAt:
				times.length > 0
					? new Date(times[times.length - 1] as number).toISOString()
					: null,
			freshnessThresholdSeconds: PROMETHEUS_STALE_THRESHOLD_SECONDS,
		};
	};

	return {
		baseUrl,

		/** Liveness probe (`/-/healthy` returns 200 with an empty body). */
		health: async (): Promise<boolean> => {
			const url = new URL(`${baseUrl}/-/healthy`);
			try {
				const response = await fetch(url.toString(), {
					headers: { ...authHeaders(auth) },
					signal: AbortSignal.timeout(timeoutMs),
				});
				return response.ok;
			} catch (error) {
				throw normalizeConnectorError(error, "prometheus", timeoutMs);
			}
		},

		queryInstant: async (
			query: TypedMetricQuery,
			expr: string,
		): Promise<NormalizedMetricResult> => {
			let body: PrometheusVectorResponse;
			try {
				body = await request<PrometheusVectorResponse>("/api/v1/query", {
					query: expr,
					...(query.start ? { time: query.start } : {}),
				});
			} catch (error) {
				if (error instanceof ObservabilityError) throw error;
				throw normalizeConnectorError(error, "prometheus", timeoutMs);
			}
			if (body.status !== "success") {
				throw new ObservabilityError({
					category: "invalid_response",
					backend: "prometheus",
					message: "The prometheus backend rejected the instant query.",
				});
			}
			const first = body.data?.result?.[0];
			const samples = first?.value ? toSamples([first.value]) : [];
			return {
				query,
				availability: samples.length > 0 ? "available" : "unavailable",
				samples,
				freshness: freshnessOf(samples),
				...(samples.length > 0
					? {}
					: { reason: "The query returned no series for this range." }),
			};
		},

		queryRange: async (
			query: TypedMetricQuery,
			expr: string,
		): Promise<NormalizedMetricResult> => {
			if (!query.end) {
				throw new ObservabilityError({
					category: "unsupported",
					backend: "prometheus",
					message: "Range queries require an end timestamp.",
				});
			}
			let body: PrometheusMatrixResponse;
			try {
				body = await request<PrometheusMatrixResponse>("/api/v1/query_range", {
					query: expr,
					start: query.start,
					end: query.end,
					step: query.step ?? "1m",
				});
			} catch (error) {
				if (error instanceof ObservabilityError) throw error;
				throw normalizeConnectorError(error, "prometheus", timeoutMs);
			}
			if (body.status !== "success") {
				throw new ObservabilityError({
					category: "invalid_response",
					backend: "prometheus",
					message: "The prometheus backend rejected the range query.",
				});
			}
			const samples = toSamples(body.data?.result?.[0]?.values);
			return {
				query,
				availability: samples.length > 0 ? "available" : "unavailable",
				samples,
				freshness: freshnessOf(samples),
				...(samples.length > 0
					? {}
					: { reason: "The query returned no series for this range." }),
			};
		},

		targets: async (): Promise<ObservabilityTargetView[]> => {
			const body = await request<PrometheusTargetsResponse>("/api/v1/targets", {
				state: "active",
			});
			if (body.status !== "success") {
				throw new ObservabilityError({
					category: "invalid_response",
					backend: "prometheus",
					message: "The prometheus backend returned unreadable targets.",
				});
			}
			return (body.data?.activeTargets ?? []).map((target) => {
				const lastScrape = target.lastScrape ?? null;
				const healthy = target.health === "up";
				return {
					name:
						target.labels?.job ??
						target.discoveredLabels?.__metrics_path__ ??
						"unknown",
					url: redactSecrets(target.scrapeUrl ?? ""),
					state: healthy ? "healthy" : "unreachable",
					lastScrapeAt: lastScrape,
					lastError: target.lastError ? redactSecrets(target.lastError) : null,
				} satisfies ObservabilityTargetView;
			});
		},

		capabilities: async (): Promise<ObservabilityProviderCapabilities> => {
			const [healthy, targets] = await Promise.all([
				request<unknown>("/-/healthy").then(
					() => true,
					() => false,
				),
				request<PrometheusTargetsResponse>("/api/v1/targets", {
					state: "active",
				}).then(
					() => true,
					() => false,
				),
			]).catch(() => [false, false] as const);
			return {
				prometheus: healthy,
				grafana: false,
				targets,
				alerts: false,
				rules: false,
				dashboards: false,
				externalLabels: true,
			};
		},
	};
};

export type PrometheusClient = ReturnType<typeof createPrometheusClient>;
