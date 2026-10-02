import { formatDistanceToNow } from "date-fns";
import {
	Blocks,
	Boxes,
	Check,
	CircleAlert,
	Clock3,
	Cpu,
	Database,
	HardDrive,
	Layers,
	Loader2,
	Network,
	RefreshCw,
	Server as ServerIcon,
	Waypoints,
} from "lucide-react";
import Link from "next/link";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	const {
		data,
		isPending,
		isError,
		error,
		refetch,
		isFetching,
	} = api.docker.getEngineInfo.useQuery(
		{ serverId },
		{
			refetchInterval: 60_000,
			refetchOnWindowFocus: false,
			retry: false,
		},
	);

	if (isPending) {
		return (
			<Card>
				<CardContent
					className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"
					role="status"
				>
					Checking Docker Engine on {serverName}
					<Loader2 className="size-4 animate-spin" aria-hidden />
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-3">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-lg">
							<ServerIcon className="size-5 text-muted-foreground" aria-hidden />
							{serverName}
						</CardTitle>
						<CardDescription>Docker Engine status</CardDescription>
					</div>
					<Badge variant="destructive" className="gap-1.5">
						<CircleAlert className="size-3.5" aria-hidden />
						Unavailable
					</Badge>
				</CardHeader>
				<CardContent className="space-y-3">
					<AlertBlock type="error">
						Notploy cannot communicate with the Docker Engine: {error.message}
					</AlertBlock>
					<Button
						variant="outline"
						onClick={() => void refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={`size-4 ${isFetching ? "animate-spin" : ""}`}
							aria-hidden
						/>
						Refresh
					</Button>
				</CardContent>
			</Card>
		);
	}

	const { engine, capacity, swarm } = data;
	const serverQuery = serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";
	const links = [
		{ label: "Containers", href: `/dashboard/containers${serverQuery}`, icon: Boxes },
		{ label: "Images", href: `/dashboard/images${serverQuery}`, icon: Layers },
		{ label: "Networks", href: `/dashboard/networks${serverQuery}`, icon: Network },
		{ label: "Volumes", href: `/dashboard/volumes${serverQuery}`, icon: Database },
		{ label: "Events", href: `/dashboard/events${serverQuery}`, icon: Clock3 },
		{ label: "Health", href: `/dashboard/health${serverQuery}`, icon: Check },
		{ label: "Swarm", href: `/dashboard/swarm${serverQuery}`, icon: Waypoints },
	];

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-xl">
							<Blocks className="size-5 text-muted-foreground" aria-hidden />
							Docker Engine
							<Badge variant="default" className="gap-1.5">
								<span className="size-1.5 rounded-full bg-green-500" aria-hidden />
								Connected
							</Badge>
						</CardTitle>
						<CardDescription className="flex flex-wrap items-center gap-x-2">
							<span>{serverName}</span>
							{local && <Badge variant="outline">Local</Badge>}
							{engine.hostname && <span>· {engine.hostname}</span>}
							{engine.operatingSystem && <span>· {engine.operatingSystem}</span>}
							{engine.architecture && <span>{engine.architecture}</span>}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<Clock3 className="size-3.5" aria-hidden />
							Checked{" "}
							{formatDistanceToNow(new Date(data.checkedAt), {
								addSuffix: true,
							})}
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
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<RuntimeValue label="Docker version" value={engine.version} />
						<RuntimeValue
							label="API version"
							value={
								engine.apiVersion
									? `${engine.apiVersion}${engine.minimumApiVersion ? ` (min ${engine.minimumApiVersion})` : ""}`
									: undefined
							}
						/>
						<RuntimeValue label="Storage driver" value={engine.storageDriver} />
						<RuntimeValue label="Logging driver" value={engine.loggingDriver} />
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<RuntimeValue label="Kernel" value={engine.kernelVersion} />
						<RuntimeValue label="Cgroup driver" value={engine.cgroupDriver} />
						<RuntimeValue label="Default runtime" value={engine.defaultRuntime} />
						<RuntimeValue
							label="Docker root directory"
							value={engine.dockerRootDir}
						/>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Runtime capacity</CardTitle>
						<CardDescription>
							Current resource totals reported by the Docker Engine.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						<CapacityValue label="Containers" value={capacity.containers} />
						<CapacityValue label="Running" value={capacity.running} />
						<CapacityValue label="Paused" value={capacity.paused} />
						<CapacityValue label="Stopped" value={capacity.stopped} />
						<CapacityValue label="Images" value={capacity.images} />
						<CapacityValue label="Networks" value={capacity.networks} />
						<CapacityValue label="Volumes" value={capacity.volumes} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Docker Swarm</CardTitle>
						<CardDescription>
							Cluster state is separate from the Docker Engine runtime.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center justify-between gap-3">
						<div className="space-y-1">
							<p className="font-medium">
								{swarm.state
									? swarm.state === "active"
										? "Active"
										: capitalize(swarm.state)
									: "State unavailable"}
							</p>
							{swarm.state === "active" && (
								<p className="text-xs text-muted-foreground">
									{swarm.isManager ? "Manager" : "Worker"}
								</p>
							)}
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href={`/dashboard/swarm${serverQuery}`}>
								View Swarm
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Docker resources</CardTitle>
					<CardDescription>
						Open a resource page for detailed inspection and management.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{links.map(({ label, href, icon: Icon }) => (
						<Button asChild key={label} variant="outline" size="sm">
							<Link href={href}>
								<Icon className="size-4" aria-hidden />
								{label}
							</Link>
						</Button>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

function RuntimeValue({ label, value }: { label: string; value?: string | null }) {
	return (
		<div className="min-w-0 rounded-lg border p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 break-words text-sm font-medium">{value || "Unavailable"}</p>
		</div>
	);
}

function CapacityValue({
	label,
	value,
}: {
	label: string;
	value?: number | null;
}) {
	return (
		<div className="rounded-lg border p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-lg font-semibold tabular-nums">
				{value ?? "—"}
			</p>
		</div>
	);
}

function capitalize(value: string) {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
