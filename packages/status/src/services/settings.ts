/**
 * Page settings resolution.
 *
 * Stored settings are a partial JSON document; every read goes through
 * `resolveSettings` so defaults are applied in exactly one place and the
 * state engine always receives a complete configuration.
 */

import { DEFAULT_SEVERITY_TO_STATUS } from "../core/status-engine";
import type {
	GlobalStatus,
	IncidentSeverity,
	PageSettings,
} from "../core/types";
import type { PageRow } from "../store/repositories";

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
	staleAfterSeconds: 120,
	refreshIntervalSeconds: 30,
	showHistory: true,
	historyLimit: 10,
	autoIncident: false,
	autoPublish: false,
	autoIncidentWindowSeconds: 300,
	severityToStatus: { ...DEFAULT_SEVERITY_TO_STATUS },
};

export const resolveSettings = (row: PageRow): PageSettings => {
	let stored: Partial<PageSettings> = {};
	try {
		stored = JSON.parse(row.settings_json) as Partial<PageSettings>;
	} catch {
		stored = {};
	}
	const severityToStatus: Record<IncidentSeverity, GlobalStatus> = {
		minor: stored.severityToStatus?.minor ?? DEFAULT_SEVERITY_TO_STATUS.minor,
		major: stored.severityToStatus?.major ?? DEFAULT_SEVERITY_TO_STATUS.major,
		critical:
			stored.severityToStatus?.critical ?? DEFAULT_SEVERITY_TO_STATUS.critical,
	};
	return {
		staleAfterSeconds:
			stored.staleAfterSeconds ?? DEFAULT_PAGE_SETTINGS.staleAfterSeconds,
		refreshIntervalSeconds:
			stored.refreshIntervalSeconds ??
			DEFAULT_PAGE_SETTINGS.refreshIntervalSeconds,
		showHistory: stored.showHistory ?? DEFAULT_PAGE_SETTINGS.showHistory,
		historyLimit: stored.historyLimit ?? DEFAULT_PAGE_SETTINGS.historyLimit,
		autoIncident: stored.autoIncident ?? DEFAULT_PAGE_SETTINGS.autoIncident,
		autoPublish: stored.autoPublish ?? DEFAULT_PAGE_SETTINGS.autoPublish,
		autoIncidentWindowSeconds:
			stored.autoIncidentWindowSeconds ??
			DEFAULT_PAGE_SETTINGS.autoIncidentWindowSeconds,
		severityToStatus,
	};
};

/** Patch shape accepted by `mergeSettings` (severity mapping stays partial). */
export type PageSettingsPatch = Omit<
	Partial<PageSettings>,
	"severityToStatus"
> & {
	severityToStatus?: Partial<Record<IncidentSeverity, GlobalStatus>>;
};

/** Merge a partial patch over the stored settings (deep for severityToStatus). */
export const mergeSettings = (
	current: PageSettings,
	patch: PageSettingsPatch,
): PageSettings => ({
	...current,
	...patch,
	severityToStatus: {
		...current.severityToStatus,
		...(patch.severityToStatus ?? {}),
	},
});
