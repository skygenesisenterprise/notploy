import { Loader2 } from "lucide-react";
import Link from "next/link";
import { HOME_TONES } from "../home-state";
import type { HomeMetric } from "../types";

/**
 * Dense operational strip. It replaces the generic "one big card per figure"
 * treatment: each entry states what it counts, how it is measured and where to
 * act, and a source that did not answer is labelled instead of rendered as 0.
 */
const MetricStripItem = ({ metric }: { metric: HomeMetric }) => {
	const tone = HOME_TONES[metric.tone ?? "neutral"];
	const Icon = metric.icon;
	const isResolved = metric.state === "available";

	const body = (
		<div className="flex h-full min-w-0 flex-col justify-between gap-2 px-3 py-2.5">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
					{metric.label}
				</span>
				{Icon ? (
					<Icon className={`size-3.5 shrink-0 ${tone.text}`} aria-hidden />
				) : (
					<span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
				)}
			</div>
			<div className="flex min-w-0 items-baseline gap-2">
				{metric.state === "loading" ? (
					<Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
				) : (
					<span
						className={`text-2xl font-semibold tracking-tight tabular-nums ${
							isResolved ? "" : "text-sm font-medium text-muted-foreground"
						}`}
					>
						{metric.state === "restricted"
							? "Restricted"
							: metric.state === "unavailable"
								? "Unavailable"
								: metric.value === null
									? "—"
									: metric.value}
					</span>
				)}
			</div>
			<p className="truncate text-[11px] text-muted-foreground" title={metric.description}>
				{metric.description ?? "\u00a0"}
			</p>
		</div>
	);

	return (
		<div className="min-w-0 rounded-lg border bg-card">
			{metric.href ? (
				<Link href={metric.href} className="block h-full transition-colors hover:bg-muted/40">
					{body}
				</Link>
			) : (
				body
			)}
		</div>
	);
};

export const ConsoleSummary = ({
	metrics,
	lastUpdatedAt,
}: {
	metrics: HomeMetric[];
	lastUpdatedAt: number;
}) => (
	<section aria-label="Platform indicators" className="space-y-2">
		<div className="flex flex-wrap items-center justify-between gap-2">
			<h2 className="text-sm font-medium">Platform indicators</h2>
			<p className="text-xs text-muted-foreground">
				{lastUpdatedAt > 0
					? `Data read ${new Date(lastUpdatedAt).toLocaleTimeString()}`
					: "No source has answered yet"}
			</p>
		</div>
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
			{metrics.map((metric) => (
				<MetricStripItem key={metric.id} metric={metric} />
			))}
		</div>
	</section>
);
