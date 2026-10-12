import { CircleSlash, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleShell,
} from "@/components/shared/console-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/utils/api";
import {
	TrafficSectionLoading,
	type TrafficSectionState,
} from "./section-state";
import { TrafficAudiencePanel } from "./traffic-audience-panel";
import { TrafficFilters } from "./traffic-filters";
import { TrafficHttpPanel } from "./traffic-http-panel";
import { TrafficMetricCard } from "./traffic-metric-card";
import { TrafficSourcesPanel } from "./traffic-sources-panel";
import { TrafficTimeseriesChart } from "./traffic-timeseries-chart";
import {
	DEFAULT_TRAFFIC_FILTERS,
	formatBytes,
	formatCount,
	formatDateTime,
	formatMilliseconds,
	formatPercent,
	type TrafficFilterState,
	toFilterInput,
	toRangeInput,
} from "./traffic-types";

/**
 * Traffic Manager.
 *
 * One page, two complementary readings of the same properties:
 *
 * - **HTTP observability** — what the reverse proxy actually answered (requests,
 *   status classes, routes, latency, bandwidth);
 * - **Audience analytics** — what the web instrumentation measured (page views,
 *   sessions, estimated visitors, referrers, devices).
 *
 * They are shown side by side but never merged: the numbers come from different
 * collectors, and a page view is not a request. Each section also carries its own
 * state, so an unreachable collector degrades one panel instead of the page.
 */
export const TrafficManager = () => {
	const [filters, setFilters] = useState<TrafficFilterState>(
		DEFAULT_TRAFFIC_FILTERS,
	);
	const utils = api.useUtils();

	const propertiesQuery = api.traffic.properties.useQuery();
	const properties = propertiesQuery.data?.properties ?? [];

	const rangeInput = toRangeInput(filters);
	const filterInput = toFilterInput(filters);
	const customRangeReady =
		filters.preset !== "custom" || (!!filters.from && !!filters.to);
	const sharedInput = { ...rangeInput, ...filterInput };

	const overview = api.traffic.overview.useQuery(
		{ ...sharedInput, compare: filters.compare },
		{ enabled: customRangeReady, refetchInterval: 60_000 },
	);
	const timeseries = api.traffic.timeseries.useQuery(sharedInput, {
		enabled: customRangeReady,
		refetchInterval: 60_000,
	});
	const http = api.traffic.http.useQuery(sharedInput, {
		enabled: customRangeReady,
	});
	const audience = api.traffic.audience.useQuery(sharedInput, {
		enabled: customRangeReady,
	});

	const permissionsError = [
		overview.error,
		timeseries.error,
		http.error,
		audience.error,
		propertiesQuery.error,
	].find(
		(error) =>
			error?.data?.code === "FORBIDDEN" || error?.data?.code === "UNAUTHORIZED",
	);
	const otherError = [
		overview.error,
		timeseries.error,
		http.error,
		audience.error,
		propertiesQuery.error,
	].find(
		(error) =>
			error &&
			error.data?.code !== "FORBIDDEN" &&
			error.data?.code !== "UNAUTHORIZED",
	);

	const isRefetching =
		overview.isFetching ||
		timeseries.isFetching ||
		http.isFetching ||
		audience.isFetching ||
		propertiesQuery.isFetching;

	const refreshAll = () => {
		void utils.traffic.invalidate();
	};

	const httpState: TrafficSectionState =
		overview.data?.http.availability.state ?? "no-data";
	const audienceState: TrafficSectionState =
		overview.data?.audience.availability.state ?? "no-data";
	const httpHasData = httpState === "ok" || httpState === "partial";
	const audienceHasData = audienceState === "ok" || audienceState === "partial";

	const resolutionNote = useMemo(() => {
		if (!overview.data) {
			return "";
		}
		const seconds =
			timeseries.data?.intervalSeconds ?? overview.data.range.intervalSeconds;
		const human =
			seconds % 3600 === 0
				? `${seconds / 3600} h`
				: seconds % 60 === 0
					? `${seconds / 60} min`
					: `${seconds} s`;
		return `Resolution: ${human} per point. HTTP observability is collected from the reverse proxy access log; audience analytics from the web instrumentation. Buckets without data are left empty.`;
	}, [overview.data, timeseries.data]);

	if (permissionsError) {
		return (
			<ConsoleShell>
				<ConsoleHeader
					icon={TrendingUp}
					title="Traffic Manager"
					description="HTTP observability and audience analytics for the SGE platforms."
				/>
				<ConsoleBody>
					<ConsoleEmpty
						icon={CircleSlash}
						title="Access denied"
						description="This account is not allowed to read the traffic reports. Ask an administrator for the traffic read permission."
					/>
				</ConsoleBody>
			</ConsoleShell>
		);
	}

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={TrendingUp}
				title="Traffic Manager"
				description="Traffic actually received by the SGE platforms, and the audience of their sites."
				status={
					overview.data ? (
						<p className="text-xs text-muted-foreground">
							Period: {formatDateTime(overview.data.range.from)} →{" "}
							{formatDateTime(overview.data.range.to)} · Last reception:{" "}
							{formatDateTime(overview.data.lastEventAt)}
						</p>
					) : null
				}
			/>
			<ConsoleBody>
				<TrafficFilters
					filters={filters}
					properties={properties}
					onChange={setFilters}
					onRefresh={refreshAll}
					isRefetching={isRefetching}
					lastEventAt={overview.data?.lastEventAt ?? null}
					lastUpdatedAt={overview.data?.generatedAt ?? null}
				/>

				{filters.preset === "custom" && !customRangeReady && (
					<ConsoleEmpty
						icon={TrendingUp}
						title="Pick a custom period"
						description="Both the start and the end of the custom range are required before the queries run."
					/>
				)}

				{otherError && customRangeReady && (
					<ConsoleError
						message={
							otherError.message ||
							"Unable to load the traffic reports from the Notploy API."
						}
						onRetry={refreshAll}
					/>
				)}

				{!customRangeReady ? null : overview.isLoading ? (
					<TrafficSectionLoading label="Loading the traffic summary" />
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<TrafficMetricCard
								label="HTTP requests"
								value={
									httpHasData ? formatCount(overview.data?.http.requests) : "—"
								}
								state={httpState}
								stateReasons={overview.data?.http.availability.reasons}
								comparison={
									filters.compare
										? {
												current: overview.data?.http.requests ?? 0,
												previous:
													overview.data?.previous.http?.requests ?? null,
											}
										: undefined
								}
								detail="Requests answered by the reverse proxy on this period"
							/>
							<TrafficMetricCard
								label="Estimated visitors"
								value={
									audienceHasData
										? formatCount(overview.data?.audience.visitors)
										: "—"
								}
								state={audienceState}
								stateReasons={overview.data?.audience.availability.reasons}
								comparison={
									filters.compare
										? {
												current: overview.data?.audience.visitors ?? 0,
												previous:
													overview.data?.previous.audience?.visitors ?? null,
											}
										: undefined
								}
								approximation="Distinct visitor identifiers seen in the browser during the period."
							/>
							<TrafficMetricCard
								label="Page views"
								value={
									audienceHasData
										? formatCount(overview.data?.audience.pageviews)
										: "—"
								}
								state={audienceState}
								stateReasons={overview.data?.audience.availability.reasons}
								comparison={
									filters.compare
										? {
												current: overview.data?.audience.pageviews ?? 0,
												previous:
													overview.data?.previous.audience?.pageviews ?? null,
											}
										: undefined
								}
								detail="Recorded by the web instrumentation"
							/>
							<TrafficMetricCard
								label="Sessions"
								value={
									audienceHasData
										? formatCount(overview.data?.audience.sessions)
										: "—"
								}
								state={audienceState}
								stateReasons={overview.data?.audience.availability.reasons}
								comparison={
									filters.compare
										? {
												current: overview.data?.audience.sessions ?? 0,
												previous:
													overview.data?.previous.audience?.sessions ?? null,
											}
										: undefined
								}
								detail="Session identifiers, 30 minutes of inactivity"
							/>
							<TrafficMetricCard
								label="HTTP error rate"
								value={
									httpHasData
										? formatPercent(overview.data?.http.errorRate)
										: "—"
								}
								state={httpState}
								stateReasons={overview.data?.http.availability.reasons}
								detail="4xx and 5xx responses over all responses"
							/>
							<TrafficMetricCard
								label="Latency p95"
								value={
									httpHasData
										? formatMilliseconds(overview.data?.http.p95Ms)
										: "—"
								}
								state={httpHasData ? "ok" : httpState}
								stateReasons={
									httpHasData && overview.data?.http.p95Ms === null
										? ["No latency sample was stored on this period."]
										: overview.data?.http.availability.reasons
								}
								approximation="Approximated from the stored latency histogram."
							/>
							<TrafficMetricCard
								label="Bandwidth"
								value={
									httpHasData ? formatBytes(overview.data?.http.bytesOut) : "—"
								}
								state={httpState}
								stateReasons={overview.data?.http.availability.reasons}
								detail={`${httpHasData ? formatBytes(overview.data?.http.bytesIn) : "—"} transferred in`}
							/>
						</div>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">
									Traffic and audience
								</CardTitle>
							</CardHeader>
							<CardContent>
								{overview.data ? (
									<TrafficTimeseriesChart
										points={timeseries.data?.points ?? []}
										intervalSeconds={
											timeseries.data?.intervalSeconds ??
											overview.data.range.intervalSeconds
										}
										from={overview.data.range.from}
										to={overview.data.range.to}
										audienceAvailable={audienceHasData}
										resolutionNote={resolutionNote}
									/>
								) : null}
							</CardContent>
						</Card>

						<Tabs defaultValue="http" className="gap-4">
							<TabsList>
								<TabsTrigger value="http">HTTP observability</TabsTrigger>
								<TabsTrigger value="audience">Audience analytics</TabsTrigger>
								<TabsTrigger value="sources">
									Platforms &amp; sources
								</TabsTrigger>
							</TabsList>
							<TabsContent value="http">
								<TrafficHttpPanel
									data={http.data}
									isLoading={http.isLoading}
									state={httpState}
									reasons={overview.data?.http.availability.reasons ?? []}
									summary={{
										requests: overview.data?.http.requests ?? 0,
										errors: overview.data?.http.errors ?? 0,
										errorRate: overview.data?.http.errorRate ?? null,
										bytesIn: overview.data?.http.bytesIn ?? 0,
										bytesOut: overview.data?.http.bytesOut ?? 0,
										p95Ms: overview.data?.http.p95Ms ?? null,
										avgMs: overview.data?.http.avgMs ?? null,
										maxMs: overview.data?.http.maxMs ?? null,
										latencySamples: overview.data?.http.latencySamples ?? 0,
										latencyApproximated:
											overview.data?.http.latencyApproximated ?? true,
									}}
								/>
							</TabsContent>
							<TabsContent value="audience">
								<TrafficAudiencePanel
									data={audience.data}
									isLoading={audience.isLoading}
									state={audienceState}
									reasons={overview.data?.audience.availability.reasons ?? []}
								/>
							</TabsContent>
							<TabsContent value="sources">
								<TrafficSourcesPanel
									health={propertiesQuery.data?.health ?? []}
									hasProperties={properties.length > 0}
									isLoading={propertiesQuery.isLoading}
									retention={
										overview.data?.retention ?? {
											httpDays: 0,
											audienceDays: 0,
										}
									}
									collectorCron={
										process.env.NEXT_PUBLIC_TRAFFIC_COLLECTOR_CRON ??
										"*/5 * * * *"
									}
								/>
							</TabsContent>
						</Tabs>
					</>
				)}
			</ConsoleBody>
		</ConsoleShell>
	);
};
