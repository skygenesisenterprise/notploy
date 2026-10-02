import {
	ArrowDown,
	ArrowLeftRight,
	ArrowUp,
	CircleDot,
	Database,
	LayoutDashboard,
	RefreshCw,
	RotateCcw,
	SlidersHorizontal,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DashboardWidgetDefinition {
	id: string;
	label: string;
	content: React.ReactNode;
	size?: "half" | "full";
	defaultVisible?: boolean;
}

interface DashboardPreferences {
	hidden: string[];
	order: string[];
	sizes: Record<string, "half" | "full">;
}

interface DashboardCanvasProps {
	id: string;
	title: string;
	description: string;
	widgets: DashboardWidgetDefinition[];
	dataSourceLabel?: string;
	emptyMessage?: string;
}

export function DashboardCanvas({
	id,
	title,
	description,
	widgets,
	dataSourceLabel = "Notploy API",
	emptyMessage = "No dashboard blocks are available.",
}: DashboardCanvasProps) {
	const [preferences, setPreferences] = useState<DashboardPreferences>({
		hidden: [],
		order: [],
		sizes: {},
	});
	const [preferencesLoaded, setPreferencesLoaded] = useState(false);
	const [isCustomizing, setIsCustomizing] = useState(false);
	const widgetIds = widgets.map(({ id: widgetId }) => widgetId);
	const widgetIdKey = widgetIds.join(",");
	const storageKey = `notploy.dashboard.${id}.layout.v1`;

	useEffect(() => {
		setPreferencesLoaded(false);
		try {
			const stored = window.localStorage.getItem(storageKey);
			const parsed: unknown = stored ? JSON.parse(stored) : {};
			const allowedWidgetIds = new Set(
				widgetIdKey ? widgetIdKey.split(",") : [],
			);
			const defaultHidden = widgets
				.filter(({ defaultVisible }) => defaultVisible === false)
				.map(({ id: widgetId }) => widgetId);
			if (typeof parsed !== "object" || parsed === null) {
				setPreferences({ hidden: defaultHidden, order: [], sizes: {} });
			} else {
				const saved = parsed as Partial<DashboardPreferences>;
				const hidden = Array.isArray(saved.hidden)
					? saved.hidden.filter(
							(value): value is string =>
								typeof value === "string" && allowedWidgetIds.has(value),
						)
					: defaultHidden;
				const order = Array.isArray(saved.order)
					? saved.order.filter(
							(value): value is string =>
								typeof value === "string" && allowedWidgetIds.has(value),
						)
					: [];
				const sizes =
					typeof saved.sizes === "object" && saved.sizes !== null
						? Object.fromEntries(
								Object.entries(saved.sizes).filter(
									(entry): entry is [string, "half" | "full"] =>
										allowedWidgetIds.has(entry[0]) &&
										(entry[1] === "half" || entry[1] === "full"),
								),
							)
						: {};
				setPreferences({ hidden, order, sizes });
			}
		} catch (error) {
			console.error("Failed to read dashboard preferences", error);
			setPreferences({ hidden: [], order: [], sizes: {} });
		}
		setPreferencesLoaded(true);
	}, [storageKey, widgetIdKey]);

	useEffect(() => {
		if (!preferencesLoaded) return;
		try {
			window.localStorage.setItem(storageKey, JSON.stringify(preferences));
		} catch (error) {
			console.error("Failed to save dashboard preferences", error);
		}
	}, [preferences, preferencesLoaded, storageKey]);

	const visibleWidgets = widgets
		.filter(({ id: widgetId }) => !preferences.hidden.includes(widgetId))
		.map((widget) => ({
			...widget,
			size: preferences.sizes[widget.id] ?? widget.size ?? "half",
		}))
		.sort((a, b) => {
			const aIndex = preferences.order.indexOf(a.id);
			const bIndex = preferences.order.indexOf(b.id);
			if (aIndex === -1 && bIndex === -1) return 0;
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});

	const updateOrder = (sourceId: string, targetId: string) => {
		const currentOrder = visibleWidgets.map(({ id: widgetId }) => widgetId);
		const sourceIndex = currentOrder.indexOf(sourceId);
		const targetIndex = currentOrder.indexOf(targetId);
		if (sourceIndex === -1 || targetIndex === -1) return;
		currentOrder.splice(sourceIndex, 1);
		currentOrder.splice(targetIndex, 0, sourceId);
		setPreferences((current) => ({
			...current,
			order: currentOrder,
		}));
	};

	const moveWidget = (widgetId: string, direction: -1 | 1) => {
		const currentOrder = visibleWidgets.map(({ id }) => id);
		const index = currentOrder.indexOf(widgetId);
		const nextIndex = index + direction;
		if (index === -1 || nextIndex < 0 || nextIndex >= currentOrder.length)
			return;
		[currentOrder[index], currentOrder[nextIndex]] = [
			currentOrder[nextIndex]!,
			currentOrder[index]!,
		];
		setPreferences((current) => ({
			...current,
			order: currentOrder,
		}));
	};

	return (
		<div className="w-full space-y-7">
			<header className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
								<CircleDot className="size-3" aria-hidden />
								Live
							</span>
						</div>
						<p className="max-w-2xl text-sm text-muted-foreground">
							{description}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant={isCustomizing ? "secondary" : "outline"}
							size="sm"
							aria-pressed={isCustomizing}
							onClick={() => setIsCustomizing((current) => !current)}
						>
							<SlidersHorizontal aria-hidden />
							{isCustomizing ? "Done" : "Customize"}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="icon-sm"
									aria-label="Dashboard blocks"
								>
									<LayoutDashboard aria-hidden />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>Visible blocks</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{widgets.map(({ id: widgetId, label }) => (
									<DropdownMenuCheckboxItem
										key={widgetId}
										checked={!preferences.hidden.includes(widgetId)}
										onCheckedChange={(checked) =>
											setPreferences((current) => ({
												...current,
												hidden: checked
													? current.hidden.filter(
															(hidden) => hidden !== widgetId,
														)
													: [...current.hidden, widgetId],
											}))
										}
									>
										{label}
									</DropdownMenuCheckboxItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuLabel className="font-normal text-muted-foreground">
									Saved in this browser
								</DropdownMenuLabel>
								{(preferences.hidden.length > 0 ||
									preferences.order.length > 0 ||
									Object.keys(preferences.sizes).length > 0) && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onSelect={() =>
												setPreferences({ hidden: [], order: [], sizes: {} })
											}
										>
											<RotateCcw aria-hidden />
											Reset layout
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Refresh dashboard data"
							onClick={() => window.location.reload()}
						>
							<RefreshCw aria-hidden />
						</Button>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 bg-muted/25 px-4 py-2.5 sm:px-5">
					<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Data source
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium shadow-xs">
						<Database className="size-3.5 text-primary" aria-hidden />
						{dataSourceLabel}
					</span>
					<span className="ml-auto text-xs text-muted-foreground">
						Authenticated organization metrics
					</span>
				</div>
			</header>

			{visibleWidgets.length > 0 ? (
				<ul className="m-0 grid list-none grid-cols-1 gap-7 p-0 lg:grid-cols-2">
					{visibleWidgets.map(
						({ id: widgetId, label, size, content }, index) => (
							<li
								key={widgetId}
								draggable={isCustomizing}
								onDragStart={(event) => {
									event.dataTransfer.effectAllowed = "move";
									event.dataTransfer.setData("text/plain", widgetId);
								}}
								onDragOver={(event) => {
									if (isCustomizing) event.preventDefault();
								}}
								onDrop={(event) => {
									event.preventDefault();
									const sourceId = event.dataTransfer.getData("text/plain");
									if (sourceId) updateOrder(sourceId, widgetId);
								}}
								className={size === "full" ? "lg:col-span-2" : undefined}
							>
								{isCustomizing && (
									<div className="mb-2 flex items-center justify-between rounded-lg border bg-muted/30 px-2 py-1">
										<span className="truncate text-xs font-medium text-muted-foreground">
											{label}
										</span>
										<div className="flex shrink-0 items-center gap-1">
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Move ${label} up`}
												disabled={index === 0}
												onClick={() => moveWidget(widgetId, -1)}
											>
												<ArrowUp aria-hidden />
											</Button>
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Move ${label} down`}
												disabled={index === visibleWidgets.length - 1}
												onClick={() => moveWidget(widgetId, 1)}
											>
												<ArrowDown aria-hidden />
											</Button>
											<Button
												variant="ghost"
												size="icon-xs"
												aria-label={`Make ${label} ${size === "full" ? "half" : "full"} width`}
												onClick={() =>
													setPreferences((current) => ({
														...current,
														sizes: {
															...current.sizes,
															[widgetId]: size === "full" ? "half" : "full",
														},
													}))
												}
											>
												<ArrowLeftRight aria-hidden />
											</Button>
										</div>
									</div>
								)}
								{content}
							</li>
						),
					)}
				</ul>
			) : (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
					<LayoutDashboard
						className="size-8 text-muted-foreground"
						aria-hidden
					/>
					<p className="text-sm text-muted-foreground">
						{preferences.hidden.length > 0
							? "All dashboard blocks are hidden."
							: emptyMessage}
					</p>
					{preferences.hidden.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setPreferences((current) => ({
									...current,
									hidden: [],
								}))
							}
						>
							<RotateCcw aria-hidden />
							Restore default blocks
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
