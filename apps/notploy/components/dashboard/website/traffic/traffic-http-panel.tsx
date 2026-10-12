import { Info } from "lucide-react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	TrafficSectionEmpty,
	TrafficSectionLoading,
	TrafficSectionNotice,
	type TrafficSectionState,
} from "./section-state";
import {
	formatBytes,
	formatCount,
	formatMilliseconds,
	formatPercent,
} from "./traffic-types";

export interface HttpStatusBreakdownRow {
	statusClass: string;
	requests: number;
	share: number;
}

export interface HttpRouteRow {
	route: string;
	requests: number;
	errors: number;
	errorRate: number | null;
	bytesOut: number;
	avgMs: number | null;
	maxMs: number | null;
}

export interface HttpDomainRow {
	propertyId: string;
	platform: string;
	domain: string;
	requests: number;
	errors: number;
	bytesIn: number;
	bytesOut: number;
}

export interface HttpReportData {
	statusBreakdown: HttpStatusBreakdownRow[];
	domains: HttpDomainRow[];
	topRoutes: HttpRouteRow[];
	topErrorRoutes: HttpRouteRow[];
	unavailable: { metric: string; reason: string }[];
}

interface TrafficHttpPanelProps {
	data: HttpReportData | undefined;
	isLoading: boolean;
	state: TrafficSectionState;
	reasons: string[];
	actions?: React.ReactNode;
	summary: {
		requests: number;
		errors: number;
		errorRate: number | null;
		bytesIn: number;
		bytesOut: number;
		p95Ms: number | null;
		avgMs: number | null;
		maxMs: number | null;
		latencySamples: number;
		latencyApproximated: boolean;
	};
}

const STATUS_CLASS_LABELS: Record<string, string> = {
	"2xx": "2xx — success",
	"3xx": "3xx — redirect",
	"4xx": "4xx — client error",
	"5xx": "5xx — server error",
	other: "Other (1xx / no response)",
};

/**
 * HTTP observability panel.
 *
 * Everything here comes from the reverse proxy access log: no request body, no
 * header and no address was ever stored. Metrics a log cannot provide (cache
 * status, geolocation) are listed as unavailable instead of being approximated.
 */
export const TrafficHttpPanel = ({
	data,
	isLoading,
	state,
	reasons,
	actions,
	summary,
}: TrafficHttpPanelProps) => {
	if (isLoading) {
		return <TrafficSectionLoading label="Loading HTTP observability" />;
	}

	const hasRows =
		!!data &&
		(data.statusBreakdown.length > 0 ||
			data.topRoutes.length > 0 ||
			data.domains.length > 0);

	return (
		<div className="space-y-4">
			<TrafficSectionNotice state={state} reasons={reasons} actions={actions} />

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<MetricTile
					label="p95 latency"
					value={formatMilliseconds(summary.p95Ms)}
					detail={
						summary.latencySamples > 0
							? `${formatCount(summary.latencySamples)} samples${
									summary.latencyApproximated ? " · approximate" : ""
								}`
							: "No latency sample on this period"
					}
				/>
				<MetricTile
					label="Average latency"
					value={formatMilliseconds(summary.avgMs)}
					detail="Mean of the stored durations"
				/>
				<MetricTile
					label="Max latency"
					value={formatMilliseconds(summary.maxMs)}
					detail="Highest duration observed"
				/>
				<MetricTile
					label="Bandwidth"
					value={`${formatBytes(summary.bytesOut)} out`}
					detail={`${formatBytes(summary.bytesIn)} in · body sizes reported by the proxy`}
				/>
			</div>

			{!hasRows ? (
				<TrafficSectionEmpty
					title="No HTTP data on this period"
					state={state === "ok" ? "no-data" : state}
					reasons={reasons}
				/>
			) : (
				<>
					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Status classes</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{data?.statusBreakdown.length === 0 && (
									<p className="text-sm text-muted-foreground">
										No response was recorded on this period.
									</p>
								)}
								{data?.statusBreakdown.map((row) => (
									<div key={row.statusClass} className="space-y-1">
										<div className="flex items-center justify-between text-sm">
											<span>
												{STATUS_CLASS_LABELS[row.statusClass] ??
													row.statusClass}
											</span>
											<span className="tabular-nums">
												{formatCount(row.requests)} · {formatPercent(row.share)}
											</span>
										</div>
										<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
											<div
												className={`h-full rounded-full ${
													row.statusClass === "5xx"
														? "bg-red-500"
														: row.statusClass === "4xx"
															? "bg-orange-500"
															: row.statusClass === "3xx"
																? "bg-blue-500"
																: "bg-emerald-500"
												}`}
												style={{
													width: `${Math.max(1, Math.min(100, row.share))}%`,
												}}
											/>
										</div>
									</div>
								))}
								<p className="text-xs text-muted-foreground">
									Error rate counts 4xx and 5xx responses:{" "}
									{formatPercent(summary.errorRate)} (
									{formatCount(summary.errors)} of{" "}
									{formatCount(summary.requests)} requests).
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">Traffic by domain</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Domain</TableHead>
											<TableHead className="text-right">Requests</TableHead>
											<TableHead className="text-right">Errors</TableHead>
											<TableHead className="text-right">Out</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data?.domains.map((row) => (
											<TableRow key={row.propertyId}>
												<TableCell>
													<div className="flex flex-col">
														<span>{row.domain}</span>
														<span className="text-xs text-muted-foreground">
															{row.platform}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatCount(row.requests)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatCount(row.errors)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatBytes(row.bytesOut)}
												</TableCell>
											</TableRow>
										))}
										{data?.domains.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={4}
													className="text-sm text-muted-foreground"
												>
													No domain received traffic on this period.
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<RouteTable
							title="Busiest routes"
							rows={data?.topRoutes ?? []}
							emptyLabel="No route was requested on this period."
						/>
						<RouteTable
							title="Routes with the most errors"
							rows={data?.topErrorRoutes ?? []}
							emptyLabel="No route returned an error on this period."
							highlightErrors
						/>
					</div>
				</>
			)}

			{(data?.unavailable.length ?? 0) > 0 && (
				<AlertBlock type="info">
					<span className="font-medium">Not measurable with this source.</span>{" "}
					{data?.unavailable.map((entry) => (
						<span key={entry.metric} className="block">
							{entry.metric}: {entry.reason}
						</span>
					))}
				</AlertBlock>
			)}
		</div>
	);
};

const MetricTile = ({
	label,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail?: string;
}) => (
	<div className="rounded-md border px-4 py-3">
		<p className="text-sm text-muted-foreground">{label}</p>
		<p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
		{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
	</div>
);

const RouteTable = ({
	title,
	rows,
	emptyLabel,
	highlightErrors = false,
}: {
	title: string;
	rows: HttpRouteRow[];
	emptyLabel: string;
	highlightErrors?: boolean;
}) => (
	<Card>
		<CardHeader className="flex-row items-center justify-between">
			<CardTitle className="text-base">{title}</CardTitle>
			{highlightErrors && (
				<Badge variant="outline" className="gap-1 text-[11px]">
					<Info className="size-3" aria-hidden />
					4xx + 5xx
				</Badge>
			)}
		</CardHeader>
		<CardContent>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Route</TableHead>
						<TableHead className="text-right">Requests</TableHead>
						<TableHead className="text-right">Errors</TableHead>
						<TableHead className="text-right">Avg</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.route}>
							<TableCell className="max-w-[280px] truncate font-mono text-xs">
								{row.route}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatCount(row.requests)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatCount(row.errors)}
								{row.errorRate !== null && (
									<span className="ml-1 text-xs text-muted-foreground">
										({formatPercent(row.errorRate, 0)})
									</span>
								)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatMilliseconds(row.avgMs)}
							</TableCell>
						</TableRow>
					))}
					{rows.length === 0 && (
						<TableRow>
							<TableCell colSpan={4} className="text-sm text-muted-foreground">
								{emptyLabel}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</CardContent>
	</Card>
);
