import { useCallback, useState } from "react";
import { api } from "@/utils/api";
import { useWorkspaceOverview } from "../use-workspace-overview";

/**
 * Data contract of the Console home.
 *
 * Each source is only queried when the account holds the matching permission;
 * a missing permission is reported by the model as `restricted`, never as a
 * failed request. Platform-wide sources (status platform and control plane
 * probes) additionally require the operator role, checked client-side for the
 * call and server-side by the procedures themselves.
 */
export const useConsoleOverview = () => {
	const overview = useWorkspaceOverview({ includeServers: true });
	const { data: auth } = api.user.get.useQuery();
	const isOperator = auth?.role === "owner" || auth?.role === "admin";
	const permissions = overview.permissions;
	const canReadBackups =
		!!permissions?.backup?.read || !!permissions?.volumeBackup?.read;
	const canReadCertificates = !!permissions?.certificate?.read;
	const canReadMonitoring = !!permissions?.monitoring?.read;
	const canReadTraffic = !!permissions?.traffic?.read;

	const statusQuery = api.status.overview.useQuery(undefined, {
		enabled: isOperator,
		refetchInterval: 120_000,
	});
	const runtimeQuery = api.settings.getControlPlaneRuntime.useQuery(undefined, {
		enabled: isOperator,
	});
	const infrastructureQuery = api.settings.checkInfrastructureHealth.useQuery(
		undefined,
		{ enabled: isOperator, refetchInterval: 120_000 },
	);
	const backupsQuery = api.overview.backups.useQuery(undefined, {
		enabled: canReadBackups,
		refetchInterval: 120_000,
		refetchOnWindowFocus: false,
	});
	const certificatesQuery = api.certificates.all.useQuery(undefined, {
		enabled: canReadCertificates,
		refetchInterval: 120_000,
	});
	const monitoringQuery = api.server.getWorkspaceMetrics.useQuery(
		{ workspace: { type: "global" }, dataPoints: "1" },
		{
			enabled: canReadMonitoring,
			refetchInterval: 120_000,
			refetchOnWindowFocus: false,
		},
	);
	const trafficQuery = api.traffic.overview.useQuery(
		{ preset: "24h", compare: false },
		{ enabled: canReadTraffic, refetchInterval: 120_000 },
	);

	const utils = api.useUtils();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const refresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			// Refreshes every active query of the page, including the workspace
			// sources owned by `useWorkspaceOverview`.
			await utils.invalidate();
		} finally {
			setIsRefreshing(false);
		}
	}, [utils]);

	const lastUpdatedAt = Math.max(
		overview.lastUpdatedAt,
		statusQuery.dataUpdatedAt,
		runtimeQuery.dataUpdatedAt,
		infrastructureQuery.dataUpdatedAt,
		backupsQuery.dataUpdatedAt,
		certificatesQuery.dataUpdatedAt,
		monitoringQuery.dataUpdatedAt,
		trafficQuery.dataUpdatedAt,
	);

	return {
		...overview,
		isOperator,
		isRefreshing,
		lastUpdatedAt,
		refresh,
		canReadBackups,
		backups: backupsQuery.data,
		backupsState: backupsQuery.isLoading
			? { isLoading: true, isError: false }
			: { isLoading: false, isError: backupsQuery.isError },
		canReadCertificates,
		certificates: certificatesQuery.data,
		certificatesState: certificatesQuery.isLoading
			? { isLoading: true, isError: false }
			: { isLoading: false, isError: certificatesQuery.isError },
		canReadMonitoring,
		monitoring: monitoringQuery.data,
		monitoringState: monitoringQuery.isLoading
			? { isLoading: true, isError: false }
			: { isLoading: false, isError: monitoringQuery.isError },
		canReadTraffic,
		traffic: trafficQuery.data,
		trafficState: trafficQuery.isLoading
			? { isLoading: true, isError: false }
			: { isLoading: false, isError: trafficQuery.isError },
		status: statusQuery.data,
		statusState: {
			isLoading: isOperator && statusQuery.isLoading,
			isError: statusQuery.isError,
		},
		runtime: runtimeQuery.data,
		runtimeState: {
			isLoading: isOperator && runtimeQuery.isLoading,
			isError: runtimeQuery.isError,
		},
		infrastructure: infrastructureQuery.data,
		infrastructureState: {
			isLoading: isOperator && infrastructureQuery.isLoading,
			isError: infrastructureQuery.isError,
		},
	};
};
