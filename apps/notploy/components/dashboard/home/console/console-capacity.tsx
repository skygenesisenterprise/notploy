import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { HomePanel, HomePanelMessage } from "../shared/home-panel";
import { HOME_TONES } from "../home-state";
import type { HomeTone } from "../types";
import type { ConsoleCapacityModel } from "./console-home-data";

const capacityTone = (percentage: number | null): HomeTone => {
	if (percentage === null) return "neutral";
	if (percentage >= 90) return "critical";
	if (percentage >= 85) return "warning";
	return "healthy";
};

const resourceHref = (serverId: string): string =>
	`/dashboard/monitoring?workspace=server:${encodeURIComponent(serverId)}`;

export const ConsoleCapacityPanel = ({
	capacity,
}: {
	capacity: ConsoleCapacityModel;
}) => {
	let body: React.ReactNode;

	if (capacity.state !== "available") {
		body =
			capacity.state === "loading" ? (
				<HomePanelMessage>
					<span className="inline-flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" aria-hidden />
						Reading the latest monitoring samples.
					</span>
				</HomePanelMessage>
			) : (
				<HomePanelMessage>
					{capacity.message ??
						"The monitoring read permission is required to measure compute capacity."}
				</HomePanelMessage>
			);
	} else if (capacity.resources.length === 0) {
		body = (
			<HomePanelMessage>
				{capacity.message ??
					"No monitored server reported a metrics sample, so CPU, memory and storage are unknown."}
			</HomePanelMessage>
		);
	} else {
		body = (
			<div className="space-y-4 p-4 pt-5 sm:p-5 sm:pt-5">
				<div className="space-y-3">
					{capacity.resources.map((resource) => {
						const tone = HOME_TONES[capacityTone(resource.percentage)];
						return (
							<div key={resource.id} className="space-y-1.5">
								<div className="flex items-baseline justify-between gap-3 text-xs">
									<span className="font-medium">{resource.label}</span>
									<span className="tabular-nums text-muted-foreground">
										{resource.percentage === null
											? "No sample"
											: `${resource.percentage}%`}
									</span>
								</div>
								<div
									className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
									role="img"
									aria-label={
										resource.percentage === null
											? `${resource.label}: no sample`
											: `${resource.label}: ${resource.percentage}% used`
									}
								>
									{resource.percentage !== null && (
										<div
											className={`h-full rounded-full ${tone.bar}`}
											style={{ width: `${Math.min(resource.percentage, 100)}%` }}
										/>
									)}
								</div>
								<p className="text-[11px] text-muted-foreground">
									{resource.detail}
								</p>
							</div>
						);
					})}
				</div>

				{capacity.saturated.length > 0 && (
					<div className="space-y-1.5 border-t pt-3">
						<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							At or above 85% in the latest sample
						</p>
						<ul className="space-y-1">
							{capacity.saturated.slice(0, 4).map((entry) => (
								<li key={`${entry.serverId}-${entry.resource}`}>
									<Link
										href={resourceHref(entry.serverId)}
										className="flex items-center justify-between gap-3 rounded px-1 py-0.5 text-xs transition-colors hover:bg-muted/50"
									>
										<span className="truncate">
											{entry.name}{" "}
											<span className="text-muted-foreground">
												· {entry.resource}
											</span>
										</span>
										<span className="tabular-nums text-amber-600 dark:text-amber-400">
											{entry.percentage}%
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				)}

				<p className="border-t pt-3 text-[11px] text-muted-foreground">
					{capacity.note}
					{capacity.sampledAt && (
						<>
							{" "}
							Latest sample recorded{" "}
							<time dateTime={capacity.sampledAt}>
								{new Date(capacity.sampledAt).toLocaleString()}
							</time>
							{capacity.oldestSampleAt &&
								capacity.oldestSampleAt !== capacity.sampledAt &&
								`; oldest among the aggregated servers ${new Date(
									capacity.oldestSampleAt,
								).toLocaleTimeString()}`}
							.
						</>
					)}
				</p>
				{capacity.message && (
					<p className="text-[11px] text-amber-600 dark:text-amber-400">
						{capacity.message}
					</p>
				)}
			</div>
		);
	}

	return (
		<HomePanel
			title="Capacity"
			description={`${capacity.reportingServers}/${capacity.totalServers} monitored server(s) reporting`}
			action={
				<Link
					href="/dashboard/monitoring"
					className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Monitoring <ArrowRight className="size-3.5" aria-hidden />
				</Link>
			}
		>
			{body}
		</HomePanel>
	);
};
