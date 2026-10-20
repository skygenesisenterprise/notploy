import { getDomainRequirements } from "@notploy/server/utils/domain-scope";
import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	CheckCircle2,
	ExternalLink,
	Loader2,
	PenBoxIcon,
	RefreshCw,
	Server,
	Trash2,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { OnionRowActions } from "@/components/dashboard/compose/onion/onion-row-actions";
import {
	type OnionServiceListItem,
	OnionStatusBadge,
} from "@/components/dashboard/compose/onion/onion-status";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RouterOutputs } from "@/utils/api";
import { DnsHelperModal } from "./dns-helper-modal";
import { AddDomain } from "./handle-domain";
import type { ValidationStates } from "./show-domains";

export type Domain =
	| RouterOutputs["domain"]["byApplicationId"][0]
	| RouterOutputs["domain"]["byComposeId"][0];

/**
 * A row of the domains list. A managed Tor Onion Service is not a DNS domain,
 * but it is another address the application can be reached at, so it shares the
 * same list. `onion` carries the resource itself; the borrowed `Domain` fields
 * only feed the sortable/filterable columns.
 */
export type DomainRow = Domain & {
	kind: "domain" | "onion";
	onion?: OnionServiceListItem;
};

export const toDomainRow = (domain: Domain): DomainRow => ({
	...domain,
	kind: "domain",
});

export const toOnionDomainRow = (
	onion: OnionServiceListItem & { createdAt?: string | Date },
): DomainRow => ({
	domainId: `onion-${onion.onionServiceId}`,
	host: onion.onionAddress ?? "",
	https: false,
	port: onion.targetPort,
	customEntrypoint: null,
	path: "/",
	serviceName: onion.serviceName,
	domainType: "compose",
	uniqueConfigKey: 0,
	createdAt: onion.createdAt
		? new Date(onion.createdAt).toISOString()
		: new Date().toISOString(),
	composeId: onion.composeId,
	compose: null,
	customCertResolver: null,
	applicationId: null,
	previewDeploymentId: null,
	certificateType: "none",
	cloudManaged: false,
	internalPath: "/",
	stripPath: false,
	middlewares: [],
	forwardAuthEnabled: false,
	enabled: true,
	kind: "onion",
	onion,
});

interface ColumnsProps {
	id: string;
	type: "application" | "compose";
	validationStates: ValidationStates;
	handleValidateDomain: (host: string) => Promise<void>;
	handleDeleteDomain: (domainId: string) => Promise<void>;
	handleToggleEnable: (domainId: string) => Promise<void>;
	isDeleting: boolean;
	isToggling: boolean;
	serverIp?: string;
	canCreateDomain: boolean;
	canDeleteDomain: boolean;
}

export const createColumns = ({
	id,
	type,
	validationStates,
	handleValidateDomain,
	handleDeleteDomain,
	handleToggleEnable,
	isDeleting,
	isToggling,
	serverIp,
	canCreateDomain,
	canDeleteDomain,
}: ColumnsProps): ColumnDef<DomainRow>[] => [
	...(type === "compose"
		? [
				{
					accessorKey: "serviceName",
					header: "Service",
					cell: ({ row }: { row: { getValue: (key: string) => unknown } }) => {
						const serviceName = row.getValue("serviceName") as string | null;
						if (!serviceName) return null;
						return (
							<Badge variant="outline">
								<Server className="size-3 mr-1" />
								{serviceName}
							</Badge>
						);
					},
				} satisfies ColumnDef<DomainRow>,
			]
		: []),
	{
		accessorKey: "host",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Host
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const domain = row.original;

			if (domain.kind === "onion") {
				return (
					<div className="flex items-center gap-2 font-medium">
						<span className="truncate font-mono text-sm">
							{domain.onion?.onionAddress ?? domain.host}
						</span>
						<Badge variant="outline">Tor</Badge>
					</div>
				);
			}

			const requirements = getDomainRequirements(domain.host);
			return (
				<Link
					className="flex items-center gap-2 font-medium hover:underline"
					target="_blank"
					href={`${domain.https ? "https" : "http"}://${domain.host}${domain.path}`}
				>
					{domain.host}
					<ExternalLink className="size-3" />
					<Badge variant="secondary" className="capitalize">
						{requirements.scope}
					</Badge>
				</Link>
			);
		},
	},
	{
		accessorKey: "path",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Path
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			if (row.original.kind === "onion") {
				return <span className="text-muted-foreground">-</span>;
			}

			const path = row.getValue("path") as string;
			return <div className="font-mono text-sm">{path || "/"}</div>;
		},
	},
	{
		accessorKey: "port",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Port
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const port = row.getValue("port") as number;
			return <Badge variant="secondary">{port}</Badge>;
		},
	},
	{
		accessorKey: "customEntrypoint",
		header: "Entrypoint",
		cell: ({ row }) => {
			const entrypoint = row.getValue("customEntrypoint") as string | null;
			if (!entrypoint) return <span className="text-muted-foreground">-</span>;
			return <div className="font-mono text-sm">{entrypoint}</div>;
		},
	},
	{
		accessorKey: "https",
		header: "Protocol",
		cell: ({ row }) => {
			if (row.original.kind === "onion") {
				return <Badge variant="outline">Tor</Badge>;
			}

			const https = row.getValue("https") as boolean;
			return (
				<Badge variant={https ? "outline" : "secondary"}>
					{https ? "HTTPS" : "HTTP"}
				</Badge>
			);
		},
	},
	{
		id: "certificate",
		header: "Certificate",
		cell: ({ row }) => {
			const domain = row.original;

			// An onion address is its own certificate: there is no ACME here.
			if (domain.kind === "onion") {
				return (
					<Badge variant="outline" className="capitalize">
						Self-authenticated
					</Badge>
				);
			}

			const validationState = validationStates[domain.host];
			const requiresPublicDns = getDomainRequirements(
				domain.host,
			).requiresPublicDns;

			return (
				<div className="flex items-center gap-2">
					{domain.certificateType && (
						<Badge variant="outline" className="capitalize">
							{domain.certificateType}
						</Badge>
					)}
					{requiresPublicDns && !domain.host.includes("sslip.io") && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										className={
											validationState?.isValid
												? "bg-green-500/10 text-green-500 cursor-pointer"
												: validationState?.error
													? "bg-red-500/10 text-red-500 cursor-pointer"
													: "bg-yellow-500/10 text-yellow-500 cursor-pointer"
										}
										onClick={() => handleValidateDomain(domain.host)}
									>
										{validationState?.isLoading ? (
											<>
												<Loader2 className="size-3 mr-1 animate-spin" />
												Checking...
											</>
										) : validationState?.isValid ? (
											<>
												<CheckCircle2 className="size-3 mr-1" />
												{validationState.message && validationState.cdnProvider
													? `${validationState.cdnProvider}`
													: "Valid"}
											</>
										) : validationState?.error ? (
											<>
												<XCircle className="size-3 mr-1" />
												Invalid
											</>
										) : (
											<>
												<RefreshCw className="size-3 mr-1" />
												Validate
											</>
										)}
									</Badge>
								</TooltipTrigger>
								<TooltipContent className="max-w-xs">
									{validationState?.isValid && validationState?.message ? (
										<p>{validationState.message}</p>
									) : validationState?.error ? (
										<div className="flex flex-col gap-1">
											<p className="font-medium text-red-500">Error:</p>
											<p>{validationState.error}</p>
										</div>
									) : (
										"Click to validate DNS configuration"
									)}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Created
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const createdAt = row.getValue("createdAt") as string;
			return (
				<div className="text-sm text-muted-foreground">
					{new Date(createdAt).toLocaleDateString()}
				</div>
			);
		},
	},
	{
		id: "status",
		header: "Status",
		cell: ({ row }) => {
			const domain = row.original;

			if (domain.kind === "onion" && domain.onion) {
				return <OnionStatusBadge status={domain.onion.status} />;
			}

			if (!canCreateDomain) {
				return (
					<Badge variant={domain.enabled ? "outline" : "secondary"}>
						{domain.enabled ? "Enabled" : "Disabled"}
					</Badge>
				);
			}
			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center">
								<Switch
									checked={domain.enabled}
									onCheckedChange={() => handleToggleEnable(domain.domainId)}
									disabled={isToggling}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{domain.enabled
									? "Domain is active. Toggle to disable routing without deleting it."
									: "Domain is disabled and not routed. Toggle to enable it again."}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			);
		},
	},
	{
		id: "actions",
		header: "Actions",
		enableHiding: false,
		cell: ({ row }) => {
			const domain = row.original;

			if (domain.kind === "onion" && domain.onion) {
				return <OnionRowActions onionService={domain.onion} />;
			}

			const { requiresPublicDns } = getDomainRequirements(domain.host);

			return (
				<div className="flex items-center gap-2">
					{requiresPublicDns && !domain.host.includes("sslip.io") && (
						<DnsHelperModal
							domain={{
								host: domain.host,
								https: domain.https,
								path: domain.path || undefined,
							}}
							serverIp={serverIp}
						/>
					)}
					{canCreateDomain && (
						<AddDomain id={id} type={type} domainId={domain.domainId}>
							<Button
								variant="ghost"
								size="icon"
								className="group hover:bg-blue-500/10 h-8 w-8"
							>
								<PenBoxIcon className="size-3.5 text-primary group-hover:text-blue-500" />
							</Button>
						</AddDomain>
					)}
					{canDeleteDomain && (
						<DialogAction
							title="Delete Domain"
							description="Are you sure you want to delete this domain?"
							type="destructive"
							onClick={async () => {
								await handleDeleteDomain(domain.domainId);
							}}
						>
							<Button
								variant="ghost"
								size="icon"
								className="group hover:bg-red-500/10 h-8 w-8"
								isLoading={isDeleting}
							>
								<Trash2 className="size-4 text-primary group-hover:text-red-500" />
							</Button>
						</DialogAction>
					)}
				</div>
			);
		},
	},
];
