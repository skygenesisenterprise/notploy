import type { inferRouterOutputs } from "@trpc/server";
import { format, formatDistanceToNow, startOfDay } from "date-fns";
import {
	Activity,
	ArrowRight,
	BookOpen,
	Boxes,
	CheckCircle2,
	CircleAlert,
	FolderInput,
	GitBranch,
	Rocket,
	Server,
	TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useMemo } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { HandleProject } from "@/components/dashboard/projects/handle-project";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/utils/api";

type Service = inferRouterOutputs<AppRouter>["overview"]["services"][number];
type HomeActivity = inferRouterOutputs<AppRouter>["deployment"]["homeActivity"];
type Deployment = HomeActivity["recent"][number];

const EMPTY_SERVICES: Service[] = [];

function workloadHref(service: Service) {
	return `/dashboard/project/${service.projectId}/environment/${service.environmentId}/services/${service.type}/${service.id}`;
}

function deploymentTarget(deployment: Deployment) {
	if (deployment.application?.environment?.project) {
		const { application, applicationId } = deployment;
		return {
			name: application.name,
			project: application.environment.project.name,
			environment: application.environment.name,
			href: `/dashboard/project/${application.environment.project.projectId}/environment/${application.environment.environmentId}/services/application/${applicationId}`,
		};
	}
	if (deployment.compose?.environment?.project) {
		const { compose, composeId } = deployment;
		return {
			name: compose.name,
			project: compose.environment.project.name,
			environment: compose.environment.name,
			href: `/dashboard/project/${compose.environment.project.projectId}/environment/${compose.environment.environmentId}/services/compose/${composeId}`,
		};
	}
	return null;
}

function statusLabel(status: string | null) {
	if (status === "done") return { label: "Healthy", variant: "green" as const };
	if (status === "running")
		return { label: "Deploying", variant: "yellow" as const };
	if (status === "error") return { label: "Failed", variant: "red" as const };
	return { label: "Idle", variant: "blank" as const };
}

function StatCard({
	label,
	value,
	detail,
	icon: Icon,
	tone = "text-muted-foreground",
	href,
}: {
	label: string;
	value: number | string;
	detail: string;
	icon: React.ElementType;
	tone?: string;
	href?: string;
}) {
	const body = (
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
	);

	return (
		<Card
			className={`min-w-0 overflow-hidden ${href ? "transition-colors hover:border-foreground/20" : ""}`}
		>
			{href ? (
				<Link href={href} className="block h-full">
					{body}
				</Link>
			) : (
				body
			)}
		</Card>
	);
}

function PanelHeading({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
			<div>
				<h2 className="font-medium tracking-tight">{title}</h2>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
	);
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
			{children}
		</div>
	);
}

export function OperationsCenter() {
	const { data: permissions, isLoading: permissionsLoading } =
		api.user.getPermissions.useQuery();
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const canReadServers = !!permissions?.server.read;
	const statsQuery = api.project.homeStats.useQuery();
	const servicesQuery = api.overview.services.useQuery(undefined, {
		enabled: canReadServices,
		refetchInterval: 60_000,
	});
	const deploymentsQuery = api.deployment.homeActivity.useQuery(undefined, {
		enabled: canReadDeployments,
		refetchInterval: 60_000,
	});
	const serversQuery = api.server.all.useQuery(undefined, {
		enabled: canReadServers,
	});

	const services = servicesQuery.data ?? EMPTY_SERVICES;
	const activity = deploymentsQuery.data;
	const running = services.filter(
		(service) => service.status === "done",
	).length;
	const deploying = services.filter(
		(service) => service.status === "running",
	).length;
	const failedServices = services.filter(
		(service) => service.status === "error",
	).length;
	const failedDeployments = activity?.failed ?? [];
	const recentDeployments = activity?.recent ?? [];
	const inProgressDeployments = recentDeployments.filter(
		(deployment) => deployment.status === "running",
	).length;
	const activeServers =
		serversQuery.data?.filter((server) => server.serverStatus === "active")
			.length ?? 0;

	const deploymentSeries = useMemo(() => {
		const days = new Map<
			number,
			{ label: string; completed: number; failed: number; deploying: number }
		>();
		for (const deployment of activity?.recent ?? []) {
			const day = startOfDay(new Date(deployment.createdAt)).getTime();
			const point = days.get(day) ?? {
				label: format(day, "MMM d"),
				completed: 0,
				failed: 0,
				deploying: 0,
			};
			if (deployment.status === "done") point.completed += 1;
			if (deployment.status === "error") point.failed += 1;
			if (deployment.status === "running") point.deploying += 1;
			days.set(day, point);
		}
		return [...days.entries()]
			.sort(([left], [right]) => left - right)
			.map(([, point]) => point);
	}, [activity]);

	const projectSeries = useMemo(() => {
		const projects = new Map<string, number>();
		for (const service of services) {
			projects.set(
				service.projectName,
				(projects.get(service.projectName) ?? 0) + 1,
			);
		}
		return [...projects.entries()]
			.sort(([, left], [, right]) => right - left)
			.slice(0, 6)
			.map(([label, workloads]) => ({ label, workloads }));
	}, [services]);

	const healthSeries = [
		{ name: "Healthy", value: running, fill: "var(--chart-2)" },
		{ name: "Deploying", value: deploying, fill: "var(--chart-3)" },
		{ name: "Failed", value: failedServices, fill: "var(--destructive)" },
		{
			name: "Idle",
			value: Math.max(
				services.length - running - deploying - failedServices,
				0,
			),
			fill: "var(--chart-4)",
		},
	].filter((item) => item.value > 0);

	const isLoading =
		permissionsLoading ||
		statsQuery.isLoading ||
		(canReadServices && servicesQuery.isLoading) ||
		(canReadDeployments && deploymentsQuery.isLoading);
	const attentionItems = [
		...services
			.filter((service) => service.status === "error")
			.map((service) => ({
				id: `service-${service.type}-${service.id}`,
				title: service.name,
				detail: `Workload error · ${service.projectName} / ${service.environmentName}`,
				href: workloadHref(service),
			})),
		...failedDeployments
			.map((deployment) => ({
				deployment,
				target: deploymentTarget(deployment),
			}))
			.filter(
				(
					item,
				): item is {
					deployment: Deployment;
					target: NonNullable<ReturnType<typeof deploymentTarget>>;
				} => item.target !== null,
			)
			.map(({ deployment, target }) => ({
				id: `deployment-${deployment.deploymentId}`,
				title: target.name,
				detail: `Failed deployment · ${target.project} / ${target.environment}`,
				href: target.href,
			})),
	].slice(0, 5);

	const hasPartialError =
		servicesQuery.isError || deploymentsQuery.isError || statsQuery.isError;

	const quickActions: {
		label: string;
		href: string;
		icon: React.ElementType;
		meta?: string;
		external?: boolean;
	}[] = [{ label: "View projects", href: "/dashboard/projects", icon: FolderInput }];
	if (canReadDeployments) {
		quickActions.push({
			label: "Review deployments",
			href: "/dashboard/deployments",
			icon: Rocket,
		});
	}
	if (permissions?.monitoring?.read) {
		quickActions.push({
			label: "Open monitoring",
			href: "/dashboard/monitoring",
			icon: Activity,
		});
	}
	if (canReadServers) {
		quickActions.push({
			label: "Manage servers",
			href: "/dashboard/settings/servers",
			icon: Server,
			meta: `${activeServers} active`,
		});
	}
	if (permissions?.gitProviders?.read) {
		quickActions.push({
			label: "Connect a Git provider",
			href: "/dashboard/settings/git-providers",
			icon: GitBranch,
		});
	}
	quickActions.push({
		label: "Documentation",
		href: "https://docs.notploy.com/docs/core",
		icon: BookOpen,
		external: true,
	});

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Track your projects, services and deployments, and act on what
							needs attention.
						</p>
					</div>
					<div className="flex items-center gap-2">
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
						{permissions?.project.create && <HandleProject />}
					</div>
				</header>
				{hasPartialError && (
					<AlertBlock type="error">
						Some operational data could not be loaded. Showing the information
						that is currently available.
					</AlertBlock>
				)}
				<section
					aria-label="Workspace summary"
					className="grid grid-cols-2 gap-3 xl:grid-cols-4"
				>
					<StatCard
						label="Projects"
						value={statsQuery.isError ? "—" : (statsQuery.data?.projects ?? 0)}
						detail={
							statsQuery.data
								? `${statsQuery.data.environments} environments`
								: "Projects in this workspace"
						}
						icon={FolderInput}
						href="/dashboard/projects"
					/>
					<StatCard
						label="Services"
						value={
							isLoading ? "—" : (statsQuery.data?.services ?? services.length)
						}
						detail={
							canReadServices
								? `${running} healthy · ${failedServices} failed`
								: "Permission required"
						}
						icon={Boxes}
						tone="text-sky-600 dark:text-sky-400"
						href="/dashboard/overview"
					/>
					<StatCard
						label="Deployments"
						value={
							canReadDeployments && activity ? recentDeployments.length : "—"
						}
						detail={
							canReadDeployments
								? `${inProgressDeployments} in progress · ${failedDeployments.length} failed`
								: "Permission required"
						}
						icon={Rocket}
						tone="text-amber-600 dark:text-amber-400"
						href="/dashboard/deployments"
					/>
					<StatCard
						label="Needs attention"
						value={
							canReadServices || canReadDeployments
								? failedServices + failedDeployments.length
								: "—"
						}
						detail="Failed services and deployments"
						icon={TriangleAlert}
						tone="text-destructive"
					/>
				</section>

				<section className="grid gap-4 xl:grid-cols-12">
					<Card className="xl:col-span-8">
						<PanelHeading
							title="Deployment activity"
							description="Outcomes from your most recent deployments"
							action={
								<Link
									href="/dashboard/deployments"
									className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									All deployments{" "}
									<ArrowRight className="size-3.5" aria-hidden />
								</Link>
							}
						/>
						{deploymentsQuery.isError ? (
							<EmptyPanel>
								Deployment activity is unavailable right now.
							</EmptyPanel>
						) : deploymentSeries.length === 0 ? (
							<EmptyPanel>
								No deployment activity has been recorded yet.
							</EmptyPanel>
						) : (
							<CardContent className="pt-4">
								<ChartContainer
									className="h-64 w-full"
									config={{
										completed: {
											label: "Completed",
											color: "var(--chart-2)",
										},
										failed: {
											label: "Failed",
											color: "var(--destructive)",
										},
										deploying: {
											label: "In progress",
											color: "var(--chart-3)",
										},
									}}
								>
									<AreaChart data={deploymentSeries}>
										<CartesianGrid vertical={false} />
										<XAxis
											dataKey="label"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
										/>
										<YAxis
											allowDecimals={false}
											tickLine={false}
											axisLine={false}
										/>
										<ChartTooltip
											content={<ChartTooltipContent labelKey="label" />}
										/>
										<Area
											type="monotone"
											dataKey="completed"
											stackId="deployments"
											stroke="var(--color-completed)"
											fill="var(--color-completed)"
											fillOpacity={0.25}
											isAnimationActive={false}
										/>
										<Area
											type="monotone"
											dataKey="deploying"
											stackId="deployments"
											stroke="var(--color-deploying)"
											fill="var(--color-deploying)"
											fillOpacity={0.25}
											isAnimationActive={false}
										/>
										<Area
											type="monotone"
											dataKey="failed"
											stackId="deployments"
											stroke="var(--color-failed)"
											fill="var(--color-failed)"
											fillOpacity={0.25}
											isAnimationActive={false}
										/>
									</AreaChart>
								</ChartContainer>
							</CardContent>
						)}
					</Card>

					<Card className="xl:col-span-4">
						<PanelHeading
							title="Workload health"
							description="Current service state"
						/>
						{!canReadServices ? (
							<EmptyPanel>You do not have access to service health.</EmptyPanel>
						) : servicesQuery.isError ? (
							<EmptyPanel>Service health is unavailable right now.</EmptyPanel>
						) : healthSeries.length === 0 ? (
							<EmptyPanel>No workloads are available yet.</EmptyPanel>
						) : (
							<CardContent className="pt-2">
								<ChartContainer className="h-52 w-full" config={{}}>
									<PieChart>
										<ChartTooltip content={<ChartTooltipContent hideLabel />} />
										<Pie
											data={healthSeries}
											dataKey="value"
											nameKey="name"
											innerRadius={54}
											outerRadius={82}
											strokeWidth={3}
										>
											{healthSeries.map((item) => (
												<Cell key={item.name} fill={item.fill} />
											))}
										</Pie>
									</PieChart>
								</ChartContainer>
								<div className="grid grid-cols-2 gap-x-3 gap-y-2 px-1 pb-1">
									{healthSeries.map((item) => (
										<div
											key={item.name}
											className="flex items-center justify-between gap-2 text-xs"
										>
											<span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
												<span
													className="size-2 shrink-0 rounded-full"
													style={{ backgroundColor: item.fill }}
												/>
												{item.name}
											</span>
											<span className="font-medium tabular-nums">
												{item.value}
											</span>
										</div>
									))}
								</div>
							</CardContent>
						)}
					</Card>
				</section>

				<section className="grid gap-4 xl:grid-cols-12">
					<Card className="xl:col-span-5">
						<PanelHeading
							title="Workloads by project"
							description="Your busiest accessible projects"
						/>
						{!canReadServices ? (
							<EmptyPanel>You do not have access to project workloads.</EmptyPanel>
						) : servicesQuery.isError ? (
							<EmptyPanel>Project workloads are unavailable right now.</EmptyPanel>
						) : projectSeries.length === 0 ? (
							<EmptyPanel>No project workloads are available yet.</EmptyPanel>
						) : (
							<CardContent className="pt-4">
								<ChartContainer
									className="h-64 w-full"
									config={{
										workloads: {
											label: "Workloads",
											color: "var(--chart-1)",
										},
									}}
								>
									<BarChart
										data={projectSeries}
										layout="vertical"
										margin={{ left: 4 }}
									>
										<CartesianGrid horizontal={false} />
										<XAxis
											type="number"
											allowDecimals={false}
											tickLine={false}
											axisLine={false}
										/>
										<YAxis
											dataKey="label"
											type="category"
											width={100}
											tickLine={false}
											axisLine={false}
										/>
										<ChartTooltip
											content={<ChartTooltipContent labelKey="label" />}
										/>
										<Bar
											dataKey="workloads"
											fill="var(--color-workloads)"
											radius={[0, 4, 4, 0]}
										/>
									</BarChart>
								</ChartContainer>
							</CardContent>
						)}
					</Card>

					<Card className="xl:col-span-7">
						<PanelHeading
							title="Action center"
							description="Workloads and deployments requiring a response"
							action={
								<Badge
									variant={
										attentionItems.length > 0 ? "destructive" : "secondary"
									}
								>
									{attentionItems.length > 0
										? `${attentionItems.length} open`
										: hasPartialError
											? "Partial data"
											: "All clear"}
								</Badge>
							}
						/>
						{attentionItems.length === 0 ? (
							<EmptyPanel>
								{hasPartialError ? (
									"Some attention data could not be loaded."
								) : (
									<span className="inline-flex items-center gap-2">
										<CheckCircle2
											className="size-4 text-emerald-600"
											aria-hidden
										/>
										No failed services or deployments need attention.
									</span>
								)}
							</EmptyPanel>
						) : (
							<ul className="mt-3 divide-y border-t">
								{attentionItems.map((item) => (
									<li key={item.id}>
										<Link
											href={item.href}
											className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
										>
											<CircleAlert
												className="size-4 shrink-0 text-destructive"
												aria-hidden
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-medium">
													{item.title}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{item.detail}
												</span>
											</span>
											<ArrowRight
												className="size-4 shrink-0 text-muted-foreground"
												aria-hidden
											/>
										</Link>
									</li>
								))}
							</ul>
						)}
					</Card>
				</section>

				<section className="grid gap-4 xl:grid-cols-12">
					<Card className="xl:col-span-8">
						<PanelHeading
							title="Recent deployments"
							description="Latest changes across accessible services"
							action={
								<Link
									href="/dashboard/deployments"
									className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									View history <ArrowRight className="size-3.5" aria-hidden />
								</Link>
							}
						/>
						{!canReadDeployments ? (
							<EmptyPanel>
								You do not have access to deployment history.
							</EmptyPanel>
						) : deploymentsQuery.isError ? (
							<EmptyPanel>
								Deployment history is unavailable right now.
							</EmptyPanel>
						) : (activity?.recent ?? []).length === 0 ? (
							<EmptyPanel>
								No deployment activity has been recorded yet.
							</EmptyPanel>
						) : (
							<ul className="mt-3 divide-y border-t">
								{(activity?.recent ?? []).slice(0, 6).map((deployment) => {
									const target = deploymentTarget(deployment);
									if (!target) return null;
									const status = statusLabel(deployment.status);
									return (
										<li key={deployment.deploymentId}>
											<Link
												href={target.href}
												className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
											>
												<Rocket
													className="size-4 shrink-0 text-muted-foreground"
													aria-hidden
												/>
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm font-medium">
														{target.name}
													</span>
													<span className="block truncate text-xs text-muted-foreground">
														{target.project} / {target.environment}
													</span>
												</span>
												<Badge
													variant={status.variant}
													className="hidden sm:inline-flex"
												>
													{status.label}
												</Badge>
												<span className="shrink-0 text-xs text-muted-foreground">
													{formatDistanceToNow(new Date(deployment.createdAt), {
														addSuffix: true,
													})}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</Card>
					<Card className="xl:col-span-4">
						<PanelHeading
							title="Quick actions"
							description="Shortcuts for common tasks"
						/>
						<div className="mt-3 divide-y border-t">
							{quickActions.map((action) => {
								const Icon = action.icon;
								const className =
									"flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5";
								const content = (
									<>
										<Icon
											className="size-4 shrink-0 text-muted-foreground"
											aria-hidden
										/>
										<span className="flex-1 text-sm font-medium">
											{action.label}
										</span>
										{action.meta ? (
											<span className="text-xs text-muted-foreground">
												{action.meta}
											</span>
										) : (
											<ArrowRight
												className="size-4 shrink-0 text-muted-foreground"
												aria-hidden
											/>
										)}
									</>
								);
								return action.external ? (
									<a
										key={action.label}
										href={action.href}
										target="_blank"
										rel="noreferrer"
										className={className}
									>
										{content}
									</a>
								) : (
									<Link
										key={action.label}
										href={action.href}
										className={className}
									>
										{content}
									</Link>
								);
							})}
						</div>
					</Card>
				</section>
			</div>
		</Card>
	);
}
