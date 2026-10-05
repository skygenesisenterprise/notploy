"use client";

import { Blocks, Server as ServerIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { DockerEngineOverview } from "@/components/dashboard/docker/docker-engine-overview";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleRefresh,
	ConsoleShell,
	ConsoleSummary,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

export const DockerConsole = () => {
	const router = useRouter();
	const apiUtils = api.useUtils();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { data: permissions } = api.user.getPermissions.useQuery();
	const serversQuery = api.server.withSSHKey.useQuery();
	const cloudQuery = api.settings.isCloud.useQuery();
	const servers = serversQuery.data;
	const isCloud = cloudQuery.data;

	const requestedServerId =
		typeof router.query.serverId === "string"
			? router.query.serverId
			: undefined;
	const selectedServer = servers?.find(
		(server) => server.serverId === requestedServerId,
	);
	const targetCount = (servers?.length ?? 0) + Number(isCloud === false);
	const selectedTarget =
		requestedServerId === "local"
			? "local"
			: (selectedServer?.serverId ??
				(targetCount === 1
					? isCloud === false
						? "local"
						: (servers?.[0]?.serverId ?? "all")
					: "all"));

	const setServer = (value: string) => {
		const { serverId: _serverId, ...query } = router.query;
		void router.replace(
			{
				pathname: router.pathname,
				query: value === "all" ? query : { ...query, serverId: value },
			},
			undefined,
			{ shallow: true },
		);
	};

	const refreshEngines = async () => {
		setIsRefreshing(true);
		try {
			if (selectedTarget === "all") {
				await apiUtils.docker.getEngineInfo.invalidate();
			} else {
				await apiUtils.docker.getEngineInfo.invalidate({
					serverId: selectedTarget === "local" ? undefined : selectedTarget,
				});
			}
		} finally {
			setIsRefreshing(false);
		}
	};

	const isLoading = serversQuery.isPending || cloudQuery.isPending;
	const isError = serversQuery.isError || cloudQuery.isError;
	const errorMessage = serversQuery.error?.message ?? cloudQuery.error?.message;
	const canCreateServer = !!permissions?.server.create;

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={Blocks}
				title="Docker"
				description="Docker Engine runtime and configuration across your infrastructure."
				actions={
					<>
						{!isLoading && targetCount > 1 && (
							<Select value={selectedTarget} onValueChange={setServer}>
								<SelectTrigger
									className="w-full min-w-48 sm:w-auto"
									aria-label="Filter by Docker engine"
								>
									<ServerIcon
										className="size-4 text-muted-foreground"
										aria-hidden
									/>
									<SelectValue placeholder="Select server" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All engines</SelectItem>
									{isCloud === false && (
										<SelectItem value="local">
											Notploy instance (Local)
										</SelectItem>
									)}
									{servers?.map((server) => (
										<SelectItem key={server.serverId} value={server.serverId}>
											{server.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						<ConsoleRefresh
							onClick={() => void refreshEngines()}
							isRefetching={isRefreshing}
							disabled={isLoading}
						/>
					</>
				}
			/>

			<ConsoleBody>
				{isLoading ? (
					<ConsoleLoading label="Loading Docker engines…" />
				) : isError ? (
					<ConsoleError
						message={errorMessage ?? "Could not load Docker engines."}
						onRetry={() => {
							void serversQuery.refetch();
							void cloudQuery.refetch();
						}}
					/>
				) : targetCount === 0 ? (
					<ConsoleEmpty
						icon={ServerIcon}
						title="No Docker Engine available"
						description="Add a server to connect Notploy to a Docker Engine."
					>
						{canCreateServer && (
							<Button asChild>
								<Link href="/dashboard/settings/servers">Add server</Link>
							</Button>
						)}
					</ConsoleEmpty>
				) : (
					<>
						<ConsoleSummary>
							<SummaryMetric label="Engines" value={targetCount} />
							<SummaryMetric
								label="Remote engines"
								value={servers?.length ?? 0}
								detail={
									isCloud === false
										? "Includes the local Notploy engine"
										: "All engines are remote"
								}
							/>
							<SummaryMetric
								label="Notploy instance"
								value={isCloud === false ? "Local" : "Remote"}
								detail={
									isCloud === false
										? "Docker socket of this instance"
										: "No local engine on cloud"
								}
							/>
							<SummaryMetric
								label="Selected target"
								value={
									selectedTarget === "all"
										? "All engines"
										: selectedTarget === "local"
											? "Notploy instance"
											: (selectedServer?.name ?? "Docker Engine")
								}
								detail={
									selectedTarget === "all"
										? "Overview of every configured engine"
										: "Overview of a single engine"
								}
							/>
						</ConsoleSummary>

						<section className="space-y-3" aria-label="Docker engines">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<h2 className="text-lg font-semibold">Overview</h2>
									<p className="text-sm text-muted-foreground">
										Docker Engine connection, runtime configuration, and current
										capacity across your infrastructure.
									</p>
								</div>
								<p className="text-sm text-muted-foreground">
									{targetCount} engine{targetCount === 1 ? "" : "s"} configured
								</p>
							</div>
							<div className="space-y-3">
								{selectedTarget === "all" ? (
									<>
										{isCloud === false && (
											<DockerEngineOverview
												serverName="Notploy instance"
												local
											/>
										)}
										{servers?.map((server) => (
											<DockerEngineOverview
												key={server.serverId}
												serverId={server.serverId}
												serverName={server.name}
											/>
										))}
									</>
								) : (
									<DockerEngineOverview
										serverId={
											selectedTarget === "local" ? undefined : selectedTarget
										}
										serverName={
											selectedTarget === "local"
												? "Notploy instance"
												: (selectedServer?.name ?? "Docker Engine")
										}
										local={selectedTarget === "local"}
									/>
								)}
							</div>
						</section>
					</>
				)}
			</ConsoleBody>
		</ConsoleShell>
	);
};
