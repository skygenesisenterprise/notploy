import type { inferRouterOutputs } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowRight,
	Boxes,
	Check,
	CircleAlert,
	Clock3,
	FolderKanban,
	Rocket,
	Server,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/utils/api";
import type { AppRouter } from "@/server/api/root";

type Deployment =
	inferRouterOutputs<AppRouter>["deployment"]["allCentralized"][number];
type Project = inferRouterOutputs<AppRouter>["project"]["all"][number];
type Service = inferRouterOutputs<AppRouter>["overview"]["services"][number];

const STATUS_STYLES: Record<
	string,
	{ label: string; dot: string; className: string }
> = {
	done: {
		label: "Running",
		dot: "bg-emerald-500",
		className: "text-emerald-700 dark:text-emerald-400",
	},
	running: {
		label: "Deploying",
		dot: "bg-amber-500",
		className: "text-amber-700 dark:text-amber-400",
	},
	error: {
		label: "Needs attention",
		dot: "bg-red-500",
		className: "text-red-700 dark:text-red-400",
	},
	idle: {
		label: "Idle",
		dot: "bg-muted-foreground/50",
		className: "text-muted-foreground",
	},
	cancelled: {
		label: "Cancelled",
		dot: "bg-muted-foreground/50",
		className: "text-muted-foreground",
	},
};

const DEFAULT_STATUS_STYLE = {
	label: "Idle",
	dot: "bg-muted-foreground/50",
	className: "text-muted-foreground",
};

function getServiceStatus(status: string | null | undefined) {
	return STATUS_STYLES[status ?? "idle"] ?? DEFAULT_STATUS_STYLE;
}

function getDeploymentService(deployment: Deployment) {
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

function countProjectServices(project: Project) {
	return project.environments.reduce((total, environment) => {
		return (
			total +
			(environment.applications?.length ?? 0) +
			(environment.compose?.length ?? 0) +
			(environment.libsql?.length ?? 0) +
			(environment.mariadb?.length ?? 0) +
			(environment.mongo?.length ?? 0) +
			(environment.mysql?.length ?? 0) +
			(environment.postgres?.length ?? 0) +
			(environment.redis?.length ?? 0)
		);
	}, 0);
}

function getProjectStatus(project: Project) {
	const statuses = project.environments.flatMap((environment) => [
		...(environment.applications ?? []).map((item) => item.applicationStatus),
		...(environment.compose ?? []).map((item) => item.composeStatus),
	]);

	if (statuses.includes("error")) return "Needs attention";
	if (statuses.includes("running")) return "Deploying";
	if (statuses.some((status) => status === "done")) return "Workloads running";
	return "No active workloads";
}

function ServiceStatus({ status }: { status: string | null }) {
	const style = getServiceStatus(status);
	return (
		<span
			className={`inline-flex items-center gap-1.5 text-xs ${style.className}`}
		>
			<span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
			{style.label}
		</span>
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
			<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
			{href && hrefLabel && (
				<Link
					href={href}
					className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					{hrefLabel}
					<ArrowRight className="size-3.5" aria-hidden />
				</Link>
			)}
		</div>
	);
}

function ProjectList({ projects }: { projects: Project[] }) {
	if (projects.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
					<FolderKanban className="size-8 text-muted-foreground" aria-hidden />
					<p className="text-sm text-muted-foreground">
						No projects yet. Create a project to start organizing workloads.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{projects.slice(0, 6).map((project) => {
				const environmentId = project.environments[0]?.environmentId;
				return (
					<Link
						key={project.projectId}
						href={
							environmentId
								? `/dashboard/project/${project.projectId}/environment/${environmentId}`
								: "/dashboard/projects"
						}
						className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-center gap-2">
								<FolderKanban
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span className="truncate font-medium">{project.name}</span>
							</div>
							<span className="shrink-0 text-xs text-muted-foreground">
								{countProjectServices(project)} workloads
							</span>
						</div>
						<div className="mt-3 flex items-center justify-between gap-2">
							<span className="truncate text-xs text-muted-foreground">
								{project.environments.length}{" "}
								{project.environments.length === 1
									? "environment"
									: "environments"}
							</span>
							<span className="truncate text-xs text-muted-foreground">
								{getProjectStatus(project)}
							</span>
						</div>
					</Link>
				);
			})}
		</div>
	);
}

function WorkloadList({ services }: { services: Service[] }) {
	if (services.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
					<Boxes className="size-8 text-muted-foreground" aria-hidden />
					<p className="text-sm text-muted-foreground">
						No applications or services to show yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<ul className="divide-y">
				{services.slice(0, 8).map((service) => {
					const href = `/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`;
					return (
						<li key={`${service.type}-${service.id}`}>
							<Link
								href={href}
								className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
							>
								<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
									<Boxes className="size-4 text-muted-foreground" aria-hidden />
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm font-medium">
										{service.name}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{service.projectName} · {service.environmentName}
									</span>
								</span>
								<span className="hidden shrink-0 sm:inline-flex">
									<ServiceStatus status={service.status} />
								</span>
								<span className="hidden w-28 shrink-0 justify-end text-right text-xs text-muted-foreground md:inline-flex">
									{service.lastDeployAt
										? formatDistanceToNow(new Date(service.lastDeployAt), {
												addSuffix: true,
											})
										: "Not deployed"}
								</span>
								<ArrowRight
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden
								/>
							</Link>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}

function RecentDeployments({ deployments }: { deployments: Deployment[] }) {
	const recent = deployments.slice(0, 5);
	if (recent.length === 0) {
		return (
			<Card>
				<CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
					<Rocket className="size-4 shrink-0" aria-hidden />
					No deployments yet.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<ul className="divide-y">
				{recent.map((deployment) => {
					const service = getDeploymentService(deployment);
					if (!service) return null;
					const status = getServiceStatus(deployment.status);
					return (
						<li key={deployment.deploymentId}>
							<Link
								href={service.href}
								className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
							>
								<span
									className={`size-2 shrink-0 rounded-full ${status.dot}`}
								/>
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm font-medium">
										{service.name}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{service.project} · {service.environment}
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
	);
}

export const ShowHome = () => {
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: homeStats } = api.project.homeStats.useQuery();
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const canReadServers = !!permissions?.server.read;
	const { data: projects = [], isLoading: projectsLoading } =
		api.project.all.useQuery();
	const { data: services = [], isLoading: servicesLoading } =
		api.overview.services.useQuery(undefined, {
			enabled: canReadServices,
			refetchInterval: 30_000,
		});
	const { data: deployments = [] } = api.deployment.allCentralized.useQuery(
		undefined,
		{
			enabled: canReadDeployments,
			refetchInterval: 10_000,
		},
	);
	const { data: servers = [] } = api.server.all.useQuery(undefined, {
		enabled: !isCloud && canReadServers,
	});

	const firstName = auth?.user?.firstName?.trim();
	const sortedServices = useMemo(
		() =>
			[...services].sort((a, b) => {
				const priority = (status: string | null) =>
					status === "error" ? 0 : status === "running" ? 1 : 2;
				return (
					priority(a.status) - priority(b.status) ||
					a.name.localeCompare(b.name)
				);
			}),
		[services],
	);
	const recentDeployments = useMemo(
		() =>
			[...deployments].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[deployments],
	);
	const attentionServices = useMemo(
		() => services.filter((service) => service.status === "error"),
		[services],
	);
	const runningCount = homeStats?.status.running ?? 0;
	const deployingCount = services.filter(
		(service) => service.status === "running",
	).length;
	const projectCards = useMemo(() => projects.slice(0, 6), [projects]);

	const projectsSection = (
		<section className="space-y-3" aria-label="Projects">
			<SectionHeading
				title="Projects"
				href="/dashboard/projects"
				hrefLabel="All projects"
			/>
			{projectsLoading ? (
				<div className="rounded-xl border px-5 py-8 text-sm text-muted-foreground">
					Loading projects…
				</div>
			) : (
				<ProjectList projects={projectCards} />
			)}
		</section>
	);

	const workloadsSection = (
		<section className="space-y-3" aria-label="Applications and services">
			<SectionHeading
				title="Applications & services"
				href={canReadServices ? "/dashboard/overview" : undefined}
				hrefLabel="View all"
			/>
			{servicesLoading ? (
				<div className="rounded-xl border px-5 py-8 text-sm text-muted-foreground">
					Loading workloads…
				</div>
			) : (
				<WorkloadList services={sortedServices} />
			)}
		</section>
	);

	return (
		<Card className="h-full min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div className="space-y-1">
						<h1 className="text-3xl font-semibold tracking-tight">
							{firstName ? `Welcome back, ${firstName}` : "Welcome back"}
						</h1>
					</div>
				</header>

				{isCloud ? (
					<>
						{projectsSection}
						{canReadServices && workloadsSection}
					</>
				) : (
					<>
						{canReadServices && workloadsSection}
						{projectsSection}
					</>
				)}

				{attentionServices.length > 0 && (
					<section className="space-y-3" aria-label="Needs attention">
						<SectionHeading title="Needs attention" />
						<Card className="border-destructive/40">
							<ul className="divide-y">
								{attentionServices.slice(0, 5).map((service) => (
									<li key={`${service.type}-${service.id}`}>
										<Link
											href={`/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`}
											className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
										>
											<CircleAlert
												className="size-4 shrink-0 text-destructive"
												aria-hidden
											/>
											<span className="flex min-w-0 flex-1 flex-col">
												<span className="truncate text-sm font-medium">
													{service.name}
												</span>
												<span className="truncate text-xs text-muted-foreground">
													{service.projectName} · {service.environmentName}
												</span>
											</span>
											<span className="text-xs font-medium text-destructive">
												Error
											</span>
											<ArrowRight
												className="size-4 text-muted-foreground"
												aria-hidden
											/>
										</Link>
									</li>
								))}
							</ul>
						</Card>
					</section>
				)}

				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
					{canReadDeployments && (
						<section className="space-y-3" aria-label="Recent deployments">
							<SectionHeading
								title="Recent deployments"
								href="/dashboard/overview?tab=deployments"
								hrefLabel="All deployments"
							/>
							<RecentDeployments deployments={recentDeployments} />
						</section>
					)}

					{!isCloud && canReadServers && (
						<section className="space-y-3" aria-label="Infrastructure">
							<SectionHeading
								title="Infrastructure"
								href="/dashboard/settings/servers"
								hrefLabel="Manage"
							/>
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-sm font-medium">
										<Server
											className="size-4 text-muted-foreground"
											aria-hidden
										/>
										Platform supporting your workloads
									</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
									<span>
										<strong className="tabular-nums">{servers.length}</strong>{" "}
										<span className="text-muted-foreground">
											{servers.length === 1 ? "server" : "servers"}
										</span>
									</span>
									<span>
										<strong className="tabular-nums">{runningCount}</strong>{" "}
										<span className="text-muted-foreground">
											running workloads
										</span>
									</span>
									{deployingCount > 0 ? (
										<span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
											<Clock3 className="size-3.5" aria-hidden />
											{deployingCount} deploying
										</span>
									) : (
										<span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
											<Check className="size-3.5" aria-hidden />
											No active deployments
										</span>
									)}
								</CardContent>
							</Card>
						</section>
					)}
				</div>
			</div>
		</Card>
	);
};
