import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
	SECTION_STATE_LABELS,
	type TrafficSectionState,
} from "./section-state";

interface TrafficMetricCardProps {
	label: string;
	/** Already formatted, or `—` when the metric is not available. */
	value: string;
	unit?: string;
	detail?: ReactNode;
	/** Previous-period value, used only when the comparison is enabled. */
	comparison?: { current: number; previous: number | null } | null;
	state?: TrafficSectionState;
	stateReasons?: string[];
	/** Set when the number is an estimate and how it is produced. */
	approximation?: string;
}

/** Percentage change, `null` when nothing can be compared honestly. */
const changeOf = (
	comparison: TrafficMetricCardProps["comparison"],
): number | null => {
	if (!comparison || comparison.previous === null || comparison.previous <= 0) {
		return null;
	}
	return (
		((comparison.current - comparison.previous) / comparison.previous) * 100
	);
};

export const TrafficMetricCard = ({
	label,
	value,
	unit,
	detail,
	comparison,
	state = "ok",
	stateReasons = [],
	approximation,
}: TrafficMetricCardProps) => {
	const change = changeOf(comparison);
	const isFlat = change !== null && Math.abs(change) < 0.05;

	return (
		<Card className="flex flex-col justify-between gap-2 p-4">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm text-muted-foreground">{label}</p>
				{state !== "ok" && (
					<Badge variant="outline" className="shrink-0 text-[11px]">
						{SECTION_STATE_LABELS[state] ?? state}
					</Badge>
				)}
			</div>
			<div className="flex items-baseline gap-1">
				<span className="text-2xl font-semibold tabular-nums">{value}</span>
				{unit && <span className="text-sm text-muted-foreground">{unit}</span>}
			</div>
			<div className="flex flex-col gap-1">
				{comparison !== undefined && (
					<p
						className={cn(
							"flex items-center gap-1 text-xs",
							change === null
								? "text-muted-foreground"
								: change > 0
									? "text-emerald-600 dark:text-emerald-500"
									: change < 0
										? "text-red-600 dark:text-red-500"
										: "text-muted-foreground",
						)}
					>
						{change === null ? (
							<>
								<Minus className="size-3" aria-hidden />
								No previous period to compare
							</>
						) : isFlat ? (
							<>
								<Minus className="size-3" aria-hidden />
								Stable vs previous period
							</>
						) : change > 0 ? (
							<>
								<ArrowUpRight className="size-3" aria-hidden />+
								{change.toFixed(1)}% vs previous period
							</>
						) : (
							<>
								<ArrowDownRight className="size-3" aria-hidden />
								{change.toFixed(1)}% vs previous period
							</>
						)}
					</p>
				)}
				{approximation && (
					<p className="text-xs text-muted-foreground">{approximation}</p>
				)}
				{detail && (
					<div className="text-xs text-muted-foreground">{detail}</div>
				)}
				{stateReasons.length > 0 && state !== "ok" && (
					<ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
						{stateReasons.slice(0, 3).map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
				)}
			</div>
		</Card>
	);
};
