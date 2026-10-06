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
	Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
	ConsoleError,
	ConsoleLoading,
	ConsoleSummary,
	SummaryMetric,
} from "@/components/shared/console-shell";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { api, type RouterOutputs } from "@/utils/api";

interface Props {
	serverId?: string;
	serverName: string;
	local?: boolean;
}type EngineInfo = RouterOutputs["docker"]["getEngineInfo"];

const serverQuery = (serverId?: string) =>
	serverId ? `?serverId=${encodeURIComponent(serverId)}` : "";

/**
 * One Docker Engine rendered as a table row. The row itself uses the shared
 * engine query; the full engine configuration lives in the detail dialog so the
 * fleet stays scannable.
 */
export function DockerEngineRow({
	serverId,
	serverName,
	local = false,
}: Props) {
	const [open, setOpen] = useState(false);
	const query = api.docker.getEngineInfo.useQuery(
		{ serverId },
		{
			refetchInterval: 60_000,
			refetchOnWindowFocus: false,
			retry: false,
		},
	);
	const { data, isPending, isError, error, refetch, isFetching } = query;

	const connected = !isPending && !isError;
	const endpoint = data?.engine.hostname ?? (local ? "Local socket" : "—");

	return (
		<TableRow>
			<TableCell>
				<div className="flex flex-wrap items-center gap-2">
					<Blocks className="size-4 text-muted-foreground" aria-hidden />
					<span className="font-medium">{serverName}</span>
					{local && <Badge variant="outline">Local</Badge>}
					{isPending ? (
						<Badge variant="outline">Checking…</Badge>
					) : isError ? (
						<Badge variant="destructive" className="gap-1.5">
							<CircleAlert className="size-3.5" aria-hidden />
							Unavailable
						</Badge>
					) : (
						<Badge className="gap-1.5">
							<span
								className="size-1.5 rounded-full bg-green-500"
								aria-hidden
							/>
							Connected
						</Badge>
					)}
				</div>
				{connected && data.engine.operatingSystem && (
					<p className="mt-1 text-xs text-muted-foreground">
						{data.engine.operatingSystem}
						{data.engine.architecture ? ` · ${data.engine.architecture}` : ""}
					</p>
				)}
			</TableCell>
			<TableCell className="text-muted-foreground">{endpoint}</TableCell>
			<TableCell>
				{isPending ? "…" : isError ? "—" : (data.engine.version ?? "—")}
			</TableCell>
			<TableCell className="tabular-nums">
				{isPending
					? "…"
					: isError
						? "—"
						: `${data.capacity.running ?? 0} / ${data.capacity.containers ?? 0}`}
			</TableCell>
			<TableCell className="tabular-nums">
				{isPending ? "…" : isError ? "—" : (data.capacity.images ?? 0)}
			</TableCell>
			<TableCell>
				{isPending ? (
					<span className="text-muted-foreground">…</span>
				) : isError ? (
					<span className="text-muted-foreground">—</span>
				) : data.swarm.state ? (
					<Badge
						variant={data.swarm.state === "active" ? "green" : "secondary"}
					>
						{data.swarm.state === "active"
							? data.swarm.isManager
								? "Active · Manager"
								: "Active · Worker"
							: capitalize(data.swarm.state)}
					</Badge>
				) : (
					<span className="text-muted-foreground">Unavailable</span>
				)}
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end gap-1">
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
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button variant="outline" size="sm">
								Inspect
							</Button>
						</DialogTrigger>
						{open && (
							<DockerEngineDetails
								serverId={serverId}
								serverName={serverName}
								local={local}
								data={data}
								isPending={isPending}
								isError={isError}
								errorMessage={error?.message}
								onRetry={() => void refetch()}
							/>
						)}
					</Dialog>
				</div>
			</TableCell>
		</TableRow>
	);
}

function DockerEngineDetails({
	serverId,
	serverName,
	local,
	data,
	isPending,
	isError,
	errorMessage,
	onRetry,
}: {
	serverId?: string;
	serverName: string;
	local: boolean;
	data: EngineInfo | undefined;
	isPending: boolean;
	isError: boolean;
	errorMessage?: string;
	onRetry: () => void;
}) {
	const query = serverQuery(serverId);
	const links = [
		{ label: "Containers", href: `/dashboard/containers${query}`, icon: Boxes },
		{ label: "Images", href: `/dashboard/images${query}`, icon: Layers },
		{ label: "Networks", href: `/dashboard/networks${query}`, icon: Network },
		{ label: "Volumes", href: `/dashboard/volumes${query}`, icon: Database },
		{ label: "Events", href: `/dashboard/events${query}`, icon: Clock3 },
		{ label: "Health", href: `/dashboard/health${query}`, icon: Check },
		{ label: "Swarm", href: `/dashboard/swarm${query}`, icon: Waypoints },
	];

	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Blocks className="size-5 text-muted-foreground" aria-hidden />
					{serverName}
				</DialogTitle>
				<DialogDescription>
					Docker Engine connection, runtime configuration, and current capacity.
				</DialogDescription>
			</DialogHeader>

			{isPending ? (
				<ConsoleLoading label={`Checking Docker Engine on ${serverName}`} />
			) : isError || !data ? (
				<ConsoleError
					message={`Notploy cannot communicate with the Docker Engine: ${
						errorMessage ?? "unknown error"
					}`}
					onRetry={onRetry}
				/>
			) : (
				<div className="space-y-5">
					<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						{local && <Badge variant="outline">Local</Badge>}
						<span className="flex items-center gap-1.5">
							<Clock3 className="size-3.5" aria-hidden />
							Checked{" "}
							{formatDistanceToNow(new Date(data.checkedAt), {
								addSuffix: true,
							})}
						</span>
					</div>

					<ConsoleSummary>
						<SummaryMetric
							label="Docker version"
							value={data.engine.version ?? "Unavailable"}
							detail={
								data.engine.apiVersion
									? `API ${data.engine.apiVersion}`
									: undefined
							}
						/>
						<SummaryMetric
							label="Storage driver"
							value={data.engine.storageDriver ?? "Unavailable"}
							detail={`Logging: ${data.engine.loggingDriver ?? "Unavailable"}`}
						/>
						<SummaryMetric
							label="Kernel"
							value={data.engine.kernelVersion ?? "Unavailable"}
							detail={`Cgroup: ${data.engine.cgroupDriver ?? "Unavailable"}`}
						/>
						<SummaryMetric
							label="Default runtime"
							value={data.engine.defaultRuntime ?? "Unavailable"}
							detail={data.engine.dockerRootDir ?? undefined}
						/>
					</ConsoleSummary>

					<ConsoleSummary>
						<SummaryMetric
							label="Containers"
							value={data.capacity.containers ?? 0}
							detail={`${data.capacity.running ?? 0} running`}
						/>
						<SummaryMetric
							label="Paused"
							value={data.capacity.paused ?? 0}
							detail={`${data.capacity.stopped ?? 0} stopped`}
						/>
						<SummaryMetric label="Images" value={data.capacity.images ?? 0} />
						<SummaryMetric
							label="Networks & volumes"
							value={`${data.capacity.networks ?? 0} / ${data.capacity.volumes ?? 0}`}
						/>
					</ConsoleSummary>

					<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Docker Swarm</p>
							<p className="text-sm text-muted-foreground">
								{data.swarm.state
									? data.swarm.state === "active"
										? `Active · ${data.swarm.isManager ? "Manager" : "Worker"}`
										: capitalize(data.swarm.state)
									: "State unavailable"}
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href={`/dashboard/swarm${query}`}>View Swarm</Link>
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
			)}
		</DialogContent>
	);
}

function capitalize(value: string) {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
