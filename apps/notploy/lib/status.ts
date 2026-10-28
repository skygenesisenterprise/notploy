/**
 * Bridge between the Notploy Console and a Notploy Status instance.
 *
 * The console never touches the status database: it talks to the status
 * application over HTTP through the official integration client
 * (`StatusPublisher` from `@notploy/status/client`) with a scoped bearer
 * token, exactly like any other machine-to-machine consumer. That means an
 * incident introduced from this console, from the status admin UI or by the
 * monitoring agent all lands in the same platform — so the Incidents page
 * shows every entry regardless of where it was created, and anything
 * published here is immediately visible on the public status page.
 *
 * Configuration (see `.env.example`):
 * - `STATUS_URL`   base URL of the status instance, e.g. `http://localhost:4100`
 * - `STATUS_TOKEN` administration token carrying the `read`, `write` and
 *                  `publish` scopes.
 */

import type {
	AdminComponentDto,
	AdminIncidentDto,
	AdminMaintenanceDto,
	AdminPageDto,
} from "@notploy/status";
import { StatusPublisher, StatusPublisherError } from "@notploy/status";

export type {
	AdminComponentDto,
	AdminIncidentDto,
	AdminMaintenanceDto,
	AdminPageDto,
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
} from "@notploy/status";

/** Everything the console knows about one status page. */
export interface StatusPageOverview {
	page: AdminPageDto;
	components: AdminComponentDto[];
	incidents: AdminIncidentDto[];
	maintenances: AdminMaintenanceDto[];
}

/** Aggregate rendered by the dashboard Incidents page. */
export interface StatusOverview {
	/** `false` when `STATUS_URL` / `STATUS_TOKEN` are missing. */
	configured: boolean;
	pages: StatusPageOverview[];
	/** Set when the status instance could not be reached or answered an error. */
	error: string | null;
}

const trimTrailingSlashes = (value: string): string =>
	value.trim().replace(/\/+$/, "");

/** Connection settings, or `null` when the integration is not configured. */
export const getStatusConnection = (): {
	baseUrl: string;
	token: string;
} | null => {
	const baseUrl = process.env.STATUS_URL
		? trimTrailingSlashes(process.env.STATUS_URL)
		: null;
	const token = process.env.STATUS_TOKEN?.trim() || null;
	if (!baseUrl || !token) {
		return null;
	}
	return { baseUrl, token };
};

export const isStatusConfigured = (): boolean => getStatusConnection() !== null;

/**
 * Publisher bound to the configured status instance. Deliberately created per
 * call: the client is stateless (plain `fetch`) and this keeps serverless /
 * multi-process deployments free of shared state.
 */
export const getStatusPublisher = (): StatusPublisher | null => {
	const connection = getStatusConnection();
	if (!connection) {
		return null;
	}
	return new StatusPublisher({
		...connection,
		retries: 2,
		retryDelayMs: 300,
	});
};

/** Human-readable message for an integration failure. */
export const statusErrorMessage = (error: unknown): string => {
	if (error instanceof StatusPublisherError) {
		const body = error.body as { message?: string; error?: string } | null;
		return (
			body?.message ??
			body?.error ??
			`The status instance responded ${error.status}`
		);
	}
	return error instanceof Error
		? error.message
		: "Unable to reach the status instance";
};

/**
 * Load every status page with its components, incidents and maintenances —
 * the whole dialogue between the console and the status platform in one call.
 * Never throws: a missing configuration or an unreachable instance is
 * reported in the returned payload so the page can explain itself instead of
 * crashing the dashboard.
 */
export const loadStatusOverview = async (): Promise<StatusOverview> => {
	const publisher = getStatusPublisher();
	if (!publisher) {
		return { configured: false, pages: [], error: null };
	}
	try {
		const { items: pages } = await publisher.listPages();
		const overview = await Promise.all(
			pages.map(async (page): Promise<StatusPageOverview> => {
				const [components, incidents, maintenances] = await Promise.all([
					publisher.listComponents(page.slug),
					publisher.listIncidents(page.slug),
					publisher.listMaintenances(page.slug),
				]);
				return {
					page,
					components: components.items,
					incidents: incidents.items,
					maintenances: maintenances.items,
				};
			}),
		);
		return { configured: true, pages: overview, error: null };
	} catch (error) {
		return { configured: true, pages: [], error: statusErrorMessage(error) };
	}
};
