import {
	type MetricStatus,
	type MetricThresholds,
	DEFAULT_THRESHOLDS,
	getMetricStatus,
} from "@notploy/server/monitoring/status";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Presentation mapping for the semantic monitoring status. The monitoring
 * layer only exposes `normal | warning | critical`; the actual colors/tokens
 * are decided here so they can later be swapped for the shared design system.
 */
const STATUS_PRESENTATION: Record<
	MetricStatus,
	{ badgeVariant: "green" | "yellow" | "red"; label: string; indicator: string }
> = {
	normal: {
		badgeVariant: "green",
		label: "Normal",
		indicator: "bg-emerald-500",
	},
	warning: {
		badgeVariant: "yellow",
		label: "Warning",
		indicator: "bg-yellow-500",
	},
	critical: {
		badgeVariant: "red",
		label: "Critical",
		indicator: "bg-destructive",
	},
};

const formatNumber = (value: number, precision: number) =>
	Number.isFinite(value) ? value.toFixed(precision) : "—";

interface Props {
	/** Metric name, e.g. "Memory Usage". */
	label: string;
	/** Current usage value. */
	used: number;
	/** Total capacity. Omit for metrics without a capacity (e.g. CPU). */
	total?: number;
	/** Utilization percentage. Derived from `used`/`total` when omitted. */
	percentage?: number;
	/** Semantic status. Derived from `percentage`/`thresholds` when omitted. */
	status?: MetricStatus;
	/** Thresholds used to derive the status when it is not provided. */
	thresholds?: MetricThresholds;
	/** Unit appended to the used/total values, e.g. "GB" or "GiB". */
	unit?: string;
	/** Decimal precision for the used/total values. */
	precision?: number;
	/** Custom formatter for a single value (overrides `unit`/`precision`). */
	formatValue?: (value: number) => string;
	/** Optional leading icon. */
	icon?: LucideIcon;
	/** Optional trailing chart or extra content. */
	children?: React.ReactNode;
	className?: string;
}

export function MetricUsage({
	label,
	used,
	total,
	percentage,
	status,
	thresholds = DEFAULT_THRESHOLDS,
	unit,
	precision = 1,
	formatValue,
	icon: Icon,
	children,
	className,
}: Props) {
	const resolvedPercentage = Math.min(
		100,
		Math.max(0, percentage ?? (total && total > 0 ? (used / total) * 100 : 0)),
	);
	const resolvedStatus = status ?? getMetricStatus(resolvedPercentage, thresholds);
	const presentation = STATUS_PRESENTATION[resolvedStatus];
	const hasCapacity = typeof total === "number" && total > 0;
	const format = (value: number) =>
		formatValue
			? formatValue(value)
			: `${formatNumber(value, precision)}${unit ? ` ${unit}` : ""}`;

	return (
		<div className={cn("flex w-full flex-col gap-2", className)}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2 text-muted-foreground">
					{Icon && <Icon className="size-4 shrink-0" aria-hidden />}
					<p className="truncate text-sm font-medium">{label}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="text-sm font-semibold tabular-nums">
						{resolvedPercentage.toFixed(2)}%
					</span>
					{resolvedStatus !== "normal" && (
						<Badge variant={presentation.badgeVariant}>
							{presentation.label}
						</Badge>
					)}
				</div>
			</div>

			{hasCapacity && (
				<p className="text-xs text-muted-foreground tabular-nums">
					{format(used)} / {format(total)}
				</p>
			)}

			<Progress
				value={resolvedPercentage}
				className="w-full"
				indicatorClassName={presentation.indicator}
			/>

			{children}
		</div>
	);
}
