import { HeartHandshake, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleHeader,
	ConsoleShell,
	ConsoleToolbar,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/utils/api";
import {
	CommunityActivityPanel,
	CommunityEventTypeFilter,
} from "./community-activity";
import {
	CommunityAttentionPanel,
	CommunityHealthPanel,
	CommunityOverviewPanel,
	CommunityReleasesPanel,
} from "./community-panels";
import { CommunityRepositoriesPanel } from "./community-repositories";
import { CommunitySourcesPanel } from "./community-sources";
import {
	COMMUNITY_RANGE_PRESETS,
	COMMUNITY_SOURCE_STATUS_LABELS,
	CommunityFilterState,
	DEFAULT_COMMUNITY_FILTERS,
	formatRelative,
	isCommunityDataStale,
	toCommunityRangeInput,
	toRepositoryScope,
	type CommunityRangePreset,
} from "./community-types";

/**
 * Community Console.
 *
 * The page answers operational questions about the open-source repositories SGE
 * follows on GitHub: what is active, what needs a human, and how the ecosystem
 * is doing. It is deliberately separate from the Traffic Manager — visitors and
 * contributors are never mixed in one metric.
 *
 * Everything shown comes either straight from GitHub (synchronized into the
 * local cache) or from Notploy's own counts over it. When no source is
 * configured, the page shows an installation state instead of pretending to have
 * data.
 */
export const CommunityManager = () => {
	const utils = api.useUtils();
	const [filters, setFilters] = useState<CommunityFilterState>(
		DEFAULT_COMMUNITY_FILTERS,
	);
	const [showSources, setShowSources] = useState(false);

	const sourcesQuery = api.community.sources.useQuery();
	const repositoriesQuery = api.community.repositories.useQuery({});

	const sources = sourcesQuery.data ?? [];
	const repositories = repositoriesQuery.data ?? [];
	const rangeReady =
		filters.preset !== "custom" || (!!filters.from && !!filters.to);

	const overview = api.community.overview.useQuery(
		{ ...toCommunityRangeInput(filters), repositoryIds: toRepositoryScope(filters) },
		{ enabled: rangeReady },
	);

	const syncNow = api.community.syncNow.useMutation({
		onSuccess: async () => {
			await utils.community.invalidate();
		},
	});

	const permissionError = [
		sourcesQuery.error,
		repositoriesQuery.error,
		overview.error,
	].find(
		(error) =>
			error?.data?.code === "FORBIDDEN" || error?.data?.code === "UNAUTHORIZED",
	);
	const otherError = [
		sourcesQuery.error,
		repositoriesQuery.error,
		overview.error,
	].find(
		(error) =>
			error &&
			error.data?.code !== "FORBIDDEN" &&
			error.data?.code !== "UNAUTHORIZED",
	);

	const isRefetching =
		sourcesQuery.isFetching ||
		repositoriesQuery.isFetching ||
		overview.isFetching;

	const lastSync = sources
		.map((source) => source.lastSuccessfulSyncAt)
		.filter((value): value is string => !!value)
		.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
	const stale = isCommunityDataStale(lastSync);

	const enabledSources = sources.filter((source) => source.enabled);
	const syncableSource = enabledSources[0];

	if (permissionError) {
		return (
			<ConsoleShell>
				<ConsoleHeader
					icon={HeartHandshake}
					title="Community"
					description="Follow the open-source activity of the repositories SGE tracks."
				/>
				<ConsoleBody>
					<AlertBlock type="error">
						You do not have permission to view the Community page.
					</AlertBlock>
				</ConsoleBody>
			</ConsoleShell>
		);
	}

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={HeartHandshake}
				title="Community"
				description="Follow the open-source activity of the repositories SGE tracks: issues, pull requests, releases and contributions that need attention."
				status={
					<div className="flex flex-wrap items-center gap-2 pt-1">
						{sources.length === 0 ? (
							<Badge variant="outline">Not configured</Badge>
						) : (
							sources.map((source) => (
								<Badge key={source.id} variant="outline" className="text-[11px]">
									{source.owner}:{" "}
									{COMMUNITY_SOURCE_STATUS_LABELS[source.status] ?? source.status}
								</Badge>
							))
						)}
						{stale && sources.length > 0 && (
							<Badge variant="secondary" className="text-[11px]">
								Data may be stale
							</Badge>
						)}
						<span className="text-xs text-muted-foreground">
							Last sync: {formatRelative(lastSync)}
						</span>
					</div>
				}
				actions={
					<>
						<Button
							variant="outline"
							onClick={() => setShowSources((value) => !value)}
						>
							<Settings2 className="size-4" aria-hidden />
							Sources
						</Button>
						{syncableSource && (
							<Button
								variant="outline"
								onClick={() =>
									syncNow.mutate({ sourceId: syncableSource.id })
								}
								disabled={syncNow.isPending}
							>
								<RefreshCw
									className={`size-4 ${syncNow.isPending ? "animate-spin" : ""}`}
									aria-hidden
								/>
								Sync now
							</Button>
						)}
						<Button
							variant="outline"
							onClick={() => void utils.community.invalidate()}
							disabled={isRefetching}
						>
							<RefreshCw
								className={`size-4 ${isRefetching ? "animate-spin" : ""}`}
								aria-hidden
							/>
							Refresh
						</Button>
					</>
				}
			/>

			<ConsoleBody>
				{otherError && (
					<AlertBlock type="error">
						{otherError.message || "Something went wrong loading the page."}
					</AlertBlock>
				)}

				{(showSources || sources.length === 0) && (
					<CommunitySourcesPanel
						onSynced={() => void utils.community.invalidate()}
					/>
				)}

				{sources.length === 0 ? (
					<ConsoleEmpty
						icon={HeartHandshake}
						title="Community monitoring is not configured"
						description="Follow a GitHub account above. The page will then show its repositories, contributions needing attention and recent releases. Nothing is simulated while no source exists."
					/>
				) : (
					<>
						<ConsoleToolbar className="rounded-md border bg-muted/30 p-3 lg:grid-cols-[190px_280px_1fr_auto] lg:items-end">
							<div className="space-y-1">
								<Label htmlFor="community-period">Period</Label>
								<Select
									value={filters.preset}
									onValueChange={(value) =>
										setFilters({
											...filters,
											preset: value as CommunityRangePreset,
										})
									}
								>
									<SelectTrigger id="community-period" className="w-[190px]">
										<SelectValue placeholder="Period" />
									</SelectTrigger>
									<SelectContent>
										{COMMUNITY_RANGE_PRESETS.map((preset) => (
											<SelectItem key={preset.value} value={preset.value}>
												{preset.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label htmlFor="community-repository">Repository</Label>
								<Select
									value={filters.repositoryId}
									onValueChange={(value) =>
										setFilters({ ...filters, repositoryId: value })
									}
								>
									<SelectTrigger
										id="community-repository"
										className="w-[280px]"
									>
										<SelectValue placeholder="All repositories" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All repositories</SelectItem>
										{repositories.map((repository) => (
											<SelectItem key={repository.id} value={repository.id}>
												{repository.fullName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="hidden lg:block" />
							{filters.preset === "custom" && (
								<div className="flex items-end gap-2">
									<div className="space-y-1">
										<Label htmlFor="community-from">From</Label>
										<Input
											id="community-from"
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
												setFilters({
													...filters,
													from: event.target.value
														? new Date(event.target.value)
														: undefined,
												})
											}
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="community-to">To</Label>
										<Input
											id="community-to"
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
												setFilters({
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
						</ConsoleToolbar>

						{filters.preset === "custom" && !rangeReady && (
							<Badge variant="outline">
								Pick both dates to load the custom range
							</Badge>
						)}

						<Tabs defaultValue="overview">
							<TabsList className="flex-wrap">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="attention">Needs attention</TabsTrigger>
								<TabsTrigger value="activity">Activity</TabsTrigger>
								<TabsTrigger value="repositories">Repositories</TabsTrigger>
								<TabsTrigger value="releases">Releases</TabsTrigger>
								<TabsTrigger value="health">Ecosystem health</TabsTrigger>
							</TabsList>

							<TabsContent value="overview" className="pt-4">
								<CommunityOverviewPanel
									repositoryScope={toRepositoryScope(filters)}
									preset={filters.preset}
									from={toCommunityRangeInput(filters).from}
									to={toCommunityRangeInput(filters).to}
								/>
							</TabsContent>

							<TabsContent value="attention" className="pt-4">
								<CommunityAttentionPanel
									repositoryScope={toRepositoryScope(filters)}
								/>
							</TabsContent>

							<TabsContent value="activity" className="space-y-4 pt-4">
								<Card className="p-3">
									<CommunityEventTypeFilter
										filters={filters}
										onChange={setFilters}
									/>
								</Card>
								<CommunityActivityPanel filters={filters} />
							</TabsContent>

							<TabsContent value="repositories" className="pt-4">
								<CommunityRepositoriesPanel
									onChanged={() => void utils.community.invalidate()}
								/>
							</TabsContent>

							<TabsContent value="releases" className="pt-4">
								<CommunityReleasesPanel
									repositoryScope={toRepositoryScope(filters)}
								/>
							</TabsContent>

							<TabsContent value="health" className="pt-4">
								<CommunityHealthPanel
									repositoryScope={toRepositoryScope(filters)}
								/>
							</TabsContent>
						</Tabs>
					</>
				)}
			</ConsoleBody>
		</ConsoleShell>
	);
};
