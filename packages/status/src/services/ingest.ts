/**
 * Monitoring event ingestion (machine-to-machine).
 *
 * Alerts and incidents are different things: an alert is a signal, an
 * incident is an operational problem that may group many alerts. This module
 * turns incoming alerts into the right outcome without ever spamming the
 * public page:
 *
 * - deduplication: an `eventId` already processed returns its original
 *   result instead of acting twice;
 * - correlation: an alert whose `correlationKey` matches an open incident
 *   attaches to it (and never creates a duplicate);
 * - debounce: repeated auto-creation inside `autoIncidentWindowSeconds` is
 *   swallowed;
 * - automatic incidents stay *private* unless the page explicitly enables
 *   `autoIncident` **and** `autoPublish`.
 */
import { createHash } from "node:crypto";
import { newId } from "../core/ids";
import type { IngestEventInput } from "../core/schemas";
import { minuteBucket } from "../core/time";
import { notFound } from "../errors";
import type { IncidentRow } from "../store/repositories";
import { setComponentObservedState } from "./components";
import type { Actor, StatusContext } from "./context";
import { requirePage } from "./pages";
import { resolveSettings } from "./settings";

export interface IngestOutcome {
	/** `duplicate`: eventId already processed. */
	outcome: "attached" | "created" | "debounced" | "alert_only" | "duplicate";
	incidentId: string | null;
	published: boolean;
	ingestId: string;
}

const hash = (value: string): string =>
	createHash("sha256").update(value, "utf8").digest("hex");

export const ingestMonitoringEvent = (
	ctx: StatusContext,
	input: IngestEventInput,
	actor: Actor,
): IngestOutcome => {
	const page = requirePage(ctx, input.pageSlug);
	const timestamp = ctx.now();
	const dedupHash = hash(
		input.eventId
			? `${page.id}|${input.eventId}`
			: `${page.id}|${input.correlationKey}|${input.source}|${minuteBucket(timestamp)}`,
	);
	const existing = ctx.repos.ingestLog.findByDedupHash(dedupHash);
	if (existing) {
		const parsed = JSON.parse(existing.payload_json) as {
			outcome?: IngestOutcome["outcome"];
			published?: boolean;
		};
		return {
			outcome: "duplicate",
			incidentId: existing.incident_id,
			published: parsed.published ?? false,
			ingestId: existing.id,
		};
	}

	const settings = resolveSettings(page);
	if (input.componentId && input.updateComponentState) {
		setComponentObservedState(
			ctx,
			page.id,
			input.componentId,
			{
				observedStatus: input.observedStatus ?? "outage",
				note: `${input.source}: ${input.title}`,
			},
			actor,
		);
	}

	const record = (
		outcome: IngestOutcome["outcome"],
		incidentId: string | null,
		published: boolean,
	): IngestOutcome => {
		const ingestId = newId("ing");
		ctx.repos.ingestLog.insert({
			id: ingestId,
			event_id: input.eventId ?? null,
			dedup_hash: dedupHash,
			source: input.source,
			received_at: timestamp,
			result: outcome,
			incident_id: incidentId,
			payload_json: JSON.stringify({
				outcome,
				published,
				correlationKey: input.correlationKey,
				title: input.title,
			}),
		});
		ctx.audit(actor, {
			action: "ingest.event",
			subjectType: "ingest",
			subjectId: ingestId,
			detail: { outcome, incidentId, correlationKey: input.correlationKey },
		});
		return { outcome, incidentId, published, ingestId };
	};

	const openIncident: IncidentRow | null =
		ctx.repos.incidents.findOpenByCorrelation(page.id, input.correlationKey);
	if (openIncident) {
		ctx.repos.events.insert({
			id: newId("evt"),
			page_id: page.id,
			subject_type: "incident",
			subject_id: openIncident.id,
			type: "alert_attached",
			// Alerts are diagnostics: they stay internal even on public incidents.
			visibility: "internal",
			message: `${input.source}: ${input.title}${input.message ? ` — ${input.message}` : ""}`,
			state: null,
			severity: input.severity,
			actor_type: actor.type,
			actor_id: actor.id,
			actor_label: actor.label,
			metadata_json: JSON.stringify({ correlationKey: input.correlationKey }),
			created_at: timestamp,
		});
		return record("attached", openIncident.id, openIncident.published === 1);
	}

	if (!settings.autoIncident) {
		return record("alert_only", null, false);
	}

	const since = new Date(
		Date.parse(timestamp) - settings.autoIncidentWindowSeconds * 1000,
	).toISOString();
	const recent = ctx.repos.incidents.findRecentByCorrelation(
		page.id,
		input.correlationKey,
		since,
	);
	if (recent) {
		return record("debounced", recent.id, recent.published === 1);
	}

	const autoPublic = settings.autoPublish;
	const incidentId = newId("inc");
	ctx.repos.incidents.insert({
		id: incidentId,
		page_id: page.id,
		title: input.title,
		description: input.message,
		severity: input.severity,
		state: "investigating",
		visibility: autoPublic ? "public" : "private",
		published: autoPublic ? 1 : 0,
		published_at: autoPublic ? timestamp : null,
		correlation_key: input.correlationKey,
		started_at: timestamp,
		resolved_at: null,
		created_by: actor.id,
		created_at: timestamp,
		updated_at: timestamp,
	});
	if (input.componentId) {
		ctx.repos.incidents.replaceComponents(incidentId, [input.componentId]);
	}
	ctx.repos.events.insert({
		id: newId("evt"),
		page_id: page.id,
		subject_type: "incident",
		subject_id: incidentId,
		type: "incident_created",
		visibility: autoPublic ? "public" : "internal",
		message: input.message || input.title,
		state: "investigating",
		severity: input.severity,
		actor_type: actor.type,
		actor_id: actor.id,
		actor_label: actor.label,
		metadata_json: JSON.stringify({ automated: true, source: input.source }),
		created_at: timestamp,
	});
	ctx.publishState(page.id);
	const outcome = record("created", incidentId, autoPublic);
	if (autoPublic) {
		const stored = ctx.repos.incidents.findById(incidentId);
		if (stored) {
			ctx.enqueue({
				event: "incident.published",
				dedupKey: `${incidentId}:${outcome.ingestId}`,
				payload: {
					pageId: page.id,
					incidentId,
					title: stored.title,
					severity: stored.severity,
					state: stored.state,
					automated: true,
				},
			});
		}
	}
	return outcome;
};

/** Current observed state of a component, for integration consumers. */
export const getComponentObservedState = (
	ctx: StatusContext,
	ref: string,
	componentId: string,
) => {
	const page = requirePage(ctx, ref);
	const row = ctx.repos.components.findById(componentId);
	if (!row || row.page_id !== page.id) {
		throw notFound(`Component "${componentId}" does not exist`);
	}
	return {
		componentId: row.id,
		name: row.name,
		observedStatus: row.observed_status,
		observedAt: row.observed_at,
		lastPublishedStatus: row.last_published_status,
		updatedAt: row.updated_at,
	};
};
