import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { Blocks, Loader2, RefreshCw, Server as ServerIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { DockerEngineOverview } from "@/components/dashboard/docker/docker-engine-overview";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

const Dashboard = () => {
	const router = useRouter();
	const apiUtils = api.useUtils();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { data: permissions } = api.user.getPermissions.useQuery();
	const serversQuery = api.server.withSSHKey.useQuery();
	const cloudQuery = api.settings.isCloud.useQuery();
	const servers = serversQuery.data;
	const isCloud = cloudQuery.data;

	const requestedServerId =
		typeof router.query.serverId === "string" ? router.query.serverId : undefined;
	const selectedServer = servers?.find(
		(server) => server.serverId === requestedServerId,
	);
	const targetCount = (servers?.length ?? 0) + Number(isCloud === false);
	const selectedTarget =
		requestedServerId === "local"
			? "local"
			: selectedServer?.serverId ??
				(targetCount === 1
					? isCloud === false
						? "local"
						: (servers?.[0]?.serverId ?? "all")
					: "all");

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
	const errorMessage =
		serversQuery.error?.message ?? cloudQuery.error?.message;

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
				<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
					<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
								<Blocks className="size-6 text-muted-foreground" aria-hidden />
								Docker
							</h1>
							<p className="text-sm text-muted-foreground">
								Docker Engine runtime and configuration across your
								infrastructure.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{!isLoading && targetCount > 1 && (
								<Select value={selectedTarget} onValueChange={setServer}>
									<SelectTrigger className="w-full min-w-48 sm:w-auto">
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
						</div>
					</header>

					{isLoading ? (
						<div
							className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
							role="status"
						>
							Loading Docker engines…
							<Loader2 className="size-4 animate-spin" aria-hidden />
						</div>
					) : isError ? (
						<AlertBlock type="error">
							{errorMessage ?? "Could not load Docker engines."}
						</AlertBlock>
					) : targetCount === 0 ? (
						<Card>
							<div className="flex min-h-[35vh] flex-col items-center justify-center gap-3 border border-dashed p-8 text-center">
								<ServerIcon
									className="size-8 text-muted-foreground"
									aria-hidden
								/>
								<div className="space-y-1">
									<p className="font-medium">No Docker Engine available</p>
									<p className="max-w-lg text-sm text-muted-foreground">
										Add a server to connect Notploy to a Docker Engine.
									</p>
								</div>
								{permissions?.server.create && (
									<Button asChild>
										<Link href="/dashboard/settings/servers">Add server</Link>
									</Button>
								)}
							</div>
						</Card>
					) : (
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
					)}
				</div>
			</Card>
		);
	};

export default Dashboard;

Dashboard.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}
	const { req, res } = ctx;

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: req as any,
			res: res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});
	try {
		await helpers.project.all.prefetch();

		const userPermissions = await helpers.user.getPermissions.fetch();

		if (!userPermissions?.docker.read) {
			return {
				redirect: {
					permanent: true,
					destination: "/",
				},
			};
		}
		return {
			props: {
				trpcState: helpers.dehydrate(),
			},
		};
	} catch {
		return {
			props: {},
		};
	}
}
