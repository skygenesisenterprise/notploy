"use client";

import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ChevronDown,
	ChevronRight,
	Server,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleBody,
	ConsoleDetailValue,
	ConsoleEmpty,
	ConsoleError,
	ConsoleHeader,
	ConsoleLoading,
	ConsoleNoMatch,
	ConsoleRefresh,
	ConsoleSearch,
	ConsoleShell,
	ConsoleSummary,
	ConsoleTable,
	ConsoleToolbar,
	SortableHeader,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api, type RouterOutputs } from "@/utils/api";
import { HandleCertificate } from "./handle-certificate";
import {
	type CertificateLifecycleStatus,
	countChainCertificates,
	describeChainEntry,
	describeExpiration,
} from "./utils";

type Certificate = RouterOutputs["certificates"]["all"][number];

const STATUS_FILTERS: Array<{
	value: "all" | CertificateLifecycleStatus;
	label: string;
}> = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Valid" },
	{ value: "expiring", label: "Expiring soon" },
	{ value: "expired", label: "Expired" },
	{ value: "pending", label: "Not valid yet" },
];

const statusBadgeVariant = (
	status: CertificateLifecycleStatus,
): "green" | "secondary" | "outline" | "red" =>
	status === "active"
		? "green"
		: status === "expired"
			? "red"
			: status === "expiring"
				? "secondary"
				: "outline";

const statusLabel = (status: CertificateLifecycleStatus) =>
	STATUS_FILTERS.find((filter) => filter.value === status)?.label ?? status;

export const ShowCertificates = () => {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | CertificateLifecycleStatus
	>("all");
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "name", desc: false },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const [selectedCertificate, setSelectedCertificate] =
		useState<Certificate | null>(null);
	const { mutateAsync, isPending: isRemoving } =
		api.certificates.remove.useMutation();
	const { data, isPending, isError, error, refetch, isRefetching } =
		api.certificates.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const certificates = useMemo(() => data ?? [], [data]);
	const canCreate = !!permissions?.certificate.create;
	const canUpdate = !!permissions?.certificate.update;
	const canDelete = !!permissions?.certificate.delete;

	const counts = useMemo(() => {
		const result: Record<CertificateLifecycleStatus, number> = {
			active: 0,
			expiring: 0,
			expired: 0,
			pending: 0,
		};
		for (const certificate of certificates) {
			result[certificate.status] += 1;
		}
		return result;
	}, [certificates]);

	const filteredCertificates = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		return certificates.filter((certificate) => {
			const matchesSearch =
				!query ||
				[
					certificate.name,
					certificate.commonName,
					certificate.issuer,
					certificate.certificatePath,
					...certificate.subjectAltNames,
					certificate.server?.name ?? "",
				]
					.filter(Boolean)
					.join(" ")
					.toLocaleLowerCase()
					.includes(query);
			return (
				matchesSearch &&
				(statusFilter === "all" || certificate.status === statusFilter)
			);
		});
	}, [certificates, search, statusFilter]);

	const clearFilters = () => {
		setSearch("");
		setStatusFilter("all");
	};

	const removeCertificate = useCallback(
		async (certificateId: string) => {
			try {
				await mutateAsync({ certificateId });
				toast.success("Certificate deleted successfully");
				await refetch();
			} catch (removeError) {
				toast.error(
					removeError instanceof Error
						? removeError.message
						: "Error deleting certificate",
				);
			}
		},
		[mutateAsync, refetch],
	);

	const columns = useMemo<ColumnDef<Certificate>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <SortableHeader column={column} title="Name" />,
				cell: ({ row }) => (
					<div className="space-y-1">
						<span className="font-medium">{row.original.name}</span>
						<span className="block font-mono text-xs text-muted-foreground">
							{row.original.certificatePath}
						</span>
					</div>
				),
			},
			{
				accessorKey: "commonName",
				header: ({ column }) => (
					<SortableHeader column={column} title="Common name" />
				),
				cell: ({ row }) =>
					row.original.commonName ?? (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				id: "hosts",
				accessorFn: (row) => row.subjectAltNames.join(", "),
				header: ({ column }) => (
					<SortableHeader column={column} title="Hosts" />
				),
				enableSorting: false,
				cell: ({ row }) =>
					row.original.subjectAltNames.length ? (
						<span className="block max-w-64 truncate">
							{row.original.subjectAltNames.join(", ")}
						</span>
					) : (
						<span className="text-muted-foreground">Not available</span>
					),
			},
			{
				id: "server",
				accessorFn: (row) => row.server?.name ?? "Notploy (Local)",
				header: ({ column }) => (
					<SortableHeader column={column} title="Server" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-1.5">
						<Server className="size-3.5 text-muted-foreground" aria-hidden />
						<span>
							{row.original.server
								? `${row.original.server.name} (${row.original.server.ipAddress})`
								: "Notploy (Local)"}
						</span>
					</div>
				),
			},
			{
				id: "chain",
				accessorFn: (row) => countChainCertificates(row.certificateData),
				header: ({ column }) => (
					<SortableHeader column={column} title="Chain" />
				),
				cell: ({ row }) => {
					const chainCount = countChainCertificates(row.certificateData);
					return chainCount > 1 ? (
						<Badge variant="outline">{chainCount} certificates</Badge>
					) : (
						<span className="text-muted-foreground">Leaf only</span>
					);
				},
			},
			{
				id: "expiration",
				accessorFn: (row) => row.daysUntilExpiration ?? Number.MAX_SAFE_INTEGER,
				header: ({ column }) => (
					<SortableHeader column={column} title="Expiration" />
				),
				cell: ({ row }) => {
					const expiration = describeExpiration(row.original);
					return (
						<Badge variant={statusBadgeVariant(row.original.status)}>
							{expiration.message}
						</Badge>
					);
				},
			},
			{
				id: "actions",
				enableSorting: false,
				header: () => <span className="sr-only">Actions</span>,
				cell: ({ row }) => (
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setSelectedCertificate(row.original)}
						>
							Inspect
						</Button>
						{canUpdate && (
							<HandleCertificate certificateId={row.original.certificateId} />
						)}
						{canDelete && (
							<DialogAction
								title="Delete Certificate"
								description={`Are you sure you want to delete "${row.original.name}"? This cannot be undone.`}
								type="destructive"
								onClick={() => removeCertificate(row.original.certificateId)}
							>
								<Button
									variant="ghost"
									size="icon"
									className="text-destructive hover:bg-destructive/10 hover:text-destructive"
									aria-label={`Delete ${row.original.name}`}
									isLoading={isRemoving}
								>
									<Trash2 className="size-4" aria-hidden />
								</Button>
							</DialogAction>
						)}
					</div>
				),
			},
		],
		[canUpdate, canDelete, isRemoving, removeCertificate],
	);

	const table = useReactTable({
		data: filteredCertificates,
		columns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<ConsoleShell>
			<ConsoleHeader
				icon={ShieldCheck}
				title="Certificates"
				description="Create certificates in the Traefik directory."
				actions={
					<>
						<ConsoleRefresh
							onClick={() => void refetch()}
							isRefetching={isRefetching}
							disabled={isPending}
						/>
						{canCreate && <HandleCertificate />}
					</>
				}
			/>

			<ConsoleBody>
				<AlertBlock type="info">
					Certificates are created in the Traefik directory and picked up by
					Traefik automatically. Private keys are encrypted at rest and never
					returned by the API.
				</AlertBlock>

				{!isPending && !isError && certificates.length > 0 && (
					<>
						<ConsoleSummary>
							<SummaryMetric label="Certificates" value={certificates.length} />
							<SummaryMetric label="Valid" value={counts.active} />
							<SummaryMetric label="Expiring soon" value={counts.expiring} />
							<SummaryMetric
								label="Expired"
								value={counts.expired}
								detail={
									counts.pending > 0
										? `${counts.pending} not valid yet`
										: undefined
								}
							/>
						</ConsoleSummary>
						<ConsoleToolbar className="sm:grid-cols-[minmax(14rem,1fr)_12rem]">
							<ConsoleSearch
								value={search}
								onChange={setSearch}
								placeholder="Search name, hosts, issuer, server…"
								ariaLabel="Search certificates"
							/>
							<Select
								value={statusFilter}
								onValueChange={(value: "all" | CertificateLifecycleStatus) =>
									setStatusFilter(value)
								}
							>
								<SelectTrigger aria-label="Filter by certificate status">
									<SelectValue placeholder="All statuses" />
								</SelectTrigger>
								<SelectContent>
									{STATUS_FILTERS.map((filter) => (
										<SelectItem key={filter.value} value={filter.value}>
											{filter.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</ConsoleToolbar>
					</>
				)}

				{isPending ? (
					<ConsoleLoading label="Loading certificates…" />
				) : isError ? (
					<ConsoleError
						message={error?.message ?? "Could not load certificates."}
						onRetry={() => void refetch()}
					/>
				) : certificates.length === 0 ? (
					<ConsoleEmpty
						icon={ShieldCheck}
						title="No certificates created"
						description="Certificates are stored in the Traefik directory and picked up automatically. Import a certificate to secure your domains."
					/>
				) : filteredCertificates.length === 0 ? (
					<ConsoleNoMatch
						message="No certificates match these search and filter settings."
						onClear={clearFilters}
					/>
				) : (
					<>
						<ConsoleTable
							table={table}
							empty="No certificates match these search and filter settings."
						/>
						<p className="text-xs text-muted-foreground">
							{filteredCertificates.length} of {certificates.length}{" "}
							certificates
							{statusFilter !== "all" ? ` · ${statusLabel(statusFilter)}` : ""}
						</p>
					</>
				)}

				<Dialog
					open={Boolean(selectedCertificate)}
					onOpenChange={(open) => {
						if (!open) setSelectedCertificate(null);
					}}
				>
					{selectedCertificate && (
						<CertificateSummary certificate={selectedCertificate} />
					)}
				</Dialog>
			</ConsoleBody>
		</ConsoleShell>
	);
};

/**
 * Chain detail is fetched on demand and parsed server side: the browser never
 * runs ASN.1 parsing on certificate material.
 */
export const ChainDetails = ({ certificateId }: { certificateId: string }) => {
	const { data, isPending } = api.certificates.chain.useQuery({
		certificateId,
	});

	if (isPending) {
		return (
			<div className="border-l-2 border-muted pl-2 text-xs text-muted-foreground">
				Loading chain…
			</div>
		);
	}

	if (!data?.length) {
		return (
			<div className="border-l-2 border-muted pl-2 text-xs text-muted-foreground">
				No chain detail available.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 border-l-2 border-muted pl-2">
			{data.map((entry) => {
				const detail = describeChainEntry(entry);
				return (
					<div
						key={entry.index}
						className="flex flex-col gap-1 rounded-md bg-muted/30 p-2"
					>
						<span className="text-xs font-medium text-muted-foreground">
							{detail.label}
						</span>
						{entry.commonName && (
							<span className="text-xs text-muted-foreground/80">
								CN: {entry.commonName}
							</span>
						)}
						<span className={`text-xs ${detail.className}`}>
							{detail.message}
						</span>
					</div>
				);
			})}
		</div>
	);
};

export const CertificateChain = ({
	certificateId,
	chainCount,
}: {
	certificateId: string;
	chainCount: number;
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className="mt-1 flex flex-col gap-1.5">
			<button
				type="button"
				onClick={() => setIsExpanded((current) => !current)}
				className="flex w-fit items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 transition-colors hover:bg-muted"
				aria-expanded={isExpanded}
			>
				{isExpanded ? (
					<ChevronDown className="size-3 text-muted-foreground" />
				) : (
					<ChevronRight className="size-3 text-muted-foreground" />
				)}
				<span className="text-xs text-muted-foreground">
					Chain ({chainCount} certificates)
				</span>
			</button>
			{isExpanded && <ChainDetails certificateId={certificateId} />}
		</div>
	);
};

export const CertificateSummary = ({
	certificate,
}: {
	certificate: Certificate;
}) => {
	const expiration = describeExpiration(certificate);
	return (
		<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
					{certificate.name}
				</DialogTitle>
				<DialogDescription>
					Stored certificate metadata. Private keys never leave the server.
				</DialogDescription>
			</DialogHeader>
			<div className="space-y-4">
				<dl className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
					<ConsoleDetailValue label="Status">
						<Badge variant={statusBadgeVariant(certificate.status)}>
							{statusLabel(certificate.status)}
						</Badge>
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Expiration">
						{expiration.message}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Common name">
						{certificate.commonName ?? "Not available"}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Issuer">
						{certificate.issuer ?? "Not available"}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Valid from">
						{certificate.notBefore
							? new Date(certificate.notBefore).toLocaleString()
							: "Not available"}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Valid until">
						{certificate.notAfter
							? new Date(certificate.notAfter).toLocaleString()
							: "Not available"}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Directory">
						<code className="break-all text-xs">
							{certificate.certificatePath}
						</code>
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Server">
						{certificate.server
							? `${certificate.server.name} (${certificate.server.ipAddress})`
							: "Notploy (Local)"}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Created">
						{new Date(certificate.createdAt).toLocaleString()}
					</ConsoleDetailValue>
					<ConsoleDetailValue label="Updated">
						{new Date(certificate.updatedAt).toLocaleString()}
					</ConsoleDetailValue>
				</dl>

				<section className="space-y-2">
					<h3 className="font-medium">Hosts</h3>
					{certificate.subjectAltNames.length ? (
						<div className="flex flex-wrap gap-2">
							{certificate.subjectAltNames.map((host) => (
								<Badge key={host} variant="outline">
									{host}
								</Badge>
							))}
						</div>
					) : (
						<p className="rounded-md border p-4 text-sm text-muted-foreground">
							No subject alternative name reported.
						</p>
					)}
				</section>

				<CertificateChain
					certificateId={certificate.certificateId}
					chainCount={countChainCertificates(certificate.certificateData)}
				/>
			</div>
		</DialogContent>
	);
};
