/**
 * Shared vocabulary of the Community page.
 *
 * The filters mirror the API input exactly, so what the operator picks is what
 * the queries receive. Formatting helpers are centralised here so every panel
 * renders a date or a count the same way.
 */

export type CommunityRangePreset = "24h" | "7d" | "30d" | "90d" | "custom";

export interface CommunityFilterState {
	preset: CommunityRangePreset;
	from?: Date;
	to?: Date;
	/** `all` or a tracked repository id. */
	repositoryId: string;
	/** Event types included in the feed; empty means every type. */
	eventTypes: string[];
}

export const DEFAULT_COMMUNITY_FILTERS: CommunityFilterState = {
	preset: "30d",
	repositoryId: "all",
	eventTypes: [],
};

export const COMMUNITY_RANGE_PRESETS: {
	value: CommunityRangePreset;
	label: string;
}[] = [
	{ value: "24h", label: "Last 24 hours" },
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "90d", label: "Last 90 days" },
	{ value: "custom", label: "Custom range" },
];

export const COMMUNITY_EVENT_TYPE_LABELS: Record<string, string> = {
	"issue-opened": "Issue opened",
	"issue-closed": "Issue closed",
	"pull-request-opened": "Pull request opened",
	"pull-request-review": "Pull request reviewed",
	"pull-request-merged": "Pull request merged",
	"pull-request-closed": "Pull request closed",
	"release-published": "Release published",
	"repository-activity": "Repository activity",
	other: "Other",
};

export const COMMUNITY_ATTENTION_LABELS: Record<string, string> = {
	"awaiting-review": "Awaiting review",
	stale: "Stale",
	unanswered: "Unanswered",
	unassigned: "Unassigned",
};

export const COMMUNITY_SOURCE_STATUS_LABELS: Record<string, string> = {
	connected: "Connected",
	syncing: "Syncing",
	error: "Sync error",
	"rate-limited": "Rate limited",
	"needs-authorization": "Needs authorization",
};

/** Payload shared by the period-scoped queries. */
export const toCommunityRangeInput = (filters: CommunityFilterState) => ({
	preset: filters.preset,
	from: filters.preset === "custom" ? filters.from?.toISOString() : undefined,
	to: filters.preset === "custom" ? filters.to?.toISOString() : undefined,
});

export const toRepositoryScope = (
	filters: CommunityFilterState,
): string[] | undefined =>
	filters.repositoryId === "all" ? undefined : [filters.repositoryId];

const numberFormatter = new Intl.NumberFormat("en-US");

export const formatCount = (value: number | null | undefined): string =>
	value === null || value === undefined ? "—" : numberFormatter.format(value);

export const formatDateTime = (value: string | null | undefined): string => {
	if (!value) {
		return "—";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const formatRelative = (value: string | null | undefined): string => {
	if (!value) {
		return "never";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "never";
	}
	const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours} h ago`;
	return `${Math.round(hours / 24)} d ago`;
};

/**
 * Freshness hint for cached GitHub data.
 *
 * The console never pretends the cache is live: past this threshold the data is
 * labelled as possibly stale.
 */
export const COMMUNITY_STALE_AFTER_MINUTES = 60;

export const isCommunityDataStale = (
	lastSyncedAt: string | null | undefined,
): boolean => {
	if (!lastSyncedAt) {
		return true;
	}
	const date = new Date(lastSyncedAt);
	if (Number.isNaN(date.getTime())) {
		return true;
	}
	return (
		(Date.now() - date.getTime()) / 60000 > COMMUNITY_STALE_AFTER_MINUTES
	);
};

/** GitHub links are always opened in a new tab, marked as external. */
export const isExternalLink = (href: string | null | undefined): boolean =>
	!!href && /^https?:\/\//i.test(href);
