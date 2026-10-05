"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Blocks,
	Boxes,
	Check,
	CircleAlert,
	Clock3,
	Database,
	Layers,
	Network,
	RefreshCw,
	Server as ServerIcon,
	Waypoints,
} from "lucide-react";
import Link from "next/link";
import {
	ConsoleError,
	ConsoleLoading,
	ConsoleSummary,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";

interface Props {
	serverId?: string;
	serverName: string;
	local?: boolean;
}

export function DockerEngineOverview({
	serverId,
	serverName,
	local = false,
}: Props) {
	const { data, isPending, isError, error, refetch, isFetching } =
		api.docker.getEngineInfo.useQuery(
			{ serverId },
			{
				refetchInterval: 60_000,
				refetchOnWindowFocus: false,
				retry: false,
			},
		);

	if (isPending) {
		return <ConsoleLoading label={`Checking Docker Engine on ${serverName}`} />;
	}

	if (isError) {
		return (
			<div className="space-y-3 rounded-md border p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<ServerIcon className="size-5 text-muted-foreground" aria-hidden />
						<h3 className="font-medium">{serverName}</h3>
					</div>
					<Badge variant="destructive" className="gap-1.5">
						<CircleAlert className="size-3.5" aria-hidden />
						Unavailable
					</Badge>
				</div>
				<ConsoleError
					message={`Notploy cannot communicate with the Docker Engine: ${error.message}`}
					onRetry={() => void refetch()}
				/>
			</div>
		);
	}

	const { engine, capacity, swarm } = data;
	const serverQuery = serverId
		? `?serverId=${encodeURIComponent(serverId)}`
		: "";
	const links = [
		{
			label: "Containers",
			href: `/dashboard/containers${serverQuery}`,
			icon: Boxes,
		},
		{ label: "Images", href: `/dashboard/images${serverQuery}`, icon: Layers },
		{
			label: "Networks",
			href: `/dashboard/networks${serverQuery}`,
			icon: Network,
		},
		{
			label: "Volumes",
			href: `/dashboard/volumes${serverQuery}`,
			icon: Database,
		},
		{ label: "Events", href: `/dashboard/events${serverQuery}`, icon: Clock3 },
		{ label: "Health", href: `/dashboard/health${serverQuery}`, icon: Check },
		{ label: "Swarm", href: `/dashboard/swarm${serverQuery}`, icon: Waypoints },
	];

	return (
		<div className="space-y-4 rounded-md border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<h3 className="flex flex-wrap items-center gap-2 font-medium">
						<Blocks className="size-5 text-muted-foreground" aria-hidden />
						{serverName}
						<Badge className="gap-1.5">
							<span
								className="size-1.5 rounded-full bg-green-500"
								aria-hidden
							/>
							Connected
						</Badge>
						{local && <Badge variant="outline">Local</Badge>}
					</h3>
					<p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
						{engine.hostname && <span>{engine.hostname}</span>}
						{engine.operatingSystem && <span>· {engine.operatingSystem}</span>}
						{engine.architecture && <span>· {engine.architecture}</span>}
					</p>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Clock3 className="size-3.5" aria-hidden />
						Checked{" "}
						{formatDistanceToNow(new Date(data.checkedAt), { addSuffix: true })}
					</span>
					<Button
						variant="outline"
						size="icon"
						onClick={() => void refetch()}
						disabled={isFetching}
						aria-label={`Refresh Docker Engine for ${serverName}`}
					>
						<RefreshCw
							className={`size-4 ${isFetching ? "animate-spin" : ""}`}
							aria-hidden
						/>
					</Button>
				</div>
			</div>

			<ConsoleSummary>
				<SummaryMetric
					label="Docker version"
					value={engine.version ?? "Unavailable"}
					detail={engine.apiVersion ? `API ${engine.apiVersion}` : undefined}
				/>
				<SummaryMetric
					label="Storage driver"
					value={engine.storageDriver ?? "Unavailable"}
					detail={`Logging: ${engine.loggingDriver ?? "Unavailable"}`}
				/>
				<SummaryMetric
					label="Kernel"
					value={engine.kernelVersion ?? "Unavailable"}
					detail={`Cgroup: ${engine.cgroupDriver ?? "Unavailable"}`}
				/>
				<SummaryMetric
					label="Default runtime"
					value={engine.defaultRuntime ?? "Unavailable"}
					detail={engine.dockerRootDir ?? undefined}
				/>
			</ConsoleSummary>

			<ConsoleSummary>
				<SummaryMetric
					label="Containers"
					value={capacity.containers ?? 0}
					detail={`${capacity.running ?? 0} running`}
				/>
				<SummaryMetric
					label="Paused"
					value={capacity.paused ?? 0}
					detail={`${capacity.stopped ?? 0} stopped`}
				/>
				<SummaryMetric label="Images" value={capacity.images ?? 0} />
				<SummaryMetric
					label="Networks & volumes"
					value={`${capacity.networks ?? 0} / ${capacity.volumes ?? 0}`}
				/>
			</ConsoleSummary>

			<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
				<div className="space-y-1">
					<p className="text-sm font-medium">Docker Swarm</p>
					<p className="text-sm text-muted-foreground">
						{swarm.state
							? swarm.state === "active"
								? `Active · ${swarm.isManager ? "Manager" : "Worker"}`
								: capitalize(swarm.state)
							: "State unavailable"}
					</p>
				</div>
				<Button asChild variant="outline" size="sm">
					<Link href={`/dashboard/swarm${serverQuery}`}>View Swarm</Link>
				</Button>
			</div>

			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Open a resource page for detailed inspection and management.
				</p>
				<div className="flex flex-wrap gap-2">
					{links.map(({ label, href, icon: Icon }) => (
						<Button asChild key={label} variant="outline" size="sm">
							<Link href={href}>
								<Icon className="size-4" aria-hidden />
								{label}
							</Link>
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}

function capitalize(value: string) {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
