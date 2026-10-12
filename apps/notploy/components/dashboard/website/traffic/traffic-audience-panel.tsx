import { AlertBlock } from "@/components/shared/alert-block";
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
import { formatCount, formatPercent } from "./traffic-types";

export interface AudienceReportData {
	topPages: { path: string; pageviews: number }[];
	referrers: { referrerHost: string; pageviews: number }[];
	devices: { deviceType: string; pageviews: number; share: number }[];
	events: { name: string; count: number }[];
	methods: { metric: string; definition: string }[];
	unavailable: { metric: string; reason: string }[];
}

interface TrafficAudiencePanelProps {
	data: AudienceReportData | undefined;
	isLoading: boolean;
	state: TrafficSectionState;
	reasons: string[];
	actions?: React.ReactNode;
}

const DEVICE_LABELS: Record<string, string> = {
	desktop: "Desktop",
	mobile: "Mobile",
	tablet: "Tablet",
	unknown: "Unknown / bots",
};

/**
 * Audience analytics panel.
 *
 * Only first-party measurements are shown: page views, sessions, estimated
 * visitors, referrer hosts, device categories and explicitly instrumented
 * events. Each number is defined under the tables, because "visitors" is an
 * estimate and saying so is part of reading it correctly.
 */
export const TrafficAudiencePanel = ({
	data,
	isLoading,
	state,
	reasons,
	actions,
}: TrafficAudiencePanelProps) => {
	if (isLoading) {
		return <TrafficSectionLoading label="Loading audience analytics" />;
	}

	const hasRows =
		!!data &&
		(data.topPages.length > 0 ||
			data.referrers.length > 0 ||
			data.devices.length > 0 ||
			data.events.length > 0);

	return (
		<div className="space-y-4">
			<TrafficSectionNotice state={state} reasons={reasons} actions={actions} />

			{!hasRows ? (
				<TrafficSectionEmpty
					title="No audience data on this period"
					state={state === "ok" ? "no-data" : state}
					reasons={reasons}
				/>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Most viewed pages</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Page</TableHead>
										<TableHead className="text-right">Page views</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data?.topPages.map((row) => (
										<TableRow key={row.path}>
											<TableCell className="max-w-[280px] truncate font-mono text-xs">
												{row.path}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatCount(row.pageviews)}
											</TableCell>
										</TableRow>
									))}
									{data?.topPages.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={2}
												className="text-sm text-muted-foreground"
											>
												No page view was recorded on this period.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Traffic sources</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Referrer</TableHead>
										<TableHead className="text-right">Page views</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data?.referrers.map((row) => (
										<TableRow key={row.referrerHost || "direct"}>
											<TableCell className="max-w-[280px] truncate text-xs">
												{row.referrerHost || "Direct / internal"}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatCount(row.pageviews)}
											</TableCell>
										</TableRow>
									))}
									{data?.referrers.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={2}
												className="text-sm text-muted-foreground"
											>
												No referrer was recorded on this period.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Device categories</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{data?.devices.length === 0 && (
								<p className="text-sm text-muted-foreground">
									No device category was measured on this period.
								</p>
							)}
							{data?.devices.map((row) => (
								<div key={row.deviceType} className="space-y-1">
									<div className="flex items-center justify-between text-sm">
										<span>
											{DEVICE_LABELS[row.deviceType] ?? row.deviceType}
										</span>
										<span className="tabular-nums">
											{formatCount(row.pageviews)} · {formatPercent(row.share)}
										</span>
									</div>
									<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-[var(--chart-2)]"
											style={{
												width: `${Math.max(1, Math.min(100, row.share))}%`,
											}}
										/>
									</div>
								</div>
							))}
							<p className="text-xs text-muted-foreground">
								The device category is derived on the server from the ingest
								request; the user agent string itself is never stored.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Instrumented events</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event</TableHead>
										<TableHead className="text-right">Count</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data?.events.map((row) => (
										<TableRow key={row.name}>
											<TableCell className="font-mono text-xs">
												{row.name}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatCount(row.count)}
											</TableCell>
										</TableRow>
									))}
									{data?.events.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={2}
												className="text-sm text-muted-foreground"
											>
												No explicit event was tracked on this period. Call
												window.notployTraffic.track("event_name") from the site
												to instrument one.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			)}

			<AlertBlock type="info">
				<span className="font-medium">How these numbers are produced.</span>
				{data?.methods.map((entry) => (
					<span key={entry.metric} className="block">
						{entry.metric}: {entry.definition}
					</span>
				))}
				{data?.unavailable.map((entry) => (
					<span key={entry.metric} className="block">
						{entry.metric}: {entry.reason}
					</span>
				))}
			</AlertBlock>
		</div>
	);
};
