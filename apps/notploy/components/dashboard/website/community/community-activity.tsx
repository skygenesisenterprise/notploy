import { Activity, ExternalLink } from "lucide-react";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";
import {
	COMMUNITY_EVENT_TYPE_LABELS,
	formatRelative,
	toCommunityRangeInput,
	toRepositoryScope,
	type CommunityFilterState,
} from "./community-types";

const PAGE_SIZE = 30;

/**
 * Community feed.
 *
 * Every row is a tracked repository event with its date, repository, type and a
 * link to the GitHub source. Filtering and pagination are server-side: the query
 * carries the period, the repository scope, the event types and the offset, so
 * the browser never receives more rows than it displays.
 */
export const CommunityActivityPanel = ({
	filters,
}: {
	filters: CommunityFilterState;
}) => {
	const [offset, setOffset] = useState(0);
	const rangeReady =
		filters.preset !== "custom" || (!!filters.from && !!filters.to);

	const activity = api.community.activity.useQuery(
		{
			...toCommunityRangeInput(filters),
			repositoryIds: toRepositoryScope(filters),
			types:
				filters.eventTypes.length > 0
					? (filters.eventTypes as ("issue-opened")[])
					: undefined,
			limit: PAGE_SIZE,
			offset,
		},
		{ enabled: rangeReady },
	);

	if (activity.isLoading) {
		return <ConsoleLoading label="Loading activity" />;
	}
	if (activity.error) {
		return (
			<AlertBlock type="error">
				{activity.error.message || "Could not load the activity feed."}
			</AlertBlock>
		);
	}

	const items = activity.data?.items ?? [];
	const total = activity.data?.total ?? 0;

	if (items.length === 0) {
		return (
			<ConsoleEmpty
				icon={Activity}
				title="No activity on this period"
				description="No repository event was recorded for the selected filters. Try a wider period or a different repository."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<ul className="space-y-2">
				{items.map((event) => (
					<li
						key={event.id}
						className="flex flex-col gap-1 rounded-md border p-3"
					>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" className="text-[11px]">
								{COMMUNITY_EVENT_TYPE_LABELS[event.type] ?? event.type}
							</Badge>
							<span className="text-xs text-muted-foreground">
								{event.repositoryFullName}
							</span>
							<span className="text-xs text-muted-foreground">
								· {formatRelative(event.occurredAt)}
							</span>
						</div>
						<p className="font-medium">{event.title}</p>
						<div className="flex flex-wrap items-center gap-3">
							{event.actor && (
								<span className="text-xs text-muted-foreground">
									by {event.actor}
								</span>
							)}
							{event.url && (
								<a
									href={event.url}
									target="_blank"
									rel="noreferrer noopener"
									className="inline-flex items-center gap-1 text-xs underline"
								>
									<ExternalLink className="size-3" aria-hidden />
									View on GitHub
								</a>
							)}
						</div>
					</li>
				))}
			</ul>

			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted-foreground">
					Showing {offset + 1}–{offset + items.length} of {total}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
						disabled={offset === 0 || activity.isFetching}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setOffset(offset + PAGE_SIZE)}
						disabled={
							offset + PAGE_SIZE >= total || activity.isFetching
						}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
};

/** Event-type filter chips shared by the activity tab header. */
export const CommunityEventTypeFilter = ({
	filters,
	onChange,
}: {
	filters: CommunityFilterState;
	onChange: (filters: CommunityFilterState) => void;
}) => {
	const toggle = (type: string) => {
		const next = filters.eventTypes.includes(type)
			? filters.eventTypes.filter((value) => value !== type)
			: [...filters.eventTypes, type];
		onChange({ ...filters, eventTypes: next });
	};

	return (
		<div className="flex flex-wrap items-center gap-3">
			{Object.entries(COMMUNITY_EVENT_TYPE_LABELS).map(([type, label]) => (
				<div key={type} className="flex items-center gap-1.5">
					<Checkbox
						id={`community-event-${type}`}
						checked={filters.eventTypes.includes(type)}
						onCheckedChange={() => toggle(type)}
					/>
					<Label
						htmlFor={`community-event-${type}`}
						className="cursor-pointer text-xs font-normal"
					>
						{label}
					</Label>
				</div>
			))}
		</div>
	);
};
