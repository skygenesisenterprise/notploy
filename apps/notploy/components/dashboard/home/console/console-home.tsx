import { formatDistanceToNow } from "date-fns";
import { ArrowRight, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { HomeEmptyState } from "../shared/home-empty";
import { HomeHeader } from "../shared/home-header";
import { HomeShell } from "../shared/home-shell";
import { RecentActivityPanel } from "../shared/recent-activity";
import { StatusGroupPanel } from "../shared/status-overview";
import { buildConsoleHomeModel } from "./console-home-data";
import { ConsoleAttentionPanel } from "./console-attention";
import { ConsoleCapacityPanel } from "./console-capacity";
import { ConsoleDependencyPanel } from "./console-dependencies";
import { ConsoleSummary } from "./console-summary";
import { useConsoleOverview } from "./use-console-overview";

const lastUpdatedLabel = (lastUpdatedAt: number): string => {
	if (!lastUpdatedAt) return "No source has answered yet";
	const updated = new Date(lastUpdatedAt);
	return `Updated ${formatDistanceToNow(updated, { addSuffix: true })} · ${updated.toLocaleTimeString()}`;
};

/**
 * Notploy Console — the internal operator workbench.
 *
 * The page is organised by operational question rather than by product page:
 * what needs attention, what changed, what capacity remains, and which
 * dependencies are actually recorded. Every panel names its source and reports
 * a missing answer as unknown, never as healthy or zero.
 */
export const ConsoleHome = () => {
	const overview = useConsoleOverview();

	const model = buildConsoleHomeModel({
		isOperator: overview.isOperator,
		stats: overview.stats,
		statsState: overview.statsState,
		services: overview.services,
		servicesState: overview.servicesState,
		canReadServices: overview.canReadServices,
		activity: overview.activity,
		activityState: overview.activityState,
		canReadDeployments: overview.canReadDeployments,
		servers: overview.servers,
		serversState: overview.serversState,
		canReadServers: overview.canReadServers,
		events: overview.events,
		eventsState: overview.eventsState,
		status: overview.status,
		statusState: overview.statusState,
		runtime: overview.runtime,
		runtimeState: overview.runtimeState,
		infrastructure: overview.infrastructure,
		infrastructureState: overview.infrastructureState,
		backups: overview.backups,
		backupsState: overview.backupsState,
		canReadBackups: overview.canReadBackups,
		certificates: overview.certificates,
		certificatesState: overview.certificatesState,
		canReadCertificates: overview.canReadCertificates,
		monitoring: overview.monitoring,
		monitoringState: overview.monitoringState,
		canReadMonitoring: overview.canReadMonitoring,
		traffic: overview.traffic,
		trafficState: overview.trafficState,
		canReadTraffic: overview.canReadTraffic,
	});

	return (
		<HomeShell>
			<HomeHeader
				title="Platform overview"
				description="Operator workbench for Notploy Cloud: incidents, operations, measured capacity and the dependencies Notploy records."
				scope="Notploy Console"
				scopeDetail="Status platform · this console host · this organization"
				actions={
					<>
						<span className="text-xs text-muted-foreground" aria-live="polite">
							{lastUpdatedLabel(overview.lastUpdatedAt)}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void overview.refresh()}
							disabled={overview.isRefreshing}
						>
							<RefreshCw
								className={`size-4 ${overview.isRefreshing ? "animate-spin" : ""}`}
								aria-hidden
							/>
							<span className="hidden sm:inline">Refresh</span>
						</Button>
						<Button asChild size="sm">
							<Link href="/dashboard/incidents">
								Incidents
								{model.attention.total > 0 && (
									<span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 tabular-nums">
										{model.attention.total}
									</span>
								)}
							</Link>
						</Button>
					</>
				}
			/>

			{model.hasPartialError && (
				<AlertBlock type="error">
					Some sources could not be read. The panels below only cover the sources
					that answered, and no availability is inferred for the others.
				</AlertBlock>
			)}

			{!model.isOperator && (
				<HomeEmptyState
					icon={ShieldAlert}
					title="Operator access required"
					description="The platform view is limited to the owners and administrators of this console instance. The organization's own workloads, deployments and backups remain available below."
				/>
			)}

			<ConsoleSummary
				metrics={model.metrics}
				lastUpdatedAt={overview.lastUpdatedAt}
			/>

			<section className="grid gap-4 xl:grid-cols-12">
				<div className="space-y-4 xl:col-span-7">
					<ConsoleAttentionPanel attention={model.attention} />
					<RecentActivityPanel
						title="Recent activity"
						description="Deployments, incidents, maintenance, backups and operational events"
						panel={model.activity}
						emptyMessage="No deployment, incident, maintenance, backup or operational event was recorded in the retained windows."
						action={
							<Link
								href="/dashboard/deployments"
								className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								Deployments <ArrowRight className="size-3.5" aria-hidden />
							</Link>
						}
					/>
					<ConsoleDependencyPanel dependencies={model.dependencies} />
				</div>
				<div className="space-y-4 xl:col-span-5">
					{model.statusGroups.map((group) => (
						<StatusGroupPanel key={group.id} group={group} />
					))}
					<ConsoleCapacityPanel capacity={model.capacity} />
				</div>
			</section>

			{model.limitations.length > 0 && (
				<details className="rounded-lg border px-4 py-3 text-xs text-muted-foreground">
					<summary className="cursor-pointer font-medium text-foreground">
						Scope and limitations
					</summary>
					<ul className="mt-2 list-disc space-y-1 pl-4">
						{model.limitations.map((limitation) => (
							<li key={limitation}>{limitation}</li>
						))}
					</ul>
				</details>
			)}
		</HomeShell>
	);
};
