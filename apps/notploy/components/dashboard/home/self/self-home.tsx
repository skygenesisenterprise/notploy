import { ArrowRight, BookOpen, FolderInput } from "lucide-react";
import Link from "next/link";
import { HandleProject } from "@/components/dashboard/projects/handle-project";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { useWorkspaceOverview } from "../use-workspace-overview";
import { HomeEmptyState } from "../shared/home-empty";
import { HomeHeader } from "../shared/home-header";
import { HomeShell } from "../shared/home-shell";
import { RecentActivityPanel } from "../shared/recent-activity";
import { StatusGroupPanel } from "../shared/status-overview";
import { SummaryGrid } from "../shared/summary-grid";
import { buildSelfHomeModel } from "./self-home-data";

/**
 * Notploy Self — overview of the instance the user administers.
 *
 * Sources are all local to the instance: project counts, service state,
 * deployments, servers and operational events. Nothing here depends on a
 * third-party API, and the compositions stay readable on a small screen.
 */
export const SelfHome = () => {
	const overview = useWorkspaceOverview({ includeServers: true });
	const model = buildSelfHomeModel(overview);

	return (
		<HomeShell>
			<HomeHeader
				title="Instance overview"
				description="The state of this self-hosted Notploy instance: what it operates and what needs attention."
				scope="Self-hosted"
				scopeDetail="This instance and its own organisation"
				actions={
					<>
						<Button asChild variant="outline" size="sm">
							<a
								href="https://docs.notploy.com/docs/core"
								target="_blank"
								rel="noreferrer"
							>
								<BookOpen className="size-4" aria-hidden />
								<span className="hidden sm:inline">Documentation</span>
							</a>
						</Button>
						{overview.permissions?.project.create && <HandleProject />}
					</>
				}
			/>
			{model.hasPartialError && (
				<AlertBlock type="error">
					Some instance data could not be loaded. The figures below only cover
					the sources that answered.
				</AlertBlock>
			)}
			<SummaryGrid metrics={model.metrics} ariaLabel="Instance summary" />
			{model.isEmpty ? (
				<HomeEmptyState
					icon={FolderInput}
					title="This instance has no project yet"
					description="Create a project to group your environments, applications and databases. Deployments, service state and server counts then appear on this page."
				>
					{overview.permissions?.project.create && <HandleProject />}
					<Button asChild variant="outline">
						<Link href="/dashboard/settings/git-providers">
							Connect a Git provider
						</Link>
					</Button>
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
							emptyMessage="No deployment or operational event has been recorded yet."
							action={
								<Link
									href="/dashboard/deployments"
									className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									All deployments <ArrowRight className="size-3.5" aria-hidden />
								</Link>
							}
						/>
					</div>
				</section>
			)}
		</HomeShell>
	);
};
