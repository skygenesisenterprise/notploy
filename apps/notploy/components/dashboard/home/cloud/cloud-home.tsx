import { ArrowRight, CreditCard, FolderInput } from "lucide-react";
import Link from "next/link";
import { HandleProject } from "@/components/dashboard/projects/handle-project";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";
import { formatLimit } from "../home-state";
import type { HomeUsageRow, MetricState } from "../types";
import { useWorkspaceOverview } from "../use-workspace-overview";
import { HomeEmptyState } from "../shared/home-empty";
import { HomeHeader } from "../shared/home-header";
import { HomePanel, HomePanelMessage } from "../shared/home-panel";
import { HomeShell } from "../shared/home-shell";
import { RecentActivityPanel } from "../shared/recent-activity";
import { StatusGroupPanel } from "../shared/status-overview";
import { SummaryGrid } from "../shared/summary-grid";
import { buildCloudHomeModel } from "./cloud-home-data";

/**
 * Plan usage, kept in a secondary panel: observed consumption against the
 * plan's theoretical limits. It is only shown when the numbers are readable,
 * and it never mixes measured usage with a projection.
 */
const PlanUsagePanel = ({
	rows,
	usageState,
	onBillingHref,
}: {
	rows: HomeUsageRow[] | null;
	usageState: MetricState;
	onBillingHref: string;
}) => (
	<HomePanel
		title="Plan usage"
		description="Observed consumption against your plan limits"
		action={
			<Link
				href={onBillingHref}
				className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				Billing <ArrowRight className="size-3.5" aria-hidden />
			</Link>
		}
	>
		{!rows ? (
			<HomePanelMessage>
				{usageState === "restricted"
					? "The billing read permission is required to see plan usage."
					: usageState === "loading"
						? "Loading plan usage."
						: "Plan usage is unavailable right now."}
			</HomePanelMessage>
		) : (
			<ul className="mt-3 divide-y border-t">
				{rows.map((row) => (
					<li
						key={row.resource}
						className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
					>
						<span className="text-sm">{row.label}</span>
						<span className="text-xs text-muted-foreground">
							<span className="font-medium tabular-nums text-foreground">
								{row.used}
							</span>{" "}
							used · limit {formatLimit(row.limit)}
						</span>
					</li>
				))}
			</ul>
		)}
	</HomePanel>
);

/**
 * Notploy Cloud — overview of a customer workspace.
 *
 * Shows the applications the user is responsible for: their state, their
 * recent activity and the resources they consume. Infrastructure operated by
 * Sky Genesis Enterprise is deliberately out of scope here, and no
 * availability is asserted from anything other than a recorded measurement.
 */
export const CloudHome = () => {
	const overview = useWorkspaceOverview();
	const permissions = overview.permissions;
	const usageQuery = api.stripe.getUsage.useQuery(undefined, {
		enabled: !!permissions?.billing?.read,
	});
	const model = buildCloudHomeModel({
		...overview,
		usage: usageQuery.data,
		usageState: {
			isLoading: usageQuery.isLoading,
			isError: usageQuery.isError,
		},
		canReadUsage: !!permissions?.billing?.read,
	});

	return (
		<HomeShell>
			<HomeHeader
				title="Workspace overview"
				description="Your Cloud applications, what they last reported and what is waiting on you."
				scope="Notploy Cloud"
				scopeDetail="Your workspace only"
				actions={
					<>
						<Button asChild variant="outline" size="sm">
							<Link href="/dashboard/settings/billing">
								<CreditCard className="size-4" aria-hidden />
								<span className="hidden sm:inline">Billing</span>
							</Link>
						</Button>
						{permissions?.project.create && <HandleProject />}
					</>
				}
			/>
			{model.hasPartialError && (
				<AlertBlock type="error">
					Some workspace data could not be loaded. The figures below only cover
					the sources that answered.
				</AlertBlock>
			)}
			<SummaryGrid metrics={model.metrics} ariaLabel="Workspace summary" />
			{model.isEmpty ? (
				<HomeEmptyState
					icon={FolderInput}
					title="Your workspace is empty"
					description="Create a project to organise your environments, then add the applications and databases you want Notploy Cloud to run for you. Deployments and workload state appear here once a project exists."
				>
					{permissions?.project.create && <HandleProject />}
					<Button asChild variant="outline">
						<a
							href="https://docs.notploy.com/docs/core"
							target="_blank"
							rel="noreferrer"
						>
							Read the documentation
						</a>
					</Button>
				</HomeEmptyState>
			) : (
				<section className="grid gap-4 xl:grid-cols-12">
					<div className="space-y-4 xl:col-span-7">
						{model.statusGroups.map((group) => (
							<StatusGroupPanel key={group.id} group={group} />
						))}
					</div>
					<div className="space-y-4 xl:col-span-5">
						<RecentActivityPanel
							panel={model.activity}
							emptyMessage="No deployment or operational event has been recorded for this workspace yet."
							action={
								<Link
									href="/dashboard/deployments"
									className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									All deployments <ArrowRight className="size-3.5" aria-hidden />
								</Link>
							}
						/>
						<PlanUsagePanel
							rows={model.usage}
							usageState={model.usageState}
							onBillingHref="/dashboard/settings/billing"
						/>
					</div>
				</section>
			)}
		</HomeShell>
	);
};
