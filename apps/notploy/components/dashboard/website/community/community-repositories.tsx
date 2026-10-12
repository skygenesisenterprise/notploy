import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	Archive,
	ExternalLink,
	EyeOff,
	Star,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
	ConsoleSearch,
	ConsoleTable,
	SortableHeader,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";
import { formatCount, formatRelative } from "./community-types";

interface RepositoryRow {
	id: string;
	fullName: string;
	description: string | null;
	language: string | null;
	isArchived: boolean;
	isPrivate: boolean;
	stars: number;
	openIssues: number;
	openPullRequests: number;
	lastReleaseTag: string | null;
	pushedAt: string | null;
	webUrl: string | null;
	syncedAt: string | null;
}

const columnHelper = createColumnHelper<RepositoryRow>();

/**
 * Tracked repositories.
 *
 * This is a Console view, not a GitHub clone: it shows what the operator needs to
 * decide where to look, and every row links back to GitHub for anything deeper.
 * Search and sorting happen client-side on the already-bounded tracked set; the
 * period filters are irrelevant here.
 */
export const CommunityRepositoriesPanel = ({
	onChanged,
}: {
	onChanged: () => void;
}) => {
	const utils = api.useUtils();
	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "pushedAt", desc: true },
	]);
	const [sourceId, setSourceId] = useState("");
	const [fullName, setFullName] = useState("");
	const [error, setError] = useState<string | null>(null);

	const sourcesQuery = api.community.sources.useQuery();
	const repositoriesQuery = api.community.repositories.useQuery({});

	const availableQuery = api.community.availableRepositories.useQuery(
		{ sourceId },
		{ enabled: sourceId.length > 0 },
	);

	const trackRepository = api.community.trackRepository.useMutation({
		onSuccess: async () => {
			setFullName("");
			setError(null);
			await utils.community.invalidate();
			onChanged();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const untrackRepository = api.community.untrackRepository.useMutation({
		onSuccess: async () => {
			await utils.community.invalidate();
			onChanged();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const repositories: RepositoryRow[] = repositoriesQuery.data ?? [];

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return repositories;
		return repositories.filter(
			(repository) =>
				repository.fullName.toLowerCase().includes(term) ||
				(repository.description ?? "").toLowerCase().includes(term),
		);
	}, [repositories, search]);

	const columns = useMemo(
		() => [
			columnHelper.accessor("fullName", {
				header: ({ column }) => (
					<SortableHeader column={column} title="Repository" />
				),
				cell: ({ row }) => (
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-medium">{row.original.fullName}</span>
							{row.original.isArchived && (
								<Badge variant="outline" className="text-[11px]">
									<Archive className="size-3" aria-hidden /> archived
								</Badge>
							)}
							{row.original.isPrivate && (
								<Badge variant="outline" className="text-[11px]">
									<EyeOff className="size-3" aria-hidden /> private
								</Badge>
							)}
						</div>
						{row.original.description && (
							<p className="max-w-md text-xs text-muted-foreground">
								{row.original.description}
							</p>
						)}
						{row.original.webUrl && (
							<a
								href={row.original.webUrl}
								target="_blank"
								rel="noreferrer noopener"
								className="inline-flex items-center gap-1 text-xs underline"
							>
								<ExternalLink className="size-3" aria-hidden />
								GitHub
							</a>
						)}
					</div>
				),
			}),
			columnHelper.accessor("language", {
				header: "Language",
				cell: ({ getValue }) => getValue() ?? "—",
			}),
			columnHelper.accessor("openIssues", {
				header: ({ column }) => (
					<SortableHeader column={column} title="Issues" />
				),
				cell: ({ getValue }) => formatCount(getValue()),
			}),
			columnHelper.accessor("openPullRequests", {
				header: ({ column }) => (
					<SortableHeader column={column} title="PRs" />
				),
				cell: ({ getValue }) => formatCount(getValue()),
			}),
			columnHelper.accessor("stars", {
				header: ({ column }) => (
					<SortableHeader column={column} title="Stars" />
				),
				cell: ({ getValue }) => (
					<span className="inline-flex items-center gap-1">
						<Star className="size-3 text-muted-foreground" aria-hidden />
						{formatCount(getValue())}
					</span>
				),
			}),
			columnHelper.accessor("lastReleaseTag", {
				header: "Release",
				cell: ({ getValue }) => getValue() ?? "—",
			}),
			columnHelper.accessor("pushedAt", {
				header: ({ column }) => (
					<SortableHeader column={column} title="Last push" />
				),
				cell: ({ getValue }) => formatRelative(getValue()),
			}),
			columnHelper.display({
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							untrackRepository.mutate({ repositoryId: row.original.id })
						}
						disabled={untrackRepository.isPending}
						aria-label={`Stop tracking ${row.original.fullName}`}
					>
						<Trash2 className="size-4" aria-hidden />
					</Button>
				),
			}),
		],
		[untrackRepository],
	);

	const table = useReactTable({
		data: filtered,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize: 10 } },
	});

	const sources = sourcesQuery.data ?? [];

	return (
		<div className="space-y-4">
			{error && (
				<AlertBlock type="error">
					<span className="font-medium">Action failed</span> — {error}
				</AlertBlock>
			)}

			<div className="rounded-md border border-dashed p-3">
				<p className="mb-2 text-sm font-medium">Track a repository</p>
				{sources.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Follow a GitHub account first, then track its repositories here.
					</p>
				) : (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
						<div className="space-y-1">
							<Label htmlFor="community-track-source">Source</Label>
							<Select value={sourceId} onValueChange={setSourceId}>
								<SelectTrigger
									id="community-track-source"
									className="w-[220px]"
								>
									<SelectValue placeholder="Select a source" />
								</SelectTrigger>
								<SelectContent>
									{sources.map((source) => (
										<SelectItem key={source.id} value={source.id}>
											{source.owner}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label htmlFor="community-track-repo">Repository</Label>
							<Select
								value={fullName}
								onValueChange={setFullName}
								disabled={!sourceId || availableQuery.isLoading}
							>
								<SelectTrigger
									id="community-track-repo"
									className="w-[280px]"
								>
									<SelectValue
										placeholder={
											availableQuery.isLoading
												? "Loading repositories…"
												: "Select a repository"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{(availableQuery.data ?? []).map((repository) => (
										<SelectItem
											key={repository.fullName}
											value={repository.fullName}
										>
											{repository.fullName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Button
							disabled={
								trackRepository.isPending || !sourceId || !fullName
							}
							onClick={() =>
								trackRepository.mutate({ sourceId, fullName })
							}
						>
							Track
						</Button>
					</div>
				)}
				{availableQuery.error && (
					<p className="mt-2 text-xs text-muted-foreground">
						{availableQuery.error.message}
					</p>
				)}
			</div>

			<ConsoleSearch
				value={search}
				onChange={setSearch}
				placeholder="Search repositories"
				ariaLabel="Search tracked repositories"
				className="max-w-sm"
			/>

			{repositoriesQuery.isLoading ? (
				<ConsoleLoading label="Loading repositories" />
			) : repositoriesQuery.error ? (
				<AlertBlock type="error">
					{repositoriesQuery.error.message ||
						"Could not load the tracked repositories."}
				</AlertBlock>
			) : repositories.length === 0 ? (
				<ConsoleEmpty
					icon={Star}
					title="No repository tracked"
					description="Pick a repository above to start following its issues, pull requests, releases and activity."
				/>
			) : (
				<ConsoleTable
					table={table}
					empty="No repository matches the search."
				/>
			)}
		</div>
	);
};
