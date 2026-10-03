"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/utils/api";
import type { AppRouter } from "@/server/api/root";

type DeploymentRow =
	inferRouterOutputs<AppRouter>["deployment"]["allCentralized"][number];

function formatDate(value: string | null | undefined) {
	if (!value) return "Not available";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function redactSensitiveLogValues(value: string) {
	return value
		.replace(
			/\b((?:access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|password|passwd|secret|authorization|credential)s?)\s*([=:])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
			"$1$2[REDACTED]",
		)
		.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
}

function getServiceContext(deployment: DeploymentRow) {
	const app = deployment.application;
	if (app?.environment?.project && app.environment) {
		return {
			projectId: app.environment.project.projectId,
			projectName: app.environment.project.name,
			environmentId: app.environment.environmentId,
			environmentName: app.environment.name,
			serviceName: app.name,
			serviceType: "Application",
		};
	}
	const compose = deployment.compose;
	if (compose?.environment?.project && compose.environment) {
		return {
			projectId: compose.environment.project.projectId,
			projectName: compose.environment.project.name,
			environmentId: compose.environment.environmentId,
			environmentName: compose.environment.name,
			serviceName: compose.name,
			serviceType: "Compose",
		};
	}
	return null;
}

function DetailField({ label, children }: React.PropsWithChildren<{ label: string }>) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<div className="break-words text-sm">{children}</div>
		</div>
	);
}

export function DeploymentDetailDialog({
	deployment,
	onOpenChange,
}: {
	deployment: DeploymentRow | null;
	onOpenChange: (open: boolean) => void;
}) {
	const open = deployment !== null;
	const {
		data: logs,
		isLoading,
		isError,
		error,
		refetch,
		isFetching,
	} = api.deployment.readLogs.useQuery(
		{
			deploymentId: deployment?.deploymentId ?? "",
			tail: 1000,
		},
		{
			enabled: open && deployment?.logPath != null,
			refetchInterval: deployment?.status === "running" ? 3000 : false,
		},
	);
	const service = deployment ? getServiceContext(deployment) : null;
	const runtimeServer =
		deployment?.server?.name ??
		deployment?.application?.server?.name ??
		deployment?.compose?.server?.name;
	const buildServer =
		deployment?.buildServer?.name ?? deployment?.application?.buildServer?.name;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				{deployment && (
					<>
						<DialogHeader>
							<div className="flex flex-wrap items-start justify-between gap-3 pr-8">
								<div className="min-w-0">
									<DialogTitle className="break-words text-lg">
										{deployment.title || "Deployment"}
									</DialogTitle>
									<DialogDescription className="mt-1 font-mono text-xs">
										#{deployment.deploymentId}
									</DialogDescription>
								</div>
								<Badge
									variant={
										deployment.status === "done"
											? "green"
											: deployment.status === "error"
												? "red"
												: deployment.status === "running"
													? "yellow"
													: "outline"
									}
								>
									{deployment.status ?? "running"}
								</Badge>
							</div>
						</DialogHeader>

						<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
							<DetailField label="Project">
								{service ? (
									<Link
										className="inline-flex items-center gap-1 text-primary hover:underline"
										href={`/dashboard/project/${service.projectId}`}
									>
										{service.projectName}
										<ExternalLink className="size-3" />
									</Link>
								) : (
									"Not available"
								)}
							</DetailField>
							<DetailField label="Environment">
								{service ? (
									<Link
										className="inline-flex items-center gap-1 text-primary hover:underline"
										href={`/dashboard/project/${service.projectId}/environment/${service.environmentId}`}
									>
										{service.environmentName}
										<ExternalLink className="size-3" />
									</Link>
								) : (
									"Not available"
								)}
							</DetailField>
							<DetailField label="Service">
								{service ? (
									<div className="space-y-1">
										<p>{service.serviceName}</p>
										<p className="text-xs text-muted-foreground">
											{service.serviceType}
										</p>
										<Link
											className="inline-flex items-center gap-1 text-primary hover:underline"
											href="/dashboard/overview"
										>
											View services
											<ExternalLink className="size-3" />
										</Link>
									</div>
								) : (
									"Not available"
								)}
							</DetailField>
							<DetailField label="Created">
								{formatDate(deployment.createdAt)}
							</DetailField>
							<DetailField label="Started">
								{formatDate(deployment.startedAt)}
							</DetailField>
							<DetailField label="Finished">
								{formatDate(deployment.finishedAt)}
							</DetailField>
							<DetailField label="Runtime server">
								{runtimeServer ?? "Not available"}
							</DetailField>
							<DetailField label="Build server">
								{buildServer ?? "Not available"}
							</DetailField>
							<DetailField label="Related record">
								{deployment.isPreviewDeployment
									? "Preview deployment"
									: deployment.rollbackId
										? "Rollback"
										: deployment.scheduleId
											? "Scheduled deployment"
											: deployment.backupId
												? "Backup operation"
												: deployment.volumeBackupId
													? "Volume backup"
													: "Not available"}
							</DetailField>
						</div>

						{deployment.description && (
							<section className="space-y-2 border-t pt-4">
								<h3 className="text-sm font-semibold">Description</h3>
								<p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
									{deployment.description}
								</p>
							</section>
						)}

						{deployment.errorMessage && (
							<section className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
								<h3 className="text-sm font-semibold text-destructive">
									Deployment error
								</h3>
								<pre className="whitespace-pre-wrap break-words font-mono text-xs">
									{redactSensitiveLogValues(deployment.errorMessage)}
								</pre>
							</section>
						)}

						<section className="space-y-3 border-t pt-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<h3 className="text-sm font-semibold">Deployment logs</h3>
									<p className="text-xs text-muted-foreground">
										{deployment.status === "running"
											? "Recent output refreshes while this deployment is running."
											: "Recent output from this deployment."}
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void refetch()}
									disabled={isFetching || deployment.logPath == null}
								>
									<RefreshCw
										className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`}
									/>
									Refresh logs
								</Button>
							</div>
							{deployment.logPath == null ? (
								<p className="rounded-md border p-4 text-sm text-muted-foreground">
									Logs are not available for this deployment.
								</p>
							) : isLoading ? (
								<div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="size-4 animate-spin" />
									Loading logs...
								</div>
							) : isError ? (
								<div className="rounded-md border border-destructive/40 p-4 text-sm">
									<p className="font-medium text-destructive">
										Unable to load deployment logs
									</p>
									<p className="mt-1 text-muted-foreground">{error.message}</p>
								</div>
							) : logs?.trim() ? (
								<pre className="max-h-[360px] overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-xs leading-5">
									{redactSensitiveLogValues(logs)}
								</pre>
							) : (
								<p className="rounded-md border p-4 text-sm text-muted-foreground">
									No log output is available yet.
								</p>
							)}
						</section>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
