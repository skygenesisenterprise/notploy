import { CalendarRange, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	formatDateTime,
	formatRelativeMinutes,
	RANGE_PRESETS,
	type TrafficFilterState,
	type TrafficRangePreset,
} from "./traffic-types";

interface TrafficPropertyOption {
	id: string;
	platform: string;
	domain: string;
}

interface TrafficFiltersProps {
	filters: TrafficFilterState;
	properties: TrafficPropertyOption[];
	onChange: (filters: TrafficFilterState) => void;
	onRefresh: () => void;
	isRefetching: boolean;
	lastEventAt: string | null;
	lastUpdatedAt: string | null;
}

/**
 * Header filters of the Traffic Manager.
 *
 * Every control here changes the queries: the period, the platform (or the
 * single domain) and the comparison switch are part of the API input, and the
 * freshness indicators are rendered from the traffic data itself rather than
 * from a local timer.
 */
export const TrafficFilters = ({
	filters,
	properties,
	onChange,
	onRefresh,
	isRefetching,
	lastEventAt,
	lastUpdatedAt,
}: TrafficFiltersProps) => {
	const platforms = [
		...new Set(properties.map((property) => property.platform)),
	]
		.sort()
		.map((platform) => ({ value: platform, label: platform }));
	const platformProperties = properties.filter(
		(property) =>
			filters.platform === "all" || property.platform === filters.platform,
	);

	return (
		<div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 lg:flex-row lg:flex-wrap lg:items-end">
			<div className="space-y-1">
				<Label htmlFor="traffic-period">Period</Label>
				<Select
					value={filters.preset}
					onValueChange={(value) =>
						onChange({ ...filters, preset: value as TrafficRangePreset })
					}
				>
					<SelectTrigger id="traffic-period" className="w-[190px]">
						<SelectValue placeholder="Period" />
					</SelectTrigger>
					<SelectContent>
						{RANGE_PRESETS.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								{preset.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1">
				<Label htmlFor="traffic-platform">Platform / domain</Label>
				<Select
					value={
						filters.propertyId === "all"
							? filters.platform === "all"
								? "all"
								: `platform:${filters.platform}`
							: `property:${filters.propertyId}`
					}
					onValueChange={(value) => {
						if (value === "all") {
							onChange({ ...filters, platform: "all", propertyId: "all" });
							return;
						}
						if (value.startsWith("platform:")) {
							onChange({
								...filters,
								platform: value.slice("platform:".length),
								propertyId: "all",
							});
							return;
						}
						const propertyId = value.slice("property:".length);
						const property = properties.find(
							(candidate) => candidate.id === propertyId,
						);
						onChange({
							...filters,
							propertyId,
							platform: property?.platform ?? filters.platform,
						});
					}}
				>
					<SelectTrigger id="traffic-platform" className="w-[250px]">
						<SelectValue placeholder="All platforms" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All platforms</SelectItem>
						<SelectGroup>
							<SelectLabel>Platforms</SelectLabel>
							{platforms.map((platform) => (
								<SelectItem
									key={platform.value}
									value={`platform:${platform.value}`}
								>
									{platform.label}
								</SelectItem>
							))}
						</SelectGroup>
						{platformProperties.length > 0 && (
							<SelectGroup>
								<SelectLabel>Domains</SelectLabel>
								{platformProperties.map((property) => (
									<SelectItem
										key={property.id}
										value={`property:${property.id}`}
									>
										{property.domain}
									</SelectItem>
								))}
							</SelectGroup>
						)}
					</SelectContent>
				</Select>
			</div>

			{filters.preset === "custom" && (
				<div className="flex items-end gap-2">
					<div className="space-y-1">
						<Label htmlFor="traffic-from">From</Label>
						<Input
							id="traffic-from"
							type="datetime-local"
							className="w-[210px]"
							value={
								filters.from
									? new Date(
											filters.from.getTime() -
												filters.from.getTimezoneOffset() * 60000,
										)
											.toISOString()
											.slice(0, 16)
									: ""
							}
							onChange={(event) =>
								onChange({
									...filters,
									from: event.target.value
										? new Date(event.target.value)
										: undefined,
								})
							}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="traffic-to">To</Label>
						<Input
							id="traffic-to"
							type="datetime-local"
							className="w-[210px]"
							value={
								filters.to
									? new Date(
											filters.to.getTime() -
												filters.to.getTimezoneOffset() * 60000,
										)
											.toISOString()
											.slice(0, 16)
									: ""
							}
							onChange={(event) =>
								onChange({
									...filters,
									to: event.target.value
										? new Date(event.target.value)
										: undefined,
								})
							}
						/>
					</div>
				</div>
			)}

			<div className="flex items-center gap-2 pb-1">
				<Checkbox
					id="traffic-compare"
					checked={filters.compare}
					onCheckedChange={(checked) =>
						onChange({ ...filters, compare: checked === true })
					}
				/>
				<Label htmlFor="traffic-compare" className="cursor-pointer">
					Compare previous period
				</Label>
			</div>

			<div className="flex flex-1 flex-wrap items-center justify-end gap-3">
				<div className="text-right text-xs text-muted-foreground">
					<p>
						Data updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "—"}
					</p>
					<p>Last reception: {formatRelativeMinutesFromIso(lastEventAt)}</p>
				</div>
				<Button variant="outline" onClick={onRefresh} disabled={isRefetching}>
					<RefreshCw
						className={`size-4 ${isRefetching ? "animate-spin" : ""}`}
						aria-hidden
					/>
					Refresh
				</Button>
			</div>

			{filters.preset === "custom" && !filters.from && !filters.to && (
				<Badge variant="outline" className="gap-1">
					<CalendarRange className="size-3" aria-hidden />
					Pick both dates to load the custom range
				</Badge>
			)}
		</div>
	);
};

const formatRelativeMinutesFromIso = (value: string | null): string => {
	if (!value) {
		return "never";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "never";
	}
	return formatRelativeMinutes((Date.now() - date.getTime()) / 60000);
};
