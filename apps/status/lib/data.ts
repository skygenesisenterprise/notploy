/**
 * Server-side data access for the status application.
 *
 * Pages and route handlers read the platform directly instead of going
 * through HTTP: same process, no extra hop, and it keeps working when the
 * engine runs in *snapshot mode* (storage unavailable) because the last
 * known public pages are served from `platform.snapshot`.
 *
 * Everything returned here is already a public DTO — the projection is the
 * security boundary, so the UI can never display an internal field.
 */
import {
	getPublicIncident,
	getPublicPage,
	listPages,
	listPublicHistory,
	listPublicIncidents,
	listPublicMaintenances,
	type PublicHistoryEntryDto,
	type PublicIncidentDto,
	type PublicMaintenanceDto,
	type PublicPageDto,
} from "@notploy/status";
import { getPlatform } from "./engine";

export interface PageSummary {
	slug: string;
	name: string;
	description: string;
	status: PublicPageDto["status"];
	stale: boolean;
	updatedAt: string;
}

/** Every configured status page, in creation order. */
export const listStatusPages = (): PageSummary[] => {
	const platform = getPlatform();
	if (platform.ctx) {
		return listPages(platform.ctx);
	}
	return platform.snapshot.map((page) => ({
		slug: page.slug,
		name: page.name,
		description: page.description,
		status: page.status,
		stale: true,
		updatedAt: page.updatedAt,
	}));
};

/** Slug rendered at `/`; `STATUS_DEFAULT_PAGE` wins, then the first page. */
export const defaultPageSlug = (): string | null => {
	const configured = process.env.STATUS_DEFAULT_PAGE?.trim();
	if (configured) {
		return configured;
	}
	return listStatusPages()[0]?.slug ?? null;
};

export const resolvePublicPage = (slug: string): PublicPageDto | null => {
	const platform = getPlatform();
	if (platform.ctx) {
		return getPublicPage(platform.ctx, slug);
	}
	return platform.snapshot.find((page) => page.slug === slug) ?? null;
};

export const listActiveIncidents = (slug: string): PublicIncidentDto[] => {
	const platform = getPlatform();
	if (!platform.ctx) {
		return (
			platform.snapshot.find((page) => page.slug === slug)?.activeIncidents ??
			[]
		);
	}
	return listPublicIncidents(platform.ctx, slug, {
		status: "active",
		limit: 50,
	}).items;
};

export const listResolvedIncidents = (
	slug: string,
	limit = 10,
): PublicIncidentDto[] => {
	const platform = getPlatform();
	if (!platform.ctx) {
		return [];
	}
	return listPublicIncidents(platform.ctx, slug, { status: "resolved", limit })
		.items;
};

export const listScheduledMaintenances = (
	slug: string,
): PublicMaintenanceDto[] => {
	const platform = getPlatform();
	if (!platform.ctx) {
		return (
			platform.snapshot.find((page) => page.slug === slug)
				?.scheduledMaintenances ?? []
		);
	}
	return listPublicMaintenances(platform.ctx, slug, { limit: 20 }).items;
};

export const listHistoryEntries = (
	slug: string,
	limit = 20,
): PublicHistoryEntryDto[] => {
	const platform = getPlatform();
	if (!platform.ctx) {
		// History needs the database; degraded mode only serves the snapshot.
		return [];
	}
	return listPublicHistory(platform.ctx, slug, { limit }).items;
};

export const resolvePublicIncident = (
	slug: string,
	incidentId: string,
): PublicIncidentDto | null => {
	const platform = getPlatform();
	if (platform.ctx) {
		return getPublicIncident(platform.ctx, slug, incidentId);
	}
	return (
		platform.snapshot
			.find((page) => page.slug === slug)
			?.activeIncidents.find((incident) => incident.id === incidentId) ?? null
	);
};

/** `true` when the platform is serving the last known snapshot. */
export const isSnapshotMode = (): boolean => getPlatform().mode === "snapshot";

export interface StatusPageData {
	page: PublicPageDto;
	activeIncidents: PublicIncidentDto[];
	scheduledMaintenances: PublicMaintenanceDto[];
	resolvedIncidents: PublicIncidentDto[];
	snapshotMode: boolean;
}

/** Everything the public status page needs, in one call. */
export const loadStatusPage = (slug: string): StatusPageData | null => {
	const page = resolvePublicPage(slug);
	if (!page) {
		return null;
	}
	return {
		page,
		activeIncidents: listActiveIncidents(slug),
		scheduledMaintenances: listScheduledMaintenances(slug),
		resolvedIncidents: listResolvedIncidents(slug, 5),
		snapshotMode: isSnapshotMode(),
	};
};
