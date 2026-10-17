import { ArrowRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { AlertBlock } from "@/components/shared/alert-block";
import { api } from "@/utils/api";
import { HomeEmptyState } from "../shared/home-empty";
import { HomeHeader } from "../shared/home-header";
import { HomeShell } from "../shared/home-shell";
import { RecentActivityPanel } from "../shared/recent-activity";
import { StatusGroupPanel } from "../shared/status-overview";
import { SummaryGrid } from "../shared/summary-grid";
import { useWorkspaceOverview } from "../use-workspace-overview";
import { buildConsoleHomeModel } from "./console-home-data";

/**
 * Notploy Console — the internal operator surface.
 *
 * The page separates what is actually measured from what is not: the status
 * platform aggregate, the control plane probes on this host, and this
 * instance's own fleet. It never presents a single instance's numbers as the
 * whole platform, and it states its missing sources instead of filling them in.
 */
export const ConsoleHome = () => {
	const overview = useWorkspaceOverview({ includeServers: true });
	const { data: auth } = api.user.get.useQuery();
	const isOperator = auth?.role === "owner" || auth?.role === "admin";

	// Operator-only procedures: the client does not even call them without the
	// role, and each one re-checks it server-side.
	const statusQuery = api.status.overview.useQuery(undefined, {
		enabled: isOperator,
		refetchInterval: 120_000,
	});
	const runtimeQuery = api.settings.getControlPlaneRuntime.useQuery(undefined, {
		enabled: isOperator,
	});
	const infrastructureQuery =
		api.settings.checkInfrastructureHealth.useQuery(undefined, {
			enabled: isOperator,
			refetchInterval: 120_000,
		});

	const model = buildConsoleHomeModel({
		...overview,
		isOperator,
		status: statusQuery.data,
		statusState: {
			isLoading: isOperator && statusQuery.isLoading,
			isError: statusQuery.isError,
		},
		runtime: runtimeQuery.data,
		runtimeState: {
			isLoading: isOperator && runtimeQuery.isLoading,
			isError: runtimeQuery.isError,
		},
		infrastructure: infrastructureQuery.data,
		infrastructureState: {
			isLoading: isOperator && infrastructureQuery.isLoading,
			isError: infrastructureQuery.isError,
		},
	});

	return (
		<HomeShell>
			<HomeHeader
				title="Platform overview"
				description="Operator view of the Notploy platform: the status platform record, the control plane on this host, and this instance's own fleet and workloads."
				scope="Notploy Console"
				scopeDetail="Sky Genesis Enterprise operators"
			/>
			{model.hasPartialError && (
				<AlertBlock type="error">
					Some platform sources could not be loaded. The panels below only cover
					the sources that answered, and no availability is inferred for the
					others.
				</AlertBlock>
			)}
			{!model.isOperator && (
				<HomeEmptyState
					icon={ShieldAlert}
					title="Operator access required"
					description="The platform view is limited to the owners and administrators of this console instance. Your workspace data stays available below."
				/>
			)}
			<SummaryGrid metrics={model.metrics} ariaLabel="Platform summary" />
			{model.limitations.length > 0 && (
				<AlertBlock type="info">
					<span className="block">
						Scope and limitations of this page:
					</span>
					<ul className="mt-1 list-disc space-y-0.5 pl-4">
						{model.limitations.map((limitation) => (
							<li key={limitation}>{limitation}</li>
						))}
					</ul>
				</AlertBlock>
			)}
			<section className="grid gap-4 xl:grid-cols-12">
				<div className="space-y-4 xl:col-span-7">
					{model.statusGroups.map((group) => (
						<StatusGroupPanel key={group.id} group={group} />
					))}
				</div>
				<div className="space-y-4 xl:col-span-5">
					<RecentActivityPanel
						title="Operational activity"
						description="Incidents and operational events"
						panel={model.activity}
						emptyMessage="No incident or operational event has been recorded yet."
						action={
							<Link
								href="/dashboard/incidents"
								className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								All incidents <ArrowRight className="size-3.5" aria-hidden />
							</Link>
						}
					/>
				</div>
			</section>
		</HomeShell>
	);
};
