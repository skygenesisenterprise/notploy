import {
	InboxIcon,
	RefreshCwIcon,
	ServerCogIcon,
	TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/router";
import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import type { StatusOverview, StatusPageOverview } from "@/lib/status";
import { useDebounce } from "@/utils/hooks/use-debounce";
import { HandleIncident } from "./handle-incident";
import { HandleMaintenance } from "./handle-maintenance";
import { IncidentCard } from "./incident-card";
import { MaintenanceCard } from "./maintenance-card";

const STATE_FILTERS = [
	{ value: "all", label: "All states" },
	{ value: "active", label: "Active only" },
	{ value: "resolved", label: "Resolved only" },
] as const;

type StateFilter = (typeof STATE_FILTERS)[number]["value"];

const EmptyPanel = ({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	action?: React.ReactNode;
}) => (
	<div className="flex min-h-[25vh] flex-col items-center justify-center gap-3 py-12 text-center">
		<Icon className="size-8 text-muted-foreground" aria-hidden="true" />
		<h2 className="text-lg font-semibold">{title}</h2>
		<p className="max-w-md text-sm text-muted-foreground">{description}</p>
		{action}
	</div>
);

/**
 * Console view of the Notploy Status platform.
 *
 * Every entry shown here — an incident declared from this page, one created
 * on the status administration, or an alert promoted by the monitoring
 * agent — comes from the same status instance, so operators get one single
 * dialogue with the public status page in both directions.
 */
export const ShowIncidents = ({ overview }: { overview: StatusOverview }) => {
	const router = useRouter();
	const [search, setSearch] = React.useState("");
	const [stateFilter, setStateFilter] = React.useState<StateFilter>("all");
	const [pageSlug, setPageSlug] = React.useState(
		overview.pages[0]?.page.slug ?? "",
	);

	const debouncedSearch = useDebounce(search, 300);

	// Keep the selection valid when the pages change after a refresh.
	const selected: StatusPageOverview | null =
		overview.pages.find((entry) => entry.page.slug === pageSlug) ??
		overview.pages[0] ??
		null;

	const filteredIncidents = React.useMemo(() => {
		if (!selected) return [];
		const query = debouncedSearch.trim().toLowerCase();
		return selected.incidents
			.filter((incident) => {
				const matchesSearch =
					query === "" ||
					incident.title.toLowerCase().includes(query) ||
					incident.description.toLowerCase().includes(query);
				const matchesState =
					stateFilter === "all" ||
					(stateFilter === "active" && incident.state !== "resolved") ||
					(stateFilter === "resolved" && incident.state === "resolved");
				return matchesSearch && matchesState;
			})
			.sort((a, b) => {
				// Open incidents first, then most recent activity on top.
				const aResolved = a.state === "resolved" ? 1 : 0;
				const bResolved = b.state === "resolved" ? 1 : 0;
				if (aResolved !== bResolved) return aResolved - bResolved;
				return b.updatedAt.localeCompare(a.updatedAt);
			});
	}, [selected, debouncedSearch, stateFilter]);

	const filteredMaintenances = React.useMemo(() => {
		if (!selected) return [];
		const query = debouncedSearch.trim().toLowerCase();
		return selected.maintenances
			.filter(
				(maintenance) =>
					query === "" ||
					maintenance.title.toLowerCase().includes(query) ||
					maintenance.description.toLowerCase().includes(query),
			)
			.sort((a, b) => b.startAt.localeCompare(a.startAt));
	}, [selected, debouncedSearch]);

	const retry = async () => {
		await router.replace(router.asPath);
	};

	const header = (
		<CardHeader>
			<CardTitle className="text-xl flex flex-row gap-2">
				<TriangleAlert className="size-6 text-muted-foreground self-center" />
				Incidents
			</CardTitle>
			<CardDescription>
				Platform incidents and maintenance windows, mirrored from the
				Notploy Status pages — whatever their origin: this console, the
				status page itself or the monitoring pipeline.
			</CardDescription>
			{selected ? (
				<CardAction className="flex flex-row gap-2">
					<HandleMaintenance page={selected} />
					<HandleIncident page={selected} />
				</CardAction>
			) : null}
		</CardHeader>
	);

	let body: React.ReactNode;

	if (!overview.configured) {
		body = (
			<EmptyPanel
				icon={ServerCogIcon}
				title="No status instance connected"
				description="Point the console at a Notploy Status instance to declare incidents and maintenance windows from here. Set STATUS_URL (the status app origin) and STATUS_TOKEN (an administration token with the read, write and publish scopes) on the console server, then reload."
			/>
		);
	} else if (overview.error) {
		body = (
			<div className="flex min-h-[25vh] flex-col items-center justify-center gap-4 py-12">
				<Alert variant="destructive" className="max-w-xl">
					<AlertTitle>Unable to reach the status instance</AlertTitle>
					<AlertDescription>{overview.error}</AlertDescription>
				</Alert>
				<Button variant="outline" onClick={retry}>
					<RefreshCwIcon className="h-4 w-4" />
					Retry
				</Button>
			</div>
		);
	} else if (!selected) {
		body = (
			<EmptyPanel
				icon={InboxIcon}
				title="No status page configured"
				description="Create a status page on the status instance first; incidents and maintenance windows then belong to it and appear here."
			/>
		);
	} else {
		body = (
			<div className="space-y-4 py-8 border-t">
				<div className="flex flex-wrap items-center gap-2">
					{overview.pages.length > 1 ? (
						<Select value={selected.page.slug} onValueChange={setPageSlug}>
							<SelectTrigger className="w-64">
								<SelectValue placeholder="Status page" />
							</SelectTrigger>
							<SelectContent>
								{overview.pages.map((entry) => (
									<SelectItem key={entry.page.slug} value={entry.page.slug}>
										{entry.page.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<span className="text-sm font-medium">{selected.page.name}</span>
					)}
					<Input
						placeholder="Search title or description..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="max-w-xs"
					/>
					<Select
						value={stateFilter}
						onValueChange={(value) => setStateFilter(value as StateFilter)}
					>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="State" />
						</SelectTrigger>
						<SelectContent>
							{STATE_FILTERS.map((filter) => (
								<SelectItem key={filter.value} value={filter.value}>
									{filter.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<Tabs defaultValue="incidents">
					<TabsList>
						<TabsTrigger value="incidents">
							Incidents ({filteredIncidents.length})
						</TabsTrigger>
						<TabsTrigger value="maintenances">
							Maintenances ({filteredMaintenances.length})
						</TabsTrigger>
					</TabsList>

					<TabsContent value="incidents" className="space-y-3">
						{filteredIncidents.length === 0 ? (
							<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
								<p className="text-xl text-muted-foreground">
									{debouncedSearch || stateFilter !== "all"
										? "No incident matches your criteria"
										: "No incident declared yet"}
								</p>
							</div>
						) : (
							filteredIncidents.map((incident) => (
								<IncidentCard
									key={incident.id}
									incident={incident}
									components={selected.components}
								/>
							))
						)}
					</TabsContent>

					<TabsContent value="maintenances" className="space-y-3">
						{filteredMaintenances.length === 0 ? (
							<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
								<p className="text-xl text-muted-foreground">
									{debouncedSearch
										? "No maintenance matches your criteria"
										: "No maintenance scheduled yet"}
								</p>
							</div>
						) : (
							filteredMaintenances.map((maintenance) => (
								<MaintenanceCard
									key={maintenance.id}
									maintenance={maintenance}
									components={selected.components}
								/>
							))
						)}
					</TabsContent>
				</Tabs>
			</div>
		);
	}

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl w-full min-h-[45vh]">
				<div className="rounded-xl bg-background shadow-md h-full">
					{header}
					<CardContent>{body}</CardContent>
				</div>
			</Card>
		</div>
	);
};
