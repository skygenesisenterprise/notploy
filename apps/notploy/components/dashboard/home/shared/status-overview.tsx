import { Loader2 } from "lucide-react";
import { HOME_TONES, segmentTotal } from "../home-state";
import type { HomeStatusGroup } from "../types";
import { HomePanel, HomePanelMessage } from "./home-panel";

/** Explains, in the panel body, why no distribution can be shown. */
export const statusStateMessage = (group: HomeStatusGroup): string => {
	if (group.message) return group.message;
	switch (group.state) {
		case "loading":
			return "Loading the current state.";
		case "restricted":
			return "You do not have permission to see this state.";
		case "not_applicable":
			return "Not applicable in this environment.";
		default:
			return "This state is unavailable right now.";
	}
};

/** Proportional bar, keyboard-free and readable through its text legend. */
const SegmentBar = ({
	group,
	total,
}: {
	group: HomeStatusGroup;
	total: number;
}) => (
	<div
		className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
		role="img"
		aria-label={`${group.title}: ${group.segments
			.map((segment) => `${segment.value} ${segment.label}`)
			.join(", ")}`}
	>
		{group.segments
			.filter((segment) => segment.value > 0)
			.map((segment) => (
				<div
					key={segment.id}
					className={HOME_TONES[segment.tone].bar}
					style={{ width: `${(segment.value / total) * 100}%` }}
				/>
			))}
	</div>
);

const Legend = ({ group }: { group: HomeStatusGroup }) => (
	<div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
		{group.segments.map((segment) => (
			<div
				key={segment.id}
				className="flex items-center justify-between gap-2 text-xs"
			>
				<span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
					<span
						className={`size-2 shrink-0 rounded-full ${HOME_TONES[segment.tone].dot}`}
						aria-hidden
					/>
					<span className="truncate">{segment.label}</span>
				</span>
				<span className="font-medium tabular-nums">{segment.value}</span>
			</div>
		))}
	</div>
);

const PanelBody = ({ group }: { group: HomeStatusGroup }) => {
	if (group.state === "loading") {
		return (
			<HomePanelMessage>
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					{statusStateMessage(group)}
				</span>
			</HomePanelMessage>
		);
	}
	if (group.state !== "available") {
		return <HomePanelMessage>{statusStateMessage(group)}</HomePanelMessage>;
	}

	const total = segmentTotal(group.segments);
	return (
		<div className="space-y-4 p-4 pt-5 sm:p-5 sm:pt-5">
			{total > 0 ? (
				<SegmentBar group={group} total={total} />
			) : (
				<p className="text-sm text-muted-foreground">
					Nothing is registered here yet.
				</p>
			)}
			<Legend group={group} />
			{group.note && (
				<p className="border-t pt-3 text-xs text-muted-foreground">
					{group.note}
				</p>
			)}
		</div>
	);
};

/** One status panel: state, distribution and the caveats qualifying it. */
export const StatusGroupPanel = ({ group }: { group: HomeStatusGroup }) => (
	<HomePanel title={group.title} description={group.description}>
		<PanelBody group={group} />
	</HomePanel>
);

/** Convenience wrapper when several groups are stacked in the same column. */
export const StatusOverview = ({ groups }: { groups: HomeStatusGroup[] }) => (
	<div className="space-y-4">
		{groups.map((group) => (
			<StatusGroupPanel key={group.id} group={group} />
		))}
	</div>
);
