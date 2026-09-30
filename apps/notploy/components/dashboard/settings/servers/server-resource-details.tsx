import { formatDistanceToNow } from "date-fns";
import { Boxes, Network, ServerIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { api, type RouterOutputs } from "@/utils/api";

type Server = RouterOutputs["server"]["all"][number];

const workloadLabels: Record<string, string> = {
	application: "Application",
	compose: "Compose",
	libsql: "LibSQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	mysql: "MySQL",
	postgres: "PostgreSQL",
	redis: "Redis",
};

export function ServerResourceDetails({ server }: { server: Server }) {
	const [open, setOpen] = useState(false);
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canReadDeployments = !!permissions?.deployment.read;
	const {
		data: workloads,
		isLoading,
		isError,
		error,
	} = api.server.getServices.useQuery(
		{ serverId: server.serverId },
		{ enabled: open },
	);
	const {
		data: deployments,
		isLoading: deploymentsLoading,
		isError: deploymentsError,
		error: deploymentError,
	} = api.deployment.allByServer.useQuery(
		{ serverId: server.serverId },
		{ enabled: open && canReadDeployments },
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">View server</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<ServerIcon className="size-5 text-muted-foreground" aria-hidden />
						{server.name}
					</DialogTitle>
					<DialogDescription>
						Server resource and workloads assigned to this execution target.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<section aria-label="Server overview" className="space-y-3">
						<div className="flex flex-wrap gap-2">
							<Badge
								variant={
									server.serverStatus === "active" ? "default" : "destructive"
								}
							>
								{server.serverStatus === "active" ? "Active" : "Inactive"}
							</Badge>
							<Badge variant="secondary">
								{server.serverType === "build"
									? "Build server"
									: "Deployment server"}
							</Badge>
						</div>
						{server.description && (
							<p className="text-sm text-muted-foreground">
								{server.description}
							</p>
						)}
						<div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
							<div>
								<p className="text-muted-foreground">Address</p>
								<p className="mt-1 font-medium">
									{server.ipAddress}:{server.port}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">SSH access</p>
								<p className="mt-1 font-medium">
									{server.username} ·{" "}
									{server.sshKeyId ? "Key assigned" : "No key"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Added</p>
								<p className="mt-1 font-medium">
									{formatDistanceToNow(new Date(server.createdAt), {
										addSuffix: true,
									})}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Assigned workloads</p>
								<p className="mt-1 font-medium">
									{isLoading
										? "Loading…"
										: (workloads?.length ?? server.totalSum)}
								</p>
							</div>
						</div>
					</section>

					<section aria-label="Assigned workloads" className="space-y-3">
						<div className="flex items-center gap-2">
							<Boxes className="size-4 text-muted-foreground" aria-hidden />
							<h3 className="font-semibold">Workloads</h3>
						</div>
						{isLoading ? (
							<p className="text-sm text-muted-foreground">
								Loading assigned workloads…
							</p>
						) : isError ? (
							<AlertBlock type="error">{error.message}</AlertBlock>
						) : workloads?.length ? (
							<ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
								{workloads.map((workload) => (
									<li key={`${workload.type}-${workload.id}`}>
										<Link
											href={workload.url}
											onClick={() => setOpen(false)}
											className="flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-muted/40"
										>
											<span className="flex min-w-0 flex-col">
												<span className="truncate text-sm font-medium">
													{workload.name}
												</span>
												<span className="truncate text-xs text-muted-foreground">
													{workload.projectName} · {workload.environmentName}
												</span>
											</span>
											<Badge variant="outline">
												{workloadLabels[workload.type] ?? workload.type}
											</Badge>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
								<Network className="size-4 shrink-0" aria-hidden />
								No workloads are currently assigned to this server.
							</div>
						)}
					</section>

					{canReadDeployments && (
						<section aria-label="Recent deployments" className="space-y-3">
							<h3 className="font-semibold">Recent deployments</h3>
							{deploymentsLoading ? (
								<p className="text-sm text-muted-foreground">
									Loading recent deployments…
								</p>
							) : deploymentsError ? (
								<AlertBlock type="error">{deploymentError.message}</AlertBlock>
							) : deployments?.length ? (
								<ul className="divide-y rounded-lg border">
									{deployments.slice(0, 5).map((deployment) => (
										<li
											key={deployment.deploymentId}
											className="flex items-center justify-between gap-3 px-3 py-3"
										>
											<span className="min-w-0">
												<span className="block truncate text-sm font-medium">
													{deployment.title}
												</span>
												<span className="text-xs text-muted-foreground">
													{formatDistanceToNow(new Date(deployment.createdAt), {
														addSuffix: true,
													})}
												</span>
											</span>
											<Badge
												variant={
													deployment.status === "error"
														? "destructive"
														: "secondary"
												}
											>
												{deployment.status ?? "Unknown"}
											</Badge>
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-muted-foreground">
									No deployment history is available for this server.
								</p>
							)}
						</section>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
