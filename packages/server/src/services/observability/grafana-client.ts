import { redactSecrets } from "../../utils/security/redact";
import { validateObservabilityBackendUrl } from "./backend-validation";
import { normalizeConnectorError, ObservabilityError } from "./errors";

export const GRAFANA_TIMEOUT_MS = 15_000;

export interface GrafanaClientOptions {
	baseUrl: string;
	/** Grafana service-account token (`glsa_…`). Never a personal password. */
	token?: string;
	timeoutMs?: number;
	allowPrivateNetworks?: boolean;
}

export interface GrafanaDatasourceView {
	uid: string;
	name: string;
	type: string;
	url: string;
	isDefault: boolean;
}

export interface GrafanaDashboardRef {
	uid: string;
	title: string;
	url: string;
	folderTitle?: string;
}

/**
 * Minimal Grafana HTTP adapter (visualization only).
 *
 * Nothing here is required for Prometheus reads. Importing this module must
 * never pull a Grafana dependency into Prometheus-only code paths.
 */
export const createGrafanaClient = (options: GrafanaClientOptions) => {
	const baseUrl = validateObservabilityBackendUrl(options.baseUrl, "grafana", {
		allowPrivateNetworks: options.allowPrivateNetworks ?? true,
	});
	const timeoutMs = options.timeoutMs ?? GRAFANA_TIMEOUT_MS;
	const headers: Record<string, string> = { Accept: "application/json" };
	if (options.token) headers.Authorization = `Bearer ${options.token}`;

	const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
		let response: Response;
		try {
			response = await fetch(`${baseUrl}${path}`, {
				...init,
				headers: { ...headers, ...init?.headers },
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			throw normalizeConnectorError(error, "grafana", timeoutMs);
		}
		if (response.status === 401 || response.status === 403) {
			throw new ObservabilityError({
				category: "auth",
				backend: "grafana",
				message: "The grafana backend rejected the credentials.",
				statusCode: response.status,
			});
		}
		if (!response.ok) {
			throw new ObservabilityError({
				category: "network",
				backend: "grafana",
				message: `The grafana backend answered with HTTP ${response.status}.`,
				statusCode: response.status,
			});
		}
		try {
			return (await response.json()) as T;
		} catch (error) {
			throw new ObservabilityError({
				category: "invalid_response",
				backend: "grafana",
				message: "The grafana backend returned an unreadable response.",
				cause: error,
			});
		}
	};

	return {
		baseUrl,

		health: async (): Promise<boolean> => {
			try {
				const body = await request<{ database?: string }>("/api/health");
				return body.database === "ok";
			} catch (error) {
				if (error instanceof ObservabilityError) throw error;
				throw normalizeConnectorError(error, "grafana", timeoutMs);
			}
		},

		listDatasources: async (): Promise<GrafanaDatasourceView[]> => {
			const body =
				await request<
					Array<{
						uid?: string;
						name?: string;
						type?: string;
						url?: string;
						isDefault?: boolean;
					}>
				>("/api/datasources");
			return (Array.isArray(body) ? body : []).map((entry) => ({
				uid: entry.uid ?? "",
				name: entry.name ?? "unknown",
				type: entry.type ?? "unknown",
				url: redactSecrets(entry.url ?? ""),
				isDefault: entry.isDefault ?? false,
			}));
		},

		listDashboards: async (
			query = "notploy",
		): Promise<GrafanaDashboardRef[]> => {
			const params = new URLSearchParams({ type: "dash-db", query });
			const body = await request<
				Array<{
					uid?: string;
					title?: string;
					url?: string;
					folderTitle?: string;
				}>
			>(`/api/search?${params.toString()}`);
			return (Array.isArray(body) ? body : []).map((entry) => ({
				uid: entry.uid ?? "",
				title: entry.title ?? "Untitled",
				url: entry.url ? `${baseUrl}${entry.url}` : baseUrl,
				folderTitle: entry.folderTitle,
			}));
		},

		/**
		 * Opt-in, non-destructive dashboard import.
		 *
		 * Defaults to `overwrite: false` so existing dashboards and user
		 * customizations are never clobbered silently; callers must pass
		 * `overwrite: true` explicitly after user confirmation.
		 */
		importDashboard: async (
			dashboard: Record<string, unknown>,
			{ overwrite = false }: { overwrite?: boolean } = {},
		): Promise<{ uid: string; url: string }> => {
			if (!dashboard || typeof dashboard !== "object") {
				throw new ObservabilityError({
					category: "unsupported",
					backend: "grafana",
					message: "A dashboard object is required for import.",
				});
			}
			const body = await request<{
				uid?: string;
				url?: string;
				status?: string;
			}>("/api/dashboards/db", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dashboard, overwrite }),
			});
			return {
				uid: String(body.uid ?? ""),
				url: body.url ? `${baseUrl}${body.url}` : baseUrl,
			};
		},

		/** Deep link to Grafana Explore for a PromQL expression. */
		exploreUrl: (expr: string): string =>
			`${baseUrl}/explore?left=${encodeURIComponent(
				JSON.stringify({
					datasource: "Notploy Prometheus",
					queries: [{ expr }],
				}),
			)}`,
	};
};

export type GrafanaClient = ReturnType<typeof createGrafanaClient>;
