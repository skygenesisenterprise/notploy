import type { inferRouterOutputs } from "@trpc/server";
import { format, formatDistanceToNow, startOfDay } from "date-fns";
import {
	Activity,
	ArrowRight,
	Boxes,
	CircleAlert,
	CircleCheckBig,
	Clock3,
	History,
	Rocket,
	Server,
	TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useMemo } from "react";
import {
	DashboardCanvas,
	type DashboardWidgetDefinition,
} from "@/components/dashboard/dashboard-canvas";
import {
	type HomeChartSource,
	HomeDataChart,
} from "@/components/dashboard/home/home-data-chart";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/utils/api";

type Service = inferRouterOutputs<AppRouter>["overview"]["services"][number];
type ProjectStats = inferRouterOutputs<AppRouter>["project"]["homeStats"];
type HomeActivity = inferRouterOutputs<AppRouter>["deployment"]["homeActivity"];
type HomeDeployment = HomeActivity["recent"][number];

const CHART_SERIES_COLORS = {
	projects: "var(--chart-1)",
	environments: "var(--chart-2)",
	workloads: "var(--chart-3)",
};
const EMPTY_SERVICES: Service[] = [];

function buildHomeChartSources({
	services,
	activity,
	stats,
	canReadServices,
	canReadDeployments,
	includeProjectInventory = false,
}: {
	services: Service[];
	activity?: HomeActivity;
	stats?: ProjectStats;
	canReadServices: boolean;
	canReadDeployments: boolean;
	includeProjectInventory?: boolean;
}): HomeChartSource[] {
	const sources: HomeChartSource[] = [];

	if (canReadServices) {
		const running = services.filter(
			(service) => service.status === "done",
		).length;
		const deploying = services.filter(
			(service) => service.status === "running",
		).length;
		const failed = services.filter(
			(service) => service.status === "error",
		).length;
		const stopped = services.length - running - deploying - failed;
		sources.push({
			id: "workload-status",
			label: "Workload status",
			description: "Current status of workloads you can access.",
			data: [{ label: "Current", running, deploying, failed, stopped }],
			series: [
				{
					key: "running",
					label: "Running",
					color: "var(--chart-2)",
				},
				{
					key: "deploying",
					label: "Deploying",
					color: "var(--chart-3)",
				},
				{
					key: "failed",
					label: "Failed",
					color: "var(--destructive)",
				},
				{
					key: "stopped",
					label: "Stopped / idle",
					color: "var(--chart-4)",
				},
			],
			views: ["bar", "pie"],
		});

		const workloadsByProject = new Map<string, number>();
		const workloadTypes = new Map<string, number>();
		for (const service of services) {
			workloadsByProject.set(
				service.projectName,
				(workloadsByProject.get(service.projectName) ?? 0) + 1,
			);
			workloadTypes.set(
				service.type,
				(workloadTypes.get(service.type) ?? 0) + 1,
			);
		}
		const projectPoints = [...workloadsByProject.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([label, workloads]) => ({ label, workloads }));
		const otherProjects = [...workloadsByProject.values()]
			.sort((a, b) => b - a)
			.slice(8)
			.reduce((sum, count) => sum + count, 0);
		if (otherProjects > 0) {
			projectPoints.push({ label: "Other projects", workloads: otherProjects });
		}
		sources.push({
			id: "workloads-by-project",
			label: "Workloads by project",
			description: "Accessible workload counts grouped by project.",
			data: projectPoints,
			series: [
				{
					key: "workloads",
					label: "Workloads",
					color: "var(--chart-1)",
				},
			],
			views: ["bar", "pie"],
		});
		sources.push({
			id: "workload-types",
			label: "Workload types",
			description: "Distribution of accessible services by type.",
			data: [...workloadTypes.entries()].map(([label, count]) => ({
				label,
				workloads: count,
			})),
			series: [
				{
					key: "workloads",
					label: "Workloads",
					color: "var(--chart-2)",
				},
			],
			views: ["bar", "pie"],
		});
	}

	if (canReadDeployments) {
		const deploymentsByDay = new Map<
			number,
			{ label: string; completed: number; failed: number; inProgress: number }
		>();
		for (const deployment of activity?.recent ?? []) {
			const day = startOfDay(new Date(deployment.createdAt)).getTime();
			const point = deploymentsByDay.get(day) ?? {
				label: format(day, "MMM d"),
				completed: 0,
				failed: 0,
				inProgress: 0,
			};
			if (deployment.status === "done") point.completed++;
			else if (deployment.status === "error") point.failed++;
			else if (deployment.status === "running") point.inProgress++;
			deploymentsByDay.set(day, point);
		}
		sources.push({
			id: "deployment-activity",
			label: "Deployment activity",
			description: `Daily outcomes across the ${activity?.recent.length ?? 0} most recent deployments.`,
			data: [...deploymentsByDay.entries()]
				.sort(([a], [b]) => a - b)
				.map(([, point]) => point),
			series: [
				{
					key: "completed",
					label: "Completed",
					color: "var(--chart-2)",
				},
				{
					key: "failed",
					label: "Failed",
					color: "var(--destructive)",
				},
				{
					key: "inProgress",
					label: "In progress",
					color: "var(--chart-3)",
				},
			],
		});
	}

	if (includeProjectInventory && stats) {
		sources.push({
			id: "project-inventory",
			label: "Project inventory",
			description: "Accessible projects, environments, and workloads.",
			data: [
				{
					label: "Total",
					projects: stats.projects,
					environments: stats.environments,
					workloads: stats.services,
				},
			],
			series: [
				{
					key: "projects",
					label: "Projects",
					color: CHART_SERIES_COLORS.projects,
				},
				{
					key: "environments",
					label: "Environments",
					color: CHART_SERIES_COLORS.environments,
				},
				{
					key: "workloads",
					label: "Workloads",
					color: CHART_SERIES_COLORS.workloads,
				},
			],
			views: ["bar"],
		});
	}

	return sources;
}

function HomeDataChartBlock({
	dashboardId,
	sources,
}: {
	dashboardId: string;
	sources: HomeChartSource[];
}) {
	return (
		<section aria-label="Operational datasets" className="space-y-3">
			<div>
				<h2 className="text-base font-semibold tracking-tight">
					Operational datasets
				</h2>
				<p className="text-xs text-muted-foreground">
					Choose a real Notploy dataset and visualization.
				</p>
			</div>
			<Card>
				<CardContent className="p-4 sm:p-5">
					<HomeDataChart dashboardId={dashboardId} sources={sources} />
				</CardContent>
			</Card>
		</section>
	);
}

function getWorkloadHref(service: Service) {
	return `/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`;
}

function getDeploymentService(deployment: HomeDeployment) {
	const application = deployment.application;
	const compose = deployment.compose;

	if (application?.environment?.project && application.environment) {
		return {
			name: application.name,
			project: application.environment.project.name,
			environment: application.environment.name,
			href: `/dashboard/project/${application.environment.project.projectId}/environment/${application.environment.environmentId}/services/application/${application.applicationId}`,
		};
	}

	if (compose?.environment?.project && compose.environment) {
		return {
			name: compose.name,
			project: compose.environment.project.name,
			environment: compose.environment.name,
			href: `/dashboard/project/${compose.environment.project.projectId}/environment/${compose.environment.environmentId}/services/compose/${compose.composeId}`,
		};
	}

	return null;
}

function getDeploymentStatus(status: string | null) {
	switch (status) {
		case "done":
			return {
				label: "Completed",
				className: "text-emerald-700 dark:text-emerald-400",
			};
		case "running":
			return {
				label: "In progress",
				className: "text-amber-700 dark:text-amber-400",
			};
		case "error":
			return { label: "Failed", className: "text-destructive" };
		case "cancelled":
			return { label: "Cancelled", className: "text-muted-foreground" };
		default:
			return { label: "Unknown", className: "text-muted-foreground" };
	}
}

function hasActionableAttention({
	services,
	activity,
	canReadServices,
	canReadDeployments,
	isLoading,
	isError,
}: {
	services: Service[];
	activity?: HomeActivity;
	canReadServices: boolean;
	canReadDeployments: boolean;
	isLoading: boolean;
	isError: boolean;
}) {
	if (isLoading || isError) return true;
	return (
		(canReadServices &&
			services.some((service) => service.status === "error")) ||
		(canReadDeployments &&
			(activity?.failed ?? []).some(
				(deployment) => getDeploymentService(deployment) !== null,
			))
	);
}

function SectionHeading({
	title,
	href,
	hrefLabel,
}: {
	title: string;
	href?: string;
	hrefLabel?: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<h2 className="text-base font-semibold tracking-tight">{title}</h2>
			{href && hrefLabel && (
				<Link
					href={href}
					className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					{hrefLabel}
					<ArrowRight className="size-3.5" aria-hidden />
				</Link>
			)}
		</div>
	);
}

function ServiceAttention({ service }: { service: Service }) {
	return (
		<li>
			<Link
				href={getWorkloadHref(service)}
				className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
			>
				<CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium">{service.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						Workload error · {service.projectName} / {service.environmentName}
					</span>
				</span>
				<Badge variant="destructive">Error</Badge>
				<ArrowRight
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
			</Link>
		</li>
	);
}

function DeploymentAttention({ deployment }: { deployment: HomeDeployment }) {
	const service = getDeploymentService(deployment);
	if (!service) return null;

	return (
		<li>
			<Link
				href={service.href}
				className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
			>
				<CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium">{service.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						Failed deployment · {service.project} / {service.environment}
					</span>
				</span>
				<span className="shrink-0 text-xs text-muted-foreground">
					{formatDistanceToNow(new Date(deployment.createdAt), {
						addSuffix: true,
					})}
				</span>
				<ArrowRight
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
			</Link>
		</li>
	);
}

function AttentionBlock({
	services,
	servicesLoading,
	servicesError,
	servicesErrorMessage,
	activity,
	activityLoading,
	activityError,
	activityErrorMessage,
	canReadServices,
	canReadDeployments,
}: {
	services: Service[];
	servicesLoading: boolean;
	servicesError: boolean;
	servicesErrorMessage?: string;
	activity?: HomeActivity;
	activityLoading: boolean;
	activityError: boolean;
	activityErrorMessage?: string;
	canReadServices: boolean;
	canReadDeployments: boolean;
}) {
	const failedServices = services.filter(
		(service) => service.status === "error",
	);
	const failedServiceIds = new Set(failedServices.map((service) => service.id));
	const failedDeployments = (activity?.failed ?? []).filter((deployment) => {
		const service = getDeploymentService(deployment);
		if (!service) return false;
		if (deployment.applicationId) {
			return !failedServiceIds.has(deployment.applicationId);
		}
		if (deployment.composeId) {
			return !failedServiceIds.has(deployment.composeId);
		}
		return false;
	});
	const isLoading =
		(servicesLoading && canReadServices) ||
		(activityLoading && canReadDeployments);
	const hasAttention =
		failedDeployments.length > 0 || failedServices.length > 0;

	if (!isLoading && !servicesError && !activityError && !hasAttention) {
		return null;
	}

	return (
		<section aria-label="Attention" className="space-y-3">
			<SectionHeading title="Attention" />
			{isLoading ? (
				<Card>
					<CardContent
						className="py-5 text-sm text-muted-foreground"
						role="status"
					>
						Checking for workload errors…
					</CardContent>
				</Card>
			) : (
				<>
					{servicesError && (
						<AlertBlock type="error">
							{servicesErrorMessage ?? "Workload status is unavailable."}
						</AlertBlock>
					)}
					{activityError && (
						<AlertBlock type="error">
							{activityErrorMessage ?? "Deployment activity is unavailable."}
						</AlertBlock>
					)}
					{hasAttention ? (
						<Card className="border-destructive/40">
							<ul className="divide-y">
								{canReadDeployments &&
									failedDeployments
										.slice(0, 5)
										.map((deployment) => (
											<DeploymentAttention
												key={deployment.deploymentId}
												deployment={deployment}
											/>
										))}
								{canReadServices &&
									failedServices
										.filter(
											(service) =>
												!failedDeployments.some(
													(deployment) =>
														deployment.applicationId === service.id ||
														deployment.composeId === service.id,
												),
										)
										.slice(0, 5)
										.map((service) => (
											<ServiceAttention
												key={`${service.type}-${service.id}`}
												service={service}
											/>
										))}
							</ul>
						</Card>
					) : null}
				</>
			)}
		</section>
	);
}

function InfrastructureBlock({
	canReadServers,
	canReadDocker,
	canReadMonitoring,
	servers,
	serversLoading,
	serversError,
	activeServers,
}: {
	canReadServers: boolean;
	canReadDocker: boolean;
	canReadMonitoring: boolean;
	servers: Array<{ serverId: string; serverStatus: string }> | undefined;
	serversLoading: boolean;
	serversError: boolean;
	activeServers: number;
}) {
	return (
		<section aria-label="Infrastructure" className="space-y-3">
			<SectionHeading title="Infrastructure" />
			<Card>
				<ul className="divide-y">
					{canReadServers && (
						<li>
							<Link
								href="/dashboard/settings/servers"
								className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
							>
								<Server
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-medium">Servers</span>
									<span className="block text-xs text-muted-foreground">
										{serversLoading
											? "Loading…"
											: serversError
												? "Status unavailable"
												: `${servers?.length ?? 0} configured · ${activeServers} active`}
									</span>
								</span>
								<ArrowRight
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
							</Link>
						</li>
					)}
					{canReadDocker &&
						[
							{ label: "Docker", href: "/dashboard/docker" },
							{
								label: "Containers",
								href: "/dashboard/docker?tab=containers",
							},
							{
								label: "Networks",
								href: "/dashboard/docker?tab=networks",
							},
						].map((resource) => (
							<li key={resource.href}>
								<Link
									href={resource.href}
									className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
								>
									<Boxes
										className="size-4 shrink-0 text-muted-foreground"
										aria-hidden
									/>
									<span className="min-w-0 flex-1 text-sm font-medium">
										{resource.label}
									</span>
									<ArrowRight
										className="size-4 shrink-0 text-muted-foreground"
										aria-hidden
									/>
								</Link>
							</li>
						))}
					{canReadMonitoring && (
						<li>
							<Link
								href="/dashboard/monitoring"
								className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
							>
								<History
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span className="min-w-0 flex-1 text-sm font-medium">
									Monitoring
								</span>
								<ArrowRight
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
							</Link>
						</li>
					)}
				</ul>
			</Card>
		</section>
	);
}

function RecentActivityBlock({
	deployments,
	isLoading,
	isError,
	errorMessage,
}: {
	deployments: HomeDeployment[];
	isLoading: boolean;
	isError: boolean;
	errorMessage?: string;
}) {
	const visibleDeployments = deployments
		.map((deployment) => ({
			deployment,
			service: getDeploymentService(deployment),
		}))
		.filter(
			(
				item,
			): item is {
				deployment: HomeDeployment;
				service: NonNullable<ReturnType<typeof getDeploymentService>>;
			} => item.service !== null,
		);

	return (
		<section aria-label="Recent deployments" className="space-y-3">
			<SectionHeading
				title="Recent deployments"
				href="/dashboard/deployments"
				hrefLabel="All deployments"
			/>
			{isLoading ? (
				<Card>
					<CardContent
						className="py-5 text-sm text-muted-foreground"
						role="status"
					>
						Loading recent deployments…
					</CardContent>
				</Card>
			) : isError ? (
				<AlertBlock type="error">
					{errorMessage ?? "Recent deployments are unavailable."}
				</AlertBlock>
			) : visibleDeployments.length === 0 ? (
				<Card>
					<CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
						<History className="size-4 shrink-0" aria-hidden />
						No deployment activity yet.
					</CardContent>
				</Card>
			) : (
				<Card>
					<ul className="divide-y">
						{visibleDeployments.map(({ deployment, service }) => {
							const status = getDeploymentStatus(deployment.status);
							return (
								<li key={deployment.deploymentId}>
									<Link
										href={service.href}
										className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
									>
										<Clock3
											className="size-4 shrink-0 text-muted-foreground"
											aria-hidden
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate text-sm font-medium">
												{service.name}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{service.project} / {service.environment}
											</span>
										</span>
										<span
											className={`hidden shrink-0 text-xs sm:inline ${status.className}`}
										>
											{status.label}
										</span>
										<span className="shrink-0 text-right text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(deployment.createdAt), {
												addSuffix: true,
											})}
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</Card>
			)}
		</section>
	);
}

function ProjectSummaryBlock({
	stats,
	isLoading,
	isError,
	errorMessage,
}: {
	stats?: ProjectStats;
	isLoading: boolean;
	isError: boolean;
	errorMessage?: string;
}) {
	return (
		<section aria-label="Projects" className="space-y-3">
			<SectionHeading
				title="Projects"
				href="/dashboard/projects"
				hrefLabel="All projects"
			/>
			{isLoading ? (
				<Card>
					<CardContent
						className="py-5 text-sm text-muted-foreground"
						role="status"
					>
						Loading project summary…
					</CardContent>
				</Card>
			) : isError ? (
				<AlertBlock type="error">
					{errorMessage ?? "Project summary is unavailable."}
				</AlertBlock>
			) : (
				<Card>
					<CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
						<SummaryValue label="Projects" value={stats?.projects ?? 0} />
						<SummaryValue
							label="Environments"
							value={stats?.environments ?? 0}
						/>
						<SummaryValue label="Workloads" value={stats?.services ?? 0} />
						{stats?.projects === 0 && (
							<p className="text-sm text-muted-foreground sm:col-span-3">
								No projects yet. Create a project to organize workloads.
							</p>
						)}
					</CardContent>
				</Card>
			)}
		</section>
	);
}

function SummaryValue({ label, value }: { label: string; value: number }) {
	return (
		<div className="space-y-1">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="text-2xl font-semibold tabular-nums">{value}</p>
		</div>
	);
}

function MetricTile({
	label,
	value,
	detail,
	icon: Icon,
	tone = "text-muted-foreground",
}: {
	label: string;
	value: number | string;
	detail: string;
	icon: React.ElementType;
	tone?: string;
}) {
	return (
		<Card className="min-w-0 overflow-hidden">
			<CardContent className="p-4 sm:p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{label}
						</p>
						<p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
							{value}
						</p>
					</div>
					<div className={`rounded-lg bg-muted p-2 ${tone}`}>
						<Icon className="size-4" aria-hidden />
					</div>
				</div>
				<p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
			</CardContent>
		</Card>
	);
}

function DashboardSummaryBlock({
	stats,
	services,
	activity,
	isLoading,
	canReadServices,
	canReadDeployments,
}: {
	stats?: ProjectStats;
	services: Service[];
	activity?: HomeActivity;
	isLoading: boolean;
	canReadServices: boolean;
	canReadDeployments: boolean;
}) {
	const running = services.filter(
		(service) => service.status === "done",
	).length;
	const deploying = services.filter(
		(service) => service.status === "running",
	).length;
	const failedServices = services.filter(
		(service) => service.status === "error",
	).length;
	const failedDeployments = activity?.failed.length ?? 0;
	const workloads = stats?.services ?? services.length;

	return (
		<section aria-label="Operational overview" className="space-y-3">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-base font-semibold tracking-tight">
						Operations at a glance
					</h2>
					<p className="text-xs text-muted-foreground">
						Real-time status across your accessible Notploy workloads.
					</p>
				</div>
				{isLoading && (
					<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						<Activity className="size-3.5 animate-pulse" aria-hidden />
						Updating
					</span>
				)}
			</div>
			<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
				<MetricTile
					label="Workloads"
					value={isLoading && !stats ? "—" : workloads}
					detail={
						stats
							? `${stats.projects} projects · ${stats.environments} environments`
							: "Accessible services"
					}
					icon={Boxes}
				/>
				<MetricTile
					label="Healthy"
					value={canReadServices ? running : "—"}
					detail={canReadServices ? "Running workloads" : "Permission required"}
					icon={CircleCheckBig}
					tone="text-emerald-600 dark:text-emerald-400"
				/>
				<MetricTile
					label="Deploying"
					value={canReadServices ? deploying : "—"}
					detail="Current rollout activity"
					icon={Rocket}
					tone="text-amber-600 dark:text-amber-400"
				/>
				<MetricTile
					label="Needs attention"
					value={
						canReadServices || canReadDeployments
							? failedServices + failedDeployments
							: "—"
					}
					detail="Failed workloads and deployments"
					icon={TriangleAlert}
					tone="text-destructive"
				/>
			</div>
		</section>
	);
}

function SelfHostedHome() {
	const { data: permissions, isError: permissionsError } =
		api.user.getPermissions.useQuery();
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const canReadServers = !!permissions?.server.read;
	const canReadDocker = !!permissions?.docker.read;
	const statsQuery = api.project.homeStats.useQuery();
	const servicesQuery = api.overview.services.useQuery(undefined, {
		enabled: canReadServices,
		refetchInterval: 60_000,
	});
	const serversQuery = api.server.all.useQuery(undefined, {
		enabled: canReadServers,
	});
	const activityQuery = api.deployment.homeActivity.useQuery(undefined, {
		enabled: canReadDeployments,
		refetchInterval: 60_000,
	});
	const services = servicesQuery.data ?? EMPTY_SERVICES;
	const servers = serversQuery.data;
	const activeServers =
		servers?.filter((server) => server.serverStatus === "active").length ?? 0;
	const chartSources = useMemo(
		() =>
			buildHomeChartSources({
				services,
				activity: activityQuery.data,
				canReadServices,
				canReadDeployments,
			}),
		[services, activityQuery.data, canReadServices, canReadDeployments],
	);

	const widgets: DashboardWidgetDefinition[] = [
		{
			id: "operations-overview",
			label: "Operations at a glance",
			size: "full",
			content: (
				<DashboardSummaryBlock
					stats={statsQuery.data}
					services={services}
					activity={activityQuery.data}
					isLoading={
						statsQuery.isLoading ||
						servicesQuery.isLoading ||
						activityQuery.isLoading
					}
					canReadServices={canReadServices}
					canReadDeployments={canReadDeployments}
				/>
			),
		},
	];
	const attentionLoading =
		(canReadServices && servicesQuery.isLoading) ||
		(canReadDeployments && activityQuery.isLoading);
	const attentionError =
		(canReadServices && servicesQuery.isError) ||
		(canReadDeployments && activityQuery.isError);
	if (
		hasActionableAttention({
			services,
			activity: activityQuery.data,
			canReadServices,
			canReadDeployments,
			isLoading: attentionLoading,
			isError: attentionError,
		})
	) {
		widgets.push({
			id: "attention",
			label: "Attention",
			size: "full",
			content: (
				<AttentionBlock
					services={services}
					servicesLoading={servicesQuery.isLoading}
					servicesError={servicesQuery.isError}
					servicesErrorMessage={servicesQuery.error?.message}
					activity={activityQuery.data}
					activityLoading={activityQuery.isLoading}
					activityError={activityQuery.isError}
					activityErrorMessage={activityQuery.error?.message}
					canReadServices={canReadServices}
					canReadDeployments={canReadDeployments}
				/>
			),
		});
	}
	if (canReadServers || canReadDocker || permissions?.monitoring.read) {
		widgets.push({
			id: "infrastructure",
			label: "Infrastructure",
			content: (
				<InfrastructureBlock
					canReadServers={canReadServers}
					canReadDocker={canReadDocker}
					canReadMonitoring={!!permissions?.monitoring.read}
					servers={servers}
					serversLoading={serversQuery.isLoading}
					serversError={serversQuery.isError}
					activeServers={activeServers}
				/>
			),
		});
	}
	if (canReadDeployments) {
		widgets.push({
			id: "recent-deployments",
			label: "Recent deployments",
			size: "full",
			content: (
				<RecentActivityBlock
					deployments={activityQuery.data?.recent ?? []}
					isLoading={activityQuery.isLoading}
					isError={activityQuery.isError}
					errorMessage={activityQuery.error?.message}
				/>
			),
		});
	}
	if (chartSources.length > 0) {
		widgets.push({
			id: "operational-datasets",
			label: "Operational datasets",
			size: "full",
			content: (
				<HomeDataChartBlock
					dashboardId="home-self-hosted"
					sources={chartSources}
				/>
			),
		});
	}
	if (permissionsError) {
		widgets.push({
			id: "access-error",
			label: "Access status",
			content: (
				<AlertBlock type="error">
					Could not load your permissions. Operational blocks are hidden.
				</AlertBlock>
			),
		});
	}

	return (
		<DashboardCanvas
			id="home-self-hosted"
			title="Home"
			description="Current workload state, infrastructure status, and the operational issues that need attention."
			widgets={widgets}
			emptyMessage="No operational blocks are available for your current permissions."
		/>
	);
}

function CloudHome() {
	const { data: permissions, isError: permissionsError } =
		api.user.getPermissions.useQuery();
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const statsQuery = api.project.homeStats.useQuery();
	const servicesQuery = api.overview.services.useQuery(undefined, {
		enabled: canReadServices,
		refetchInterval: 60_000,
	});
	const activityQuery = api.deployment.homeActivity.useQuery(undefined, {
		enabled: canReadDeployments,
		refetchInterval: 60_000,
	});
	const services = servicesQuery.data ?? EMPTY_SERVICES;
	const chartSources = useMemo(
		() =>
			buildHomeChartSources({
				services,
				activity: activityQuery.data,
				stats: statsQuery.data,
				canReadServices,
				canReadDeployments,
				includeProjectInventory: true,
			}),
		[
			services,
			activityQuery.data,
			statsQuery.data,
			canReadServices,
			canReadDeployments,
		],
	);

	const widgets: DashboardWidgetDefinition[] = [
		{
			id: "operations-overview",
			label: "Operations at a glance",
			size: "full",
			content: (
				<DashboardSummaryBlock
					stats={statsQuery.data}
					services={services}
					activity={activityQuery.data}
					isLoading={
						statsQuery.isLoading ||
						servicesQuery.isLoading ||
						activityQuery.isLoading
					}
					canReadServices={canReadServices}
					canReadDeployments={canReadDeployments}
				/>
			),
		},
		{
			id: "projects",
			label: "Projects",
			content: (
				<ProjectSummaryBlock
					stats={statsQuery.data}
					isLoading={statsQuery.isLoading}
					isError={statsQuery.isError}
					errorMessage={statsQuery.error?.message}
				/>
			),
		},
	];
	if (chartSources.length > 0) {
		widgets.push({
			id: "operational-datasets",
			label: "Operational datasets",
			size: "full",
			content: (
				<HomeDataChartBlock dashboardId="home-cloud" sources={chartSources} />
			),
		});
	}
	const attentionLoading =
		(canReadServices && servicesQuery.isLoading) ||
		(canReadDeployments && activityQuery.isLoading);
	const attentionError =
		(canReadServices && servicesQuery.isError) ||
		(canReadDeployments && activityQuery.isError);
	if (
		hasActionableAttention({
			services,
			activity: activityQuery.data,
			canReadServices,
			canReadDeployments,
			isLoading: attentionLoading,
			isError: attentionError,
		})
	) {
		widgets.push({
			id: "attention",
			label: "Attention",
			size: "full",
			content: (
				<AttentionBlock
					services={services}
					servicesLoading={servicesQuery.isLoading}
					servicesError={servicesQuery.isError}
					servicesErrorMessage={servicesQuery.error?.message}
					activity={activityQuery.data}
					activityLoading={activityQuery.isLoading}
					activityError={activityQuery.isError}
					activityErrorMessage={activityQuery.error?.message}
					canReadServices={canReadServices}
					canReadDeployments={canReadDeployments}
				/>
			),
		});
	}
	if (canReadDeployments) {
		widgets.push({
			id: "recent-deployments",
			label: "Recent deployments",
			size: "full",
			content: (
				<RecentActivityBlock
					deployments={activityQuery.data?.recent ?? []}
					isLoading={activityQuery.isLoading}
					isError={activityQuery.isError}
					errorMessage={activityQuery.error?.message}
				/>
			),
		});
	}
	if (permissionsError) {
		widgets.push({
			id: "access-error",
			label: "Access status",
			content: (
				<AlertBlock type="error">
					Could not load your permissions. Some workload blocks are hidden.
				</AlertBlock>
			),
		});
	}

	return (
		<DashboardCanvas
			id="home-cloud"
			title="Home"
			description="A concise view of your projects, workloads, deployments, and the issues that need attention."
			widgets={widgets}
			emptyMessage="No operational blocks are available for your current permissions."
		/>
	);
}

export const ShowHome = () => {
	const {
		data: isCloud,
		isLoading,
		isError,
		error,
	} = api.settings.isCloud.useQuery();

	if (isLoading) {
		return (
			<HomeFrame>
				<div className="py-8 text-sm text-muted-foreground" role="status">
					Loading platform overview…
				</div>
			</HomeFrame>
		);
	}
	if (isError) {
		return (
			<HomeFrame>
				<AlertBlock type="error">{error.message}</AlertBlock>
			</HomeFrame>
		);
	}
	return <HomeFrame>{isCloud ? <CloudHome /> : <SelfHostedHome />}</HomeFrame>;
};

function HomeFrame({ children }: { children: React.ReactNode }) {
	return (
		<Card className="h-full min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="h-full rounded-xl bg-background p-4 shadow-md sm:p-6">
				{children}
			</div>
		</Card>
	);
}
