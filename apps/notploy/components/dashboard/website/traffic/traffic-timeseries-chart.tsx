import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { buildBucketAxis, formatCount } from "./traffic-types";

export interface TrafficSeriesPoint {
	bucket: string;
	requests: number;
	errors: number;
	pageviews: number;
	sessions: number;
	visitors: number;
}

interface TrafficTimeseriesChartProps {
	points: TrafficSeriesPoint[];
	intervalSeconds: number;
	from: string;
	to: string;
	/** Audience panels are hidden when the instrumentation is not installed. */
	audienceAvailable: boolean;
	/** Note shown under the chart (resolution, retention). */
	resolutionNote: string;
}

type HttpSeriesKey = "requests" | "errors";
type AudienceSeriesKey = "pageviews" | "sessions" | "visitors";

const httpConfig = {
	requests: { label: "HTTP requests", color: "var(--chart-1)" },
	errors: { label: "4xx / 5xx", color: "var(--chart-5)" },
} satisfies ChartConfig;

const audienceConfig = {
	pageviews: { label: "Page views", color: "var(--chart-2)" },
	sessions: { label: "Sessions", color: "var(--chart-3)" },
	visitors: { label: "Estimated visitors", color: "var(--chart-4)" },
} satisfies ChartConfig;

const formatBucket = (value: number, spanHours: number) => {
	const date = new Date(value);
	if (spanHours <= 48) {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatBucketFull = (value: number) => {
	const date = new Date(value);
	return date.toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

/**
 * Main traffic chart.
 *
 * Two charts, not one: HTTP requests and audience page views are produced by
 * different collectors and are not the same measurement, so they never share an
 * axis. Each axis holds counts only, and every series can be toggled.
 */
export const TrafficTimeseriesChart = ({
	points,
	intervalSeconds,
	from,
	to,
	audienceAvailable,
	resolutionNote,
}: TrafficTimeseriesChartProps) => {
	const [httpSeries, setHttpSeries] = useState<Record<HttpSeriesKey, boolean>>({
		requests: true,
		errors: true,
	});
	const [audienceSeries, setAudienceSeries] = useState<
		Record<AudienceSeriesKey, boolean>
	>({ pageviews: true, sessions: true, visitors: false });

	const byBucket = new Map(points.map((point) => [point.bucket, point]));
	const axis = buildBucketAxis(from, to, intervalSeconds);
	const data = axis.map((bucketMs) => {
		const bucket = new Date(bucketMs).toISOString();
		const point = byBucket.get(bucket);
		return {
			bucket: bucketMs,
			requests: point?.requests ?? null,
			errors: point?.errors ?? null,
			pageviews: point?.pageviews ?? null,
			sessions: point?.sessions ?? null,
			visitors: point?.visitors ?? null,
		};
	});
	const spanHours =
		(new Date(to).getTime() - new Date(from).getTime()) / 3600000;

	const toggle =
		<T extends string>(
			setter: React.Dispatch<React.SetStateAction<Record<T, boolean>>>,
		) =>
		(key: T) =>
			setter((current) => ({ ...current, [key]: !current[key] }));

	const toggleHttp = toggle<HttpSeriesKey>(setHttpSeries);
	const toggleAudience = toggle<AudienceSeriesKey>(setAudienceSeries);

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-medium">HTTP requests over time</h3>
					<div className="flex gap-2">
						<SeriesToggle
							label="Requests"
							active={httpSeries.requests}
							onClick={() => toggleHttp("requests")}
						/>
						<SeriesToggle
							label="4xx / 5xx"
							active={httpSeries.errors}
							onClick={() => toggleHttp("errors")}
						/>
					</div>
				</div>
				<ChartContainer
					config={httpConfig}
					className="aspect-auto h-[220px] w-full"
				>
					<AreaChart accessibilityLayer data={data}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="bucket"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
							tickFormatter={(value: number) => formatBucket(value, spanHours)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							width={56}
							allowDecimals={false}
							tickFormatter={(value: number) => formatCount(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									indicator="line"
									labelFormatter={(value) => formatBucketFull(Number(value))}
								/>
							}
						/>
						{httpSeries.requests && (
							<Area
								dataKey="requests"
								type="monotone"
								isAnimationActive={false}
								connectNulls={false}
								fill="var(--chart-1)"
								fillOpacity={0.35}
								stroke="var(--chart-1)"
							/>
						)}
						{httpSeries.errors && (
							<Area
								dataKey="errors"
								type="monotone"
								isAnimationActive={false}
								connectNulls={false}
								fill="var(--chart-5)"
								fillOpacity={0.35}
								stroke="var(--chart-5)"
							/>
						)}
					</AreaChart>
				</ChartContainer>
			</div>

			<div className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-medium">
						Audience over time
						{!audienceAvailable && (
							<span className="ml-2 text-xs font-normal text-muted-foreground">
								web instrumentation not installed
							</span>
						)}
					</h3>
					<div className="flex gap-2">
						<SeriesToggle
							label="Page views"
							active={audienceSeries.pageviews}
							onClick={() => toggleAudience("pageviews")}
						/>
						<SeriesToggle
							label="Sessions"
							active={audienceSeries.sessions}
							onClick={() => toggleAudience("sessions")}
						/>
						<SeriesToggle
							label="Visitors"
							active={audienceSeries.visitors}
							onClick={() => toggleAudience("visitors")}
						/>
					</div>
				</div>
				<ChartContainer
					config={audienceConfig}
					className="aspect-auto h-[220px] w-full"
				>
					<AreaChart accessibilityLayer data={data}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="bucket"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
							tickFormatter={(value: number) => formatBucket(value, spanHours)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							width={56}
							allowDecimals={false}
							tickFormatter={(value: number) => formatCount(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									indicator="line"
									labelFormatter={(value) => formatBucketFull(Number(value))}
								/>
							}
						/>
						{audienceSeries.pageviews && (
							<Area
								dataKey="pageviews"
								type="monotone"
								isAnimationActive={false}
								connectNulls={false}
								fill="var(--chart-2)"
								fillOpacity={0.35}
								stroke="var(--chart-2)"
							/>
						)}
						{audienceSeries.sessions && (
							<Area
								dataKey="sessions"
								type="monotone"
								isAnimationActive={false}
								connectNulls={false}
								fill="var(--chart-3)"
								fillOpacity={0.35}
								stroke="var(--chart-3)"
							/>
						)}
						{audienceSeries.visitors && (
							<Area
								dataKey="visitors"
								type="monotone"
								isAnimationActive={false}
								connectNulls={false}
								fill="var(--chart-4)"
								fillOpacity={0.35}
								stroke="var(--chart-4)"
							/>
						)}
					</AreaChart>
				</ChartContainer>
			</div>

			<p className="text-xs text-muted-foreground">{resolutionNote}</p>
		</div>
	);
};

const SeriesToggle = ({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) => (
	<Button
		type="button"
		size="sm"
		variant={active ? "secondary" : "outline"}
		className={cn("h-7 px-2 text-xs", !active && "text-muted-foreground")}
		onClick={onClick}
		aria-pressed={active}
	>
		{label}
	</Button>
);
