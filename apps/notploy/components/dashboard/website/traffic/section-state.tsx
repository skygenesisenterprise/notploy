import type { LucideIcon } from "lucide-react";
import {
	CircleDashed,
	CircleSlash,
	Info,
	TriangleAlert,
	WifiOff,
} from "lucide-react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
} from "@/components/shared/console-shell";

/**
 * The states every Traffic Manager panel can be in.
 *
 * They mirror the server's availability vocabulary so the page never has to
 * guess: "no data on this period" and "the collector is down" are different
 * situations and must not be rendered as the same empty chart.
 */
export type TrafficSectionState =
	| "ok"
	| "partial"
	| "no-data"
	| "not-configured"
	| "unavailable";

export const SECTION_STATE_LABELS: Record<TrafficSectionState, string> = {
	ok: "Live",
	partial: "Partial data",
	"no-data": "No data on this period",
	"not-configured": "Source not configured",
	unavailable: "Collector unavailable",
};

const STATE_ICONS: Record<TrafficSectionState, LucideIcon> = {
	ok: Info,
	partial: TriangleAlert,
	"no-data": CircleDashed,
	"not-configured": CircleSlash,
	unavailable: WifiOff,
};

const STATE_ALERT_TYPES: Record<
	TrafficSectionState,
	"info" | "warning" | "error"
> = {
	ok: "info",
	partial: "warning",
	"no-data": "info",
	"not-configured": "info",
	unavailable: "error",
};

interface TrafficSectionNoticeProps {
	state: TrafficSectionState;
	reasons: string[];
	/** Optional action the operator can take right away. */
	actions?: React.ReactNode;
}

/** One-line explanation of a non-`ok` section state. */
export const TrafficSectionNotice = ({
	state,
	reasons,
	actions,
}: TrafficSectionNoticeProps) => {
	if (state === "ok") {
		return null;
	}
	return (
		<div className="space-y-2">
			<AlertBlock type={STATE_ALERT_TYPES[state]}>
				<span className="font-medium">{SECTION_STATE_LABELS[state]}</span>
				{reasons.length > 0 ? ` — ${reasons.join(" ")}` : null}
			</AlertBlock>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
};

/**
 * Empty rendering of a panel.
 *
 * A section with no declared collector is *not configured* (the operator has
 * something to do), while a section with a healthy collector and no rows on the
 * period is simply empty — the wording differs on purpose.
 */
export const TrafficSectionEmpty = ({
	title,
	state,
	reasons,
	actions,
}: {
	title: string;
	state: TrafficSectionState;
	reasons: string[];
	actions?: React.ReactNode;
}) => {
	const Icon = STATE_ICONS[state];
	return (
		<ConsoleEmpty
			icon={Icon}
			title={title}
			description={
				reasons.length > 0
					? reasons.join(" ")
					: "No data was recorded for the selected filters."
			}
		>
			{actions}
		</ConsoleEmpty>
	);
};

/** Shared loading placeholder, so every panel loads the same way. */
export const TrafficSectionLoading = ({ label }: { label: string }) => (
	<ConsoleLoading label={label} />
);
