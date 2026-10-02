import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export type HomeChartDataset =
	| "workload-status"
	| "workloads-by-project"
	| "workload-types"
	| "deployment-activity"
	| "project-inventory";
export type HomeChartView = "area" | "bar" | "pie";

export interface HomeChartSource {
	id: HomeChartDataset;
	label: string;
	description: string;
	data: Array<Record<string, string | number>>;
	series: Array<{ key: string; label: string; color: string }>;
	views?: HomeChartView[];
}

interface HomeDataChartProps {
	dashboardId: string;
	sources: HomeChartSource[];
}

interface HomeDataPanel {
	id: string;
	sourceId: HomeChartDataset;
	view: HomeChartView;
}

const STORAGE_VERSION = 1;
const DEFAULT_CHART_VIEWS: HomeChartView[] = ["area", "bar", "pie"];

function isChartView(value: unknown): value is HomeChartView {
	return value === "area" || value === "bar" || value === "pie";
}

function getAvailableViews(source: HomeChartSource) {
	return source.views ?? DEFAULT_CHART_VIEWS;
}

function getFirstAvailableView(source: HomeChartSource) {
	return getAvailableViews(source)[0] ?? "bar";
}

function getDefaultPanels(sources: HomeChartSource[]): HomeDataPanel[] {
	return sources
		.filter(
			(source) =>
				source.id === "workload-status" || source.id === "deployment-activity",
		)
		.map((source) => ({
			id: `panel-${source.id}`,
			sourceId: source.id,
			view: getFirstAvailableView(source),
		}));
}

export function HomeDataChart({ dashboardId, sources }: HomeDataChartProps) {
	const storageKey = `notploy.dashboard.${dashboardId}.chart.v${STORAGE_VERSION}`;
	const defaultSource = sources[0];
	const [panels, setPanels] = useState<HomeDataPanel[]>([]);
	const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);

	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(storageKey);
			const parsed: unknown = stored ? JSON.parse(stored) : null;
			const savedPanels =
				typeof parsed === "object" &&
				parsed !== null &&
				"panels" in parsed &&
				Array.isArray(parsed.panels)
					? parsed.panels
					: null;
			const restored = savedPanels
				?.filter(
					(panel): panel is Record<string, unknown> =>
						typeof panel === "object" && panel !== null,
				)
				.map((panel, index): HomeDataPanel | null => {
					const source = sources.find(
						(candidate) => candidate.id === panel.sourceId,
					);
					if (!source || typeof panel.id !== "string") return null;
					const views = getAvailableViews(source);
					return {
						id: panel.id || `panel-${index}`,
						sourceId: source.id,
						view:
							isChartView(panel.view) && views.includes(panel.view)
								? panel.view
								: getFirstAvailableView(source),
					};
				})
				.filter((panel): panel is HomeDataPanel => panel !== null);
			setPanels(restored ?? (stored ? [] : getDefaultPanels(sources)));
		} catch (error) {
			console.error("Failed to read home chart preferences", error);
			setPanels(getDefaultPanels(sources));
		}
		setLoadedStorageKey(storageKey);
	}, [defaultSource, sources, storageKey]);

	useEffect(() => {
		if (loadedStorageKey !== storageKey) return;
		try {
			window.localStorage.setItem(storageKey, JSON.stringify({ panels }));
		} catch (error) {
			console.error("Failed to save home chart preferences", error);
		}
	}, [loadedStorageKey, panels, storageKey]);

	if (sources.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No chart datasets are available for your permissions.
			</p>
		);
	}

	const addPanel = () => {
		const source =
			sources.find(
				(candidate) => !panels.some((panel) => panel.sourceId === candidate.id),
			) ?? defaultSource;
		if (!source) return;
		setPanels((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				sourceId: source.id,
				view: getFirstAvailableView(source),
			},
		]);
	};

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<Button variant="outline" size="sm" onClick={addPanel}>
					<Plus aria-hidden />
					Add chart
				</Button>
			</div>
			{panels.length === 0 ? (
				<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					Add a chart to choose a dataset.
				</p>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{panels.map((panel) => {
						const source =
							sources.find(({ id: sourceId }) => sourceId === panel.sourceId) ??
							defaultSource;
						if (!source) return null;
						const views = getAvailableViews(source);
						const view = views.includes(panel.view)
							? panel.view
							: getFirstAvailableView(source);
						return (
							<DatasetPanel
								key={panel.id}
								source={source}
								view={view}
								sources={sources}
								onSourceChange={(sourceId) => {
									const nextSource = sources.find(
										(candidate) => candidate.id === sourceId,
									);
									if (!nextSource) return;
									setPanels((current) =>
										current.map((item) =>
											item.id === panel.id
												? {
														...item,
														sourceId: nextSource.id,
														view: getAvailableViews(nextSource).includes(
															item.view,
														)
															? item.view
															: getFirstAvailableView(nextSource),
													}
												: item,
										),
									);
								}}
								onViewChange={(nextView) =>
									setPanels((current) =>
										current.map((item) =>
											item.id === panel.id ? { ...item, view: nextView } : item,
										),
									)
								}
								onRemove={() =>
									setPanels((current) =>
										current.filter((item) => item.id !== panel.id),
									)
								}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}

function DatasetPanel({
	source,
	sources,
	view,
	onSourceChange,
	onViewChange,
	onRemove,
}: {
	source: HomeChartSource;
	sources: HomeChartSource[];
	view: HomeChartView;
	onSourceChange: (sourceId: string) => void;
	onViewChange: (view: HomeChartView) => void;
	onRemove: () => void;
}) {
	const chartConfig = useMemo(
		() =>
			Object.fromEntries(
				source.series.map((series) => [
					series.key,
					{ label: series.label, color: series.color },
				]),
			),
		[source],
	);
	const pieData =
		source.series.length === 1
			? source.data.map((point, index) => ({
					name: String(point.label ?? index + 1),
					value: Number(point[source.series[0]?.key ?? ""] ?? 0),
					fill: `hsl(var(--chart-${(index % 5) + 1}))`,
				}))
			: source.series.map((series) => ({
					name: series.label,
					value: source.data.reduce(
						(sum, point) => sum + Number(point[series.key] ?? 0),
						0,
					),
					fill: series.color,
				}));

	return (
		<Card className="min-w-0">
			<CardContent className="space-y-3 p-3 sm:p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Select value={source.id} onValueChange={onSourceChange}>
						<SelectTrigger aria-label="Chart dataset" className="w-47.5">
							<SelectValue placeholder="Dataset" />
						</SelectTrigger>
						<SelectContent>
							{sources.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-2">
						<Select
							value={view}
							onValueChange={(value) => {
								if (isChartView(value)) onViewChange(value);
							}}
						>
							<SelectTrigger
								aria-label="Chart visualization"
								className="w-31.25"
							>
								<SelectValue placeholder="Visualization" />
							</SelectTrigger>
							<SelectContent>
								{getAvailableViews(source).map((availableView) => (
									<SelectItem key={availableView} value={availableView}>
										{availableView === "area"
											? "Area"
											: availableView === "bar"
												? "Bars"
												: "Share"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Remove ${source.label} chart`}
							onClick={onRemove}
						>
							<X aria-hidden />
						</Button>
					</div>
				</div>
				<div>
					<p className="text-sm font-medium">{source.label}</p>
					<p className="text-xs text-muted-foreground">{source.description}</p>
				</div>
				{source.data.length === 0 ? (
					<div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
						No data points are available for this dataset.
					</div>
				) : view === "pie" ? (
					<ChartContainer config={chartConfig} className="h-64 w-full">
						<PieChart>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Pie
								data={pieData}
								dataKey="value"
								nameKey="name"
								innerRadius={55}
								outerRadius={95}
								strokeWidth={3}
							>
								{pieData.map((item) => (
									<Cell key={item.name} fill={item.fill} />
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
				) : (
					<ChartContainer config={chartConfig} className="h-64 w-full">
						{view === "area" ? (
							<AreaChart data={source.data}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="label"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									allowDecimals={false}
								/>
								<ChartTooltip
									content={<ChartTooltipContent labelKey="label" />}
								/>
								{source.series.map((series) => (
									<Area
										key={series.key}
										type="monotone"
										dataKey={series.key}
										name={series.key}
										stackId="1"
										isAnimationActive={false}
										stroke={series.color}
										fill={series.color}
										fillOpacity={0.2}
									/>
								))}
							</AreaChart>
						) : (
							<BarChart data={source.data}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="label"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									allowDecimals={false}
								/>
								<ChartTooltip
									content={<ChartTooltipContent labelKey="label" />}
								/>
								{source.series.map((series) => (
									<Bar
										key={series.key}
										dataKey={series.key}
										name={series.key}
										stackId="1"
										fill={series.color}
										radius={[4, 4, 0, 0]}
									/>
								))}
							</BarChart>
						)}
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
