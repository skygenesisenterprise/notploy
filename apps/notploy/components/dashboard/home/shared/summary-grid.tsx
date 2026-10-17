import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
	displayMetricValue,
	HOME_TONES,
	metricStateLabel,
} from "../home-state";
import type { HomeMetric, MetricState } from "../types";

const StateCaption = ({ state }: { state: MetricState }) => {
	if (state === "loading") {
		return (
			<span className="inline-flex items-center gap-1.5">
				<Loader2 className="size-3 animate-spin" aria-hidden />
				{metricStateLabel(state)}
			</span>
		);
	}
	if (state === "available") return null;
	return <span>{metricStateLabel(state)}</span>;
};

const MetricCard = ({ metric }: { metric: HomeMetric }) => {
	const tone = HOME_TONES[metric.tone ?? "neutral"];
	const Icon = metric.icon;
	// Only a resolved value is shown as a figure; every other state is labelled
	// so an absent datum can never be read as a zero.
	const isResolved = metric.state === "available";

	const body = (
		<CardContent className="p-4 sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{metric.label}
					</p>
					<p
						className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${
							isResolved ? "" : "text-muted-foreground"
						}`}
					>
						{displayMetricValue(metric)}
					</p>
				</div>
				{Icon && (
					<div className={`rounded-lg bg-muted p-2 ${tone.text}`}>
						<Icon className="size-4" aria-hidden />
					</div>
				)}
			</div>
			<p className="mt-3 flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground">
				{metric.description && <span>{metric.description}</span>}
				{metric.state !== "available" && (
					<span className="font-medium">
						<StateCaption state={metric.state} />
					</span>
				)}
			</p>
		</CardContent>
	);

	return (
		<Card
			className={`min-w-0 overflow-hidden ${
				metric.href ? "transition-colors hover:border-foreground/20" : ""
			}`}
		>
			{metric.href ? (
				<Link href={metric.href} className="block h-full">
					{body}
				</Link>
			) : (
				body
			)}
		</Card>
	);
};

/** A few summary indicators, one card each. */
export const SummaryGrid = ({
	metrics,
	ariaLabel,
}: {
	metrics: HomeMetric[];
	ariaLabel: string;
}) => (
	<section
		aria-label={ariaLabel}
		className="grid grid-cols-2 gap-3 xl:grid-cols-4"
	>
		{metrics.map((metric) => (
			<MetricCard key={metric.id} metric={metric} />
		))}
	</section>
);
