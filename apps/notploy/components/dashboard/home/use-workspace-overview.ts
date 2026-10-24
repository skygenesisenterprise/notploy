import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/utils/api";
import type { SourceState } from "./types";

/**
 * Workspace-scoped data every environment shares: permissions, project counts,
 * services, deployments and operational events.
 *
 * Every procedure below is scoped server-side to the active organisation (and
 * to the services the member may access), so the three compositions read the
 * same perimeter without any client-side filtering decision. Queries are only
 * enabled when the caller holds the matching permission: a missing permission
 * is reported as `restricted` by the builders, never as a failure.
 */

export type HomePermissions =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];
export type HomeStats = inferRouterOutputs<AppRouter>["project"]["homeStats"];
export type OverviewService =
	inferRouterOutputs<AppRouter>["overview"]["services"][number];
export type HomeActivity =
	inferRouterOutputs<AppRouter>["deployment"]["homeActivity"];
export type HomeDeployment = HomeActivity["recent"][number];
export type HomeServer = inferRouterOutputs<AppRouter>["server"]["all"][number];
export type OperationalEvent =
	inferRouterOutputs<AppRouter>["operationalEvent"]["list"]["recent"][number];
export type HomeUsage = inferRouterOutputs<AppRouter>["stripe"]["getUsage"];

const REFRESH_INTERVAL = 60_000;

const noData: SourceState = { isLoading: false, isError: false };

export const useWorkspaceOverview = ({
	includeServers = false,
}: {
	includeServers?: boolean;
} = {}) => {
	const permissionsQuery = api.user.getPermissions.useQuery();
	const permissions = permissionsQuery.data;
	const canReadServices = !!permissions?.service.read;
	const canReadDeployments = !!permissions?.deployment.read;
	const canReadServers = !!permissions?.server.read;

	const statsQuery = api.project.homeStats.useQuery();
	const servicesQuery = api.overview.services.useQuery(undefined, {
		enabled: canReadServices,
		refetchInterval: REFRESH_INTERVAL,
	});
	const deploymentsQuery = api.deployment.homeActivity.useQuery(undefined, {
		enabled: canReadDeployments,
		refetchInterval: REFRESH_INTERVAL,
	});
	const serversQuery = api.server.all.useQuery(undefined, {
		enabled: includeServers && canReadServers,
	});
	const eventsQuery = api.operationalEvent.list.useQuery(undefined, {
		refetchInterval: REFRESH_INTERVAL,
	});

	const permissionsState: SourceState = {
		isLoading: permissionsQuery.isLoading,
		isError: permissionsQuery.isError,
	};

	// Newest successful read across every source this hook owns. The console
	// home shows it so its "last updated" label describes real data.
	const lastUpdatedAt = Math.max(
		permissionsQuery.dataUpdatedAt,
		statsQuery.dataUpdatedAt,
		servicesQuery.dataUpdatedAt,
		deploymentsQuery.dataUpdatedAt,
		serversQuery.dataUpdatedAt,
		eventsQuery.dataUpdatedAt,
	);

	return {
		lastUpdatedAt,
		permissions,
		permissionsState,
		canReadServices,
		canReadDeployments,
		canReadServers,
		stats: statsQuery.data,
		statsState: {
			isLoading: statsQuery.isLoading,
			isError: statsQuery.isError,
		} satisfies SourceState,
		services: servicesQuery.data ?? [],
		servicesState: canReadServices
			? {
					isLoading: servicesQuery.isLoading,
					isError: servicesQuery.isError,
				}
			: noData,
		activity: deploymentsQuery.data,
		activityState: canReadDeployments
			? {
					isLoading: deploymentsQuery.isLoading,
					isError: deploymentsQuery.isError,
				}
			: noData,
		servers: serversQuery.data ?? [],
		serversState:
			includeServers && canReadServers
				? {
						isLoading: serversQuery.isLoading,
						isError: serversQuery.isError,
					}
				: noData,
		events: eventsQuery.data,
		eventsState: {
			isLoading: eventsQuery.isLoading,
			isError: eventsQuery.isError,
		} satisfies SourceState,
	};
};
