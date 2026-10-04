import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	ArrowLeft,
	ArrowUpDown,
	Cloud,
	CloudOff,
	Columns3,
	Download,
	ListTree,
	Loader2,
	PenBoxIcon,
	PlusIcon,
	Search,
	SlidersHorizontal,
	Trash2,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import {
	AddDnsRecordDialog,
	DNS_RECORD_TYPES,
	DnsRecordPanel,
	type DnsRecordValue,
	PROXIABLE_TYPES,
} from "./dns-record-panel";
import { DnsRecordTypeBadge } from "./dns-record-type-badge";

interface Props {
	dnsProviderId: string;
	zoneId: string;
}

const PAGE_SIZES = [10, 20, 50, 100];

const DISPLAY_COLUMNS = [
	{ id: "name", label: "Name" },
	{ id: "type", label: "Type" },
	{ id: "content", label: "Content" },
	{ id: "proxied", label: "Proxy status" },
	{ id: "ttl", label: "TTL" },
	{ id: "tags", label: "Tags" },
	{ id: "comment", label: "Comment" },
] as const;

const SortableHeader = ({
	column,
	title,
	className,
}: {
	column: {
		getIsSorted: () => false | "asc" | "desc";
		toggleSorting: (asc: boolean) => void;
	};
	title: string;
	className?: string;
}) => (
	<Button
		variant="ghost"
		size="xs"
		className={cn("-ml-2.5 text-muted-foreground", className)}
		onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
	>
		{title}
		<ArrowUpDown className="size-3" />
	</Button>
);

const StaticHeader = ({ title }: { title: string }) => (
	<span className="text-xs font-medium text-muted-foreground">{title}</span>
);

/** Cloudflare-style relative owner name (`@` for the apex). */
const relativeName = (name: string, zoneName: string) => {
	if (!zoneName) return name;
	if (name === zoneName || name === "@") return "@";
	if (name.endsWith(`.${zoneName}`)) {
		return name.slice(0, -(zoneName.length + 1));
	}
	return name;
};

export const ShowDnsRecords = ({ dnsProviderId, zoneId }: Props) => {
	const utils = api.useUtils();
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const [editing, setEditing] = useState<DnsRecordValue | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [importOpen, setImportOpen] = useState(false);
	const [importContent, setImportContent] = useState("");
	const [isExporting, setIsExporting] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "name", desc: false },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});

	const { data: provider } = api.dnsProvider.one.useQuery({ dnsProviderId });
	const { data: zones } = api.dnsProvider.listZones.useQuery({ dnsProviderId });
	const { data, isPending, isError, error } =
		api.dnsProvider.listRecords.useQuery({ dnsProviderId, zoneId });
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { mutateAsync: deleteRecord } =
		api.dnsProvider.deleteRecord.useMutation();
	const importZone = api.dnsProvider.importZone.useMutation();
	const exportQuery = api.dnsProvider.exportZone.useQuery(
		{ dnsProviderId, zoneId },
		{ enabled: false, retry: false },
	);

	const zoneName = zones?.find((zone) => zone.id === zoneId)?.name ?? "";
	const isCloudflare = provider?.providerType === "cloudflare";
	const canWrite = !!permissions?.dnsProvider.update;
	const canDelete = !!permissions?.dnsProvider.delete;

	const openEdit = (record: DnsRecordValue) => {
		setEditing(record);
		setIsPanelOpen(true);
	};

	const availableTypes = useMemo(
		() => [...new Set((data ?? []).map((record) => record.type))].sort(),
		[data],
	);

	const filteredRecords = useMemo(() => {
		const query = search.trim().toLowerCase();
		return (data ?? []).filter((record) => {
			if (typeFilter !== "all" && record.type !== typeFilter) return false;
			if (!query) return true;
			return (
				record.name.toLowerCase().includes(query) ||
				record.content.toLowerCase().includes(query) ||
				record.type.toLowerCase().includes(query) ||
				(record.comment ?? "").toLowerCase().includes(query) ||
				(record.tags ?? []).some((tag) => tag.toLowerCase().includes(query))
			);
		});
	}, [data, search, typeFilter]);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const result = await exportQuery.refetch();
			if (result.error || !result.data) {
				throw result.error ?? new Error("Export failed");
			}
			const blob = new Blob([result.data.content], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${result.data.zoneName || "zone"}.zone`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			toast.success("Zone exported");
		} catch {
			toast.error("Error exporting the zone");
		} finally {
			setIsExporting(false);
		}
	};

	const handleImport = async () => {
		if (!importContent.trim()) return;
		await importZone
			.mutateAsync({ dnsProviderId, zoneId, content: importContent })
			.then((result) => {
				utils.dnsProvider.listRecords.invalidate({ dnsProviderId, zoneId });
				if (result.failed > 0) {
					toast.warning(
						`Imported ${result.created} record${result.created === 1 ? "" : "s"}, ${result.failed} failed`,
					);
				} else {
					toast.success(
						`Imported ${result.created} record${result.created === 1 ? "" : "s"}`,
					);
				}
				setImportOpen(false);
				setImportContent("");
			})
			.catch(() => {
				toast.error("Error importing the zone");
			});
	};

	const handleDelete = async (record: DnsRecordValue) => {
		setDeletingId(record.id);
		await deleteRecord({ dnsProviderId, zoneId, recordId: record.id })
			.then(() => {
				toast.success("Record deleted");
				utils.dnsProvider.listRecords.invalidate({ dnsProviderId, zoneId });
				if (editing?.id === record.id) setIsPanelOpen(false);
			})
			.catch(() => {
				toast.error("Error deleting the record");
			})
			.finally(() => setDeletingId(null));
	};

	const columns = useMemo<ColumnDef<DnsRecordValue>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <SortableHeader column={column} title="Name" />,
				cell: ({ row }) => (
					<span
						className="block max-w-[26ch] truncate font-medium"
						title={row.original.name}
					>
						{relativeName(row.original.name, zoneName)}
					</span>
				),
			},
			{
				accessorKey: "type",
				header: ({ column }) => <SortableHeader column={column} title="Type" />,
				cell: ({ row }) => <DnsRecordTypeBadge type={row.original.type} />,
			},
			{
				accessorKey: "content",
				header: ({ column }) => (
					<SortableHeader column={column} title="Content" />
				),
				cell: ({ row }) => (
					<span
						className="block max-w-[38ch] truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
						title={row.original.content}
					>
						{row.original.content}
					</span>
				),
			},
			...(isCloudflare
				? [
						{
							accessorKey: "proxied",
							header: ({ column }) => (
								<SortableHeader column={column} title="Proxy status" />
							),
							cell: ({ row }) => {
								if (!PROXIABLE_TYPES.includes(row.original.type)) {
									return <span className="text-muted-foreground">—</span>;
								}
								const proxied = !!row.original.proxied;
								return (
									<span className="inline-flex items-center gap-1.5 text-xs">
										{proxied ? (
											<Cloud className="size-3.5 text-[#f6821f]" />
										) : (
											<CloudOff className="size-3.5 text-muted-foreground" />
										)}
										{proxied ? "Proxied" : "DNS only"}
									</span>
								);
							},
						} satisfies ColumnDef<DnsRecordValue>,
					]
				: []),
			{
				accessorKey: "ttl",
				header: ({ column }) => <SortableHeader column={column} title="TTL" />,
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground tabular-nums">
						{row.original.ttl === 1 ? "Auto" : row.original.ttl}
					</span>
				),
			},
			{
				accessorKey: "tags",
				enableSorting: false,
				header: () => <StaticHeader title="Tags" />,
				cell: ({ row }) => {
					const tags = row.original.tags ?? [];
					if (!tags.length) {
						return <span className="text-muted-foreground">—</span>;
					}
					return (
						<div className="flex flex-wrap gap-1">
							{tags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="text-[10px] font-normal"
								>
									{tag}
								</Badge>
							))}
						</div>
					);
				},
			},
			{
				accessorKey: "comment",
				enableSorting: false,
				header: () => <StaticHeader title="Comment" />,
				cell: ({ row }) => (
					<span
						className="block max-w-[28ch] truncate text-xs text-muted-foreground"
						title={row.original.comment}
					>
						{row.original.comment || "—"}
					</span>
				),
			},
			{
				id: "actions",
				enableSorting: false,
				enableHiding: false,
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => {
					const record = row.original;
					const isEditable = (DNS_RECORD_TYPES as readonly string[]).includes(
						record.type,
					);
					return (
						<div className="flex items-center justify-end gap-1">
							{canWrite && isEditable && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											className="text-muted-foreground"
											onClick={() => openEdit(record)}
										>
											<PenBoxIcon className="size-4" />
											<span className="sr-only">Edit record</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Edit record</TooltipContent>
								</Tooltip>
							)}
							{canDelete && (
								<Tooltip>
									<DialogAction
										title="Delete Record"
										description={`Delete the ${record.type} record "${record.name}"? This removes it from the DNS provider, not just from Notploy.`}
										type="destructive"
										onClick={() => handleDelete(record)}
									>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
												isLoading={deletingId === record.id}
											>
												<Trash2 className="size-4" />
												<span className="sr-only">Delete record</span>
											</Button>
										</TooltipTrigger>
									</DialogAction>
									<TooltipContent>Delete record</TooltipContent>
								</Tooltip>
							)}
						</div>
					);
				},
			},
		],
		[canWrite, canDelete, deletingId, editing?.id, isCloudflare, zoneName],
	);

	const visibleDisplayColumns = DISPLAY_COLUMNS.filter(
		(column) => column.id !== "proxied" || isCloudflare,
	);

	const pageCount = Math.max(
		1,
		Math.ceil(filteredRecords.length / pagination.pageSize),
	);
	const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);

	const resetToFirstPage = () =>
		setPagination((previous) => ({ ...previous, pageIndex: 0 }));

	const table = useReactTable({
		data: filteredRecords,
		columns,
		getRowId: (row) => row.id,
		state: {
			sorting,
			pagination: { pageIndex, pageSize: pagination.pageSize },
			columnVisibility,
		},
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<div className="w-full ">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<div className="flex flex-1 flex-row items-center gap-3">
							<Button variant="ghost" size="icon" asChild>
								<Link href={`/dashboard/settings/dns/${dnsProviderId}`}>
									<ArrowLeft className="size-4" />
									<span className="sr-only">Back to domains</span>
								</Link>
							</Button>
							<CardHeader className="flex-1 p-0">
								<CardTitle className="text-xl">
									DNS records for {zoneName || "this zone"}
								</CardTitle>
								<CardDescription>
									Manage how the internet finds your content, verifies services
									and routes traffic. Changes are written straight to{" "}
									{provider?.name ?? "the provider"}.
								</CardDescription>
							</CardHeader>
						</div>
					</div>

					<CardContent className="min-h-[60vh] border-t py-8">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
						<div className="flex flex-col-reverse gap-4 lg:flex-row lg:items-start">
							<div className="flex min-w-0 flex-1 flex-col gap-4">
								{isPending ? (
									<div className="flex min-h-[45vh] flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
										<span>Loading...</span>
										<Loader2 className="animate-spin size-4" />
									</div>
								) : data?.length === 0 ? (
									<div className="flex min-h-[45vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8">
										<div className="rounded-full bg-muted p-4">
											<ListTree className="size-10 text-muted-foreground" />
										</div>
										<div className="space-y-1 text-center">
											<p className="text-sm font-medium">
												No records in this zone
											</p>
											<p className="max-w-sm text-sm text-muted-foreground">
												Add an A or CNAME record to point this domain at one of
												your servers, or import an existing zone file.
											</p>
										</div>
										{canWrite && (
											<div className="flex items-center gap-2">
												<AddDnsRecordDialog
													dnsProviderId={dnsProviderId}
													zoneId={zoneId}
													zoneName={zoneName}
													trigger={
														<Button>
															<PlusIcon className="size-4" />
															Add record
														</Button>
													}
												/>
												<Button
													variant="outline"
													onClick={() => setImportOpen(true)}
												>
													<Upload className="size-4" />
													Import
												</Button>
											</div>
										)}
									</div>
								) : (
									<>
										<div className="flex flex-wrap items-center gap-2">
											<div className="relative min-w-52 flex-1">
												<FocusShortcutInput
													placeholder="Search DNS records"
													value={search}
													onChange={(e) => {
														setSearch(e.target.value);
														resetToFirstPage();
													}}
													className="pr-10"
												/>
												<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
											</div>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="outline" size="sm">
														<SlidersHorizontal className="size-4" />
														Filters
														{typeFilter !== "all" && (
															<Badge
																variant="secondary"
																className="ml-1 text-[10px]"
															>
																{typeFilter}
															</Badge>
														)}
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start" className="w-44">
													<DropdownMenuLabel>Type</DropdownMenuLabel>
													<DropdownMenuSeparator />
													<DropdownMenuRadioGroup
														value={typeFilter}
														onValueChange={(value) => {
															setTypeFilter(value);
															resetToFirstPage();
														}}
													>
														<DropdownMenuRadioItem value="all">
															All types
														</DropdownMenuRadioItem>
														{availableTypes.map((type) => (
															<DropdownMenuRadioItem key={type} value={type}>
																{type}
															</DropdownMenuRadioItem>
														))}
													</DropdownMenuRadioGroup>
												</DropdownMenuContent>
											</DropdownMenu>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="outline" size="sm">
														<Columns3 className="size-4" />
														Display options
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start" className="w-48">
													<DropdownMenuLabel>Columns</DropdownMenuLabel>
													<DropdownMenuSeparator />
													{visibleDisplayColumns.map((column) => (
														<DropdownMenuCheckboxItem
															key={column.id}
															checked={columnVisibility[column.id] !== false}
															onCheckedChange={(checked) =>
																setColumnVisibility((previous) => ({
																	...previous,
																	[column.id]: checked,
																}))
															}
														>
															{column.label}
														</DropdownMenuCheckboxItem>
													))}
												</DropdownMenuContent>
											</DropdownMenu>

											{canWrite && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => setImportOpen(true)}
												>
													<Upload className="size-4" />
													Import
												</Button>
											)}
											<Button
												variant="outline"
												size="sm"
												onClick={handleExport}
												isLoading={isExporting}
											>
												<Download className="size-4" />
												Export
											</Button>
											{canWrite && (
												<AddDnsRecordDialog
													dnsProviderId={dnsProviderId}
													zoneId={zoneId}
													zoneName={zoneName}
													trigger={
														<Button size="sm">
															<PlusIcon className="size-4" />
															Add record
														</Button>
													}
												/>
											)}
										</div>

										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground tabular-nums">
												{filteredRecords.length} record
												{filteredRecords.length === 1 ? "" : "s"}
												{filteredRecords.length !== (data?.length ?? 0) &&
													` of ${data?.length ?? 0}`}
											</span>
										</div>

										<div className="overflow-hidden rounded-lg border">
											<Table>
												<TableHeader className="[&_tr]:border-b">
													{table.getHeaderGroups().map((headerGroup) => (
														<TableRow
															key={headerGroup.id}
															className="bg-muted/40 hover:bg-muted/40"
														>
															{headerGroup.headers.map((header) => (
																<TableHead
																	key={header.id}
																	className={cn(
																		"h-9 px-4 text-xs",
																		header.id === "actions" && "text-right",
																	)}
																>
																	{header.isPlaceholder
																		? null
																		: flexRender(
																				header.column.columnDef.header,
																				header.getContext(),
																			)}
																</TableHead>
															))}
														</TableRow>
													))}
												</TableHeader>
												<TableBody>
													{table.getRowModel().rows.length ? (
														table.getRowModel().rows.map((row) => {
															const isEditable = (
																DNS_RECORD_TYPES as readonly string[]
															).includes(row.original.type);
															const isSelected =
																isPanelOpen && editing?.id === row.original.id;
															return (
																<TableRow
																	key={row.id}
																	data-state={
																		isSelected ? "selected" : undefined
																	}
																	onClick={
																		canWrite && isEditable
																			? () => openEdit(row.original)
																			: undefined
																	}
																	className={cn(
																		"duration-150 ease-out",
																		canWrite && isEditable && "cursor-pointer",
																	)}
																>
																	{row.getVisibleCells().map((cell) => (
																		<TableCell
																			key={cell.id}
																			onClick={
																				cell.column.id === "actions"
																					? (event) => event.stopPropagation()
																					: undefined
																			}
																			className="px-4 py-2"
																		>
																			{flexRender(
																				cell.column.columnDef.cell,
																				cell.getContext(),
																			)}
																		</TableCell>
																	))}
																</TableRow>
															);
														})
													) : (
														<TableRow className="hover:bg-transparent">
															<TableCell
																colSpan={table.getVisibleLeafColumns().length}
																className="h-24 text-center text-muted-foreground"
															>
																No records match your filters.
															</TableCell>
														</TableRow>
													)}
												</TableBody>
											</Table>
										</div>

										<div className="flex flex-wrap items-center justify-between gap-4">
											<div className="flex items-center gap-2">
												<span className="text-sm text-muted-foreground">
													Rows per page
												</span>
												<Select
													value={String(pagination.pageSize)}
													onValueChange={(value) =>
														setPagination({
															pageIndex: 0,
															pageSize: Number(value),
														})
													}
												>
													<SelectTrigger size="sm" className="w-20">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{PAGE_SIZES.map((size) => (
															<SelectItem key={size} value={String(size)}>
																{size}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="flex items-center gap-4">
												<span className="text-sm text-muted-foreground tabular-nums">
													Page {pageIndex + 1} of {pageCount}
												</span>
												<div className="flex gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => table.previousPage()}
														disabled={!table.getCanPreviousPage()}
													>
														Previous
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => table.nextPage()}
														disabled={!table.getCanNextPage()}
													>
														Next
													</Button>
												</div>
											</div>
										</div>
									</>
								)}
							</div>

							<div
								className={cn(
									"t-panel-track grid lg:shrink-0 lg:grid-rows-[1fr]",
									isPanelOpen
										? "grid-rows-[1fr] lg:grid-cols-[1fr]"
										: "grid-rows-[0fr] lg:grid-cols-[0fr]",
								)}
							>
								<div className="overflow-hidden">
									<div
										data-open={isPanelOpen}
										className="t-panel-slide-x w-full lg:w-95"
									>
										{canWrite && (
											<DnsRecordPanel
												key={editing?.id ?? "new"}
												dnsProviderId={dnsProviderId}
												zoneId={zoneId}
												zoneName={zoneName}
												record={editing}
												onClose={() => setIsPanelOpen(false)}
											/>
										)}
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</div>
			</Card>

			<Dialog open={importOpen} onOpenChange={setImportOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Import DNS records</DialogTitle>
						<DialogDescription>
							Paste a BIND-style zone file. Supported records are added to{" "}
							{zoneName || "this zone"}; unsupported entries (SOA, DNSSEC) are
							skipped.
						</DialogDescription>
					</DialogHeader>
					{importZone.isError && (
						<AlertBlock type="error">{importZone.error?.message}</AlertBlock>
					)}
					<Textarea
						value={importContent}
						onChange={(event) => setImportContent(event.target.value)}
						placeholder={
							"@\t3600\tIN\tA\t203.0.113.10\nwww\t3600\tIN\tCNAME\texample.com."
						}
						className="min-h-[220px] font-mono text-xs"
					/>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setImportOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleImport}
							isLoading={importZone.isPending}
							disabled={!importContent.trim()}
						>
							<Upload className="size-4" />
							Import records
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
