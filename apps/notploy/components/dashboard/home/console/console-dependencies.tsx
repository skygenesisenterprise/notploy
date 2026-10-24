import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { HomePanel, HomePanelMessage } from "../shared/home-panel";
import { HOME_TONES } from "../home-state";
import type { ConsoleDependencyModel } from "./console-home-data";

const statusTone = (status: string) =>
	status === "outage" ? "critical" : status === "degraded" ? "warning" : "neutral";

export const ConsoleDependencyPanel = ({
	dependencies,
}: {
	dependencies: ConsoleDependencyModel;
}) => {
	let body: React.ReactNode;

	if (dependencies.state !== "available") {
		body =
			dependencies.state === "loading" ? (
				<HomePanelMessage>
					<span className="inline-flex items-center gap-2">
						<Loader2 className="size-4 animate-spin" aria-hidden />
						Loading workload placement.
					</span>
				</HomePanelMessage>
			) : (
				<HomePanelMessage>
					{dependencies.message ??
						"The service read permission is required to see workload placement."}
				</HomePanelMessage>
			);
	} else {
		body = (
			<div className="divide-y">
				<div className="space-y-2 p-4 sm:p-5">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Workload placement
						</h3>
						<span className="text-[11px] text-muted-foreground">
							workload → server
						</span>
					</div>
					{dependencies.servers.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No server runs a workload this account can read.
						</p>
					) : (
						<ul className="divide-y rounded-md border">
							{dependencies.servers.map((server) => (
								<li key={server.serverId}>
									<Link
										href="/dashboard/settings/servers"
										className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
									>
										<span className="min-w-0 truncate text-sm">{server.name}</span>
										<span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
											<span className="tabular-nums">
												{server.total} workload(s)
											</span>
											{server.failed > 0 && (
												<Badge variant="red">{server.failed} failed</Badge>
											)}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
					{dependencies.unassigned > 0 && (
						<p className="text-xs text-muted-foreground">
							{dependencies.unassigned} workload(s) have no server recorded. Their
							runtime location is unknown.
						</p>
					)}
					<Link
						href="/dashboard/overview"
						className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						All workloads <ArrowRight className="size-3.5" aria-hidden />
					</Link>
				</div>

				<div className="space-y-2 p-4 sm:p-5">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Status impact
						</h3>
						<span className="text-[11px] text-muted-foreground">
							incident → component
						</span>
					</div>
					{dependencies.impactedComponents.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No observed status component is degraded or in outage in the status
							platform.
						</p>
					) : (
						<ul className="space-y-2">
							{dependencies.impactedComponents.map((component) => {
								const tone = HOME_TONES[statusTone(component.status)];
								return (
									<li
										key={component.id}
										className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{component.name}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{component.incidents.length > 0
													? component.incidents.join(", ")
													: "No open incident references this component"}
											</p>
										</div>
										<Badge variant={tone.badge}>{component.status}</Badge>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<p className="px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
					{dependencies.note}
				</p>
			</div>
		);
	}

	return (
		<HomePanel
			title="Platform dependencies"
			description="Relations Notploy actually records, from workload to host and from incident to component"
		>
			{body}
		</HomePanel>
	);
};
