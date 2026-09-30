import { ContainerFreeMonitoring } from "@/components/dashboard/monitoring/free/container/show-free-container-monitoring";
import { Card } from "@/components/ui/card";
import { api } from "@/utils/api";

function OverviewMetric({
	label,
	value,
	detail,
	critical = false,
}: {
	label: string;
	value: string;
	detail: string;
	critical?: boolean;
}) {
	return (
		<div className="rounded-lg border bg-background p-4">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
			<p
				className={`mt-1 text-xs ${critical ? "text-destructive" : "text-muted-foreground"}`}
			>
				{detail}
			</p>
		</div>
	);
}

export function MonitoringOverview() {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: homeStats, isLoading: statsLoading } =
		api.project.homeStats.useQuery(undefined, {
			refetchOnWindowFocus: false,
		});
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const { data: services = [], isLoading: servicesLoading } =
		api.overview.services.useQuery(undefined, {
			enabled: canReadServices,
			refetchInterval: 30_000,
		});
	const { data: deployments = [], isLoading: deploymentsLoading } =
		api.deployment.allCentralized.useQuery(undefined, {
			enabled: canReadDeployments,
			refetchInterval: 30_000,
		});
	const failedWorkloads = services.filter(
		(service) => service.status === "error",
	).length;
	const deployingCount = deployments.filter(
		(deployment) => deployment.status === "running",
	).length;
	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="space-y-1">
					<h1 className="text-3xl font-semibold tracking-tight">Monitoring</h1>
				</header>

				<section aria-label="Overview" className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<OverviewMetric
							label="Servers"
							value="1"
							detail="Primary Notploy instance"
						/>
						<OverviewMetric
							label="Running workloads"
							value={
								statsLoading ? "—" : String(homeStats?.status.running ?? 0)
							}
							detail={`${homeStats?.services ?? 0} services across accessible projects`}
						/>
						<OverviewMetric
							label="Needs attention"
							value={
								canReadServices && servicesLoading
									? "—"
									: String(failedWorkloads)
							}
							detail="Workloads reporting an error state"
							critical={failedWorkloads > 0}
						/>
						<OverviewMetric
							label="Deploying"
							value={
								canReadDeployments && deploymentsLoading
									? "—"
									: String(deployingCount)
							}
							detail="Workloads with a deployment in progress"
						/>
					</div>
				</section>

				<section aria-label="Resource monitoring" className="space-y-3">
					<h2 className="text-lg font-semibold">Resource monitoring</h2>
					<ContainerFreeMonitoring appName="notploy" />
				</section>
			</div>
		</Card>
	);
}
