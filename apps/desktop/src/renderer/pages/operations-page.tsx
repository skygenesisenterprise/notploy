/**
 * The instance-configuration catalog.
 *
 * Five sections — Tags, Certificates, SSH keys, Registries, Destinations — with
 * one page between them. They are the same screen five times: a table of
 * configured things, with the fields that identify them and nothing to edit.
 * Writing five near-identical files would mean five places to fix a token or a
 * column, so the differences live in {@link CATALOGS} instead and the layout
 * lives here. `databases-page.tsx` does the same thing for six database engines.
 *
 * **Two properties every one of these rows shares:**
 *
 * 1. *The payload carries credential material.* An SSH key arrives with its
 *    private half, a certificate with its private key, a registry with its
 *    password, a destination with its secret access key. The main process strips
 *    that before the payload crosses the bridge (see the normalizers in
 *    `@/shared/domain`), which is why this page can render a row without ever
 *    deciding what to hide. The footnote under each table says so out loud,
 *    because "we do not show your private key" is worth stating once.
 * 2. *Editing belongs to the dashboard.* Creating any of them means submitting
 *    key material or a password, and those forms already exist there. The
 *    catalog links to them rather than reimplementing a worse version — the same
 *    stance the notifications page takes.
 *
 * What it does add over the dashboard is the native affordance: any value worth
 * pasting elsewhere (an SSH public key, a registry URL, a certificate path) is
 * copied through the **main process** clipboard, with a toast confirming it.
 */

import {
	Archive,
	Check,
	Copy,
	ExternalLink,
	KeyRound,
	Package,
	RefreshCw,
	ShieldCheck,
	Tags,
} from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";
import {
	Button,
	EmptyState,
	ErrorNote,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	StatusBadge,
	TableShell,
	Td,
	Th,
	Tr,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { getBridge } from "@/renderer/lib/bridge";
import { relativeTime } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import type {
	Certificate,
	Destination,
	Registry,
	SshKey,
	Tag,
} from "@/shared/domain";

/** The catalog sections this page serves. Matches the route ids. */
export type OperationsKind =
	| "tags"
	| "certificates"
	| "ssh-keys"
	| "registries"
	| "destinations";

interface OperationsRows {
	tags: Tag;
	certificates: Certificate;
	"ssh-keys": SshKey;
	registries: Registry;
	destinations: Destination;
}

interface CatalogColumn<T> {
	header: string;
	cell: (row: T) => React.ReactNode;
}

interface CatalogConfig<T> {
	title: string;
	description: string;
	/** Where the create/edit forms live in the dashboard. */
	dashboardPath: string;
	panelTitle: string;
	panelDescription: string;
	emptyTitle: string;
	emptyDescription: string;
	icon: React.ReactNode;
	load: () => Promise<T[]>;
	keyOf: (row: T) => string;
	columns: Array<CatalogColumn<T>>;
	/**
	 * A value on the row that is worth putting on the clipboard. Returning
	 * `undefined` (the field is missing) hides the button rather than copying
	 * an empty string.
	 */
	copyValue?: (row: T) => string | undefined;
	copyLabel?: string;
}

/**
 * True for `#rgb` / `#rrggbb` and nothing else.
 *
 * Tag colours come from the instance and end up in an inline `style`. A value
 * that is not a hex colour is dropped rather than passed through, so a stored
 * `red; background: url(...)` can never become CSS.
 */
function isHexColor(value: string | null | undefined): value is string {
	return (
		typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
	);
}

function Mono({ children }: { children: React.ReactNode }) {
	return <span className="font-mono text-xs">{children}</span>;
}

function Muted({ children }: { children: React.ReactNode }) {
	return <span className="text-muted-foreground">{children}</span>;
}

const CATALOGS: { [K in OperationsKind]: CatalogConfig<OperationsRows[K]> } = {
	tags: {
		title: "Tags",
		description:
			"Labels defined on this instance. Tags are attached to projects from the dashboard; here they are the vocabulary the rest of the app is labelled with.",
		dashboardPath: "settings/tags",
		panelTitle: "Tags",
		panelDescription: "Every tag defined for this organization.",
		emptyTitle: "No tag defined",
		emptyDescription:
			"This instance has no tag yet. They are created from the dashboard's tag manager.",
		icon: <Tags aria-hidden className="size-8" />,
		load: () => getBridge().operations.tags(),
		keyOf: (row) => row.tagId,
		columns: [
			{
				header: "Name",
				cell: (row) => (
					<span className="flex items-center gap-2">
						{isHexColor(row.color) ? (
							<span
								aria-hidden
								className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/20"
								style={{ backgroundColor: row.color }}
							/>
						) : (
							<span
								aria-hidden
								className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
							/>
						)}
						<span className="text-foreground">{row.name}</span>
					</span>
				),
			},
			{
				header: "Colour",
				cell: (row) =>
					isHexColor(row.color) ? <Mono>{row.color}</Mono> : <Muted>—</Muted>,
			},
			{
				header: "Created",
				cell: (row) => <Muted>{relativeTime(row.createdAt)}</Muted>,
			},
		],
	},

	certificates: {
		title: "Certificates",
		description:
			"TLS certificates stored on this instance, the path each one is written to, and whether it renews on its own.",
		dashboardPath: "settings/certificates",
		panelTitle: "Certificates",
		panelDescription:
			"Certificate material and private keys remain on the instance.",
		emptyTitle: "No certificate",
		emptyDescription:
			"This instance holds no TLS certificate. They are uploaded from the dashboard.",
		icon: <ShieldCheck aria-hidden className="size-8" />,
		load: () => getBridge().operations.certificates(),
		keyOf: (row) => row.certificateId,
		copyValue: (row) => row.certificatePath,
		copyLabel: "Copy path",
		columns: [
			{
				header: "Name",
				cell: (row) => <span className="text-foreground">{row.name}</span>,
			},
			{
				header: "Path",
				cell: (row) =>
					row.certificatePath ? (
						<Mono>{row.certificatePath}</Mono>
					) : (
						<Muted>—</Muted>
					),
			},
			{
				header: "Renewal",
				cell: (row) =>
					row.autoRenew ? (
						<StatusBadge label="automatic" tone="ok" />
					) : (
						<StatusBadge label="manual" tone="muted" />
					),
			},
			{
				header: "Material",
				cell: (row) =>
					row.hasCertificateData && row.hasPrivateKey ? (
						<StatusBadge label="complete" tone="ok" />
					) : (
						// A certificate whose key half is missing cannot be written
						// out; saying so here is cheaper than a failed deployment.
						<StatusBadge label="incomplete" tone="warn" />
					),
			},
			{
				header: "Server",
				cell: (row) =>
					row.serverId ? (
						<Mono>{row.serverId}</Mono>
					) : (
						<Muted>is not set</Muted>
					),
			},
		],
	},

	"ssh-keys": {
		title: "SSH keys",
		description:
			"Key pairs this instance uses to reach servers and repositories. Public keys are safe to copy; private keys never leave the instance.",
		dashboardPath: "settings/ssh-keys",
		panelTitle: "SSH keys",
		panelDescription: "Pairs stored for this organization, newest first.",
		emptyTitle: "No SSH key",
		emptyDescription:
			"This instance has no key pair. Applications that clone over SSH need one; add it from the dashboard.",
		icon: <KeyRound aria-hidden className="size-8" />,
		load: () => getBridge().operations.sshKeys(),
		keyOf: (row) => row.sshKeyId,
		copyValue: (row) => row.publicKey,
		copyLabel: "Copy public key",
		columns: [
			{
				header: "Name",
				cell: (row) => <span className="text-foreground">{row.name}</span>,
			},
			{
				header: "Description",
				cell: (row) =>
					row.description ? <span>{row.description}</span> : <Muted>—</Muted>,
			},
			{
				header: "Last used",
				cell: (row) =>
					row.lastUsedAt ? (
						<span>{relativeTime(row.lastUsedAt)}</span>
					) : (
						<Muted>never</Muted>
					),
			},
			{
				header: "Created",
				cell: (row) => <Muted>{relativeTime(row.createdAt)}</Muted>,
			},
		],
	},

	registries: {
		title: "Registries",
		description:
			"Container registries deployments pull from and push to, with the account and image prefix in use.",
		dashboardPath: "settings/registry",
		panelTitle: "Registries",
		panelDescription: "Registry passwords are held by the instance only.",
		emptyTitle: "No registry",
		emptyDescription:
			"No private registry is configured. Deployments pull from the default public registries until one is added, from the dashboard.",
		icon: <Package aria-hidden className="size-8" />,
		load: () => getBridge().operations.registries(),
		keyOf: (row) => row.registryId,
		copyValue: (row) => row.registryUrl,
		copyLabel: "Copy URL",
		columns: [
			{
				header: "Name",
				cell: (row) => (
					<span className="text-foreground">{row.registryName}</span>
				),
			},
			{
				header: "URL",
				cell: (row) =>
					row.registryUrl ? <Mono>{row.registryUrl}</Mono> : <Muted>—</Muted>,
			},
			{
				header: "Account",
				cell: (row) =>
					row.username ? <span>{row.username}</span> : <Muted>—</Muted>,
			},
			{
				header: "Image prefix",
				cell: (row) =>
					row.imagePrefix ? (
						<Mono>{row.imagePrefix}</Mono>
					) : (
						<Muted>none</Muted>
					),
			},
			{
				header: "Created",
				cell: (row) => <Muted>{relativeTime(row.createdAt)}</Muted>,
			},
		],
	},

	destinations: {
		title: "Destinations",
		description:
			"Object-storage destinations backups are written to. Access keys stay on the instance; only the bucket and endpoint are shown.",
		dashboardPath: "settings/destinations",
		panelTitle: "Destinations",
		panelDescription: "Buckets this instance can write backups to.",
		emptyTitle: "No destination",
		emptyDescription:
			"No backup destination is configured. Database and volume backups need one, and it is added from the dashboard.",
		icon: <Archive aria-hidden className="size-8" />,
		load: () => getBridge().operations.destinations(),
		keyOf: (row) => row.destinationId,
		copyValue: (row) => row.endpoint,
		copyLabel: "Copy endpoint",
		columns: [
			{
				header: "Name",
				cell: (row) => <span className="text-foreground">{row.name}</span>,
			},
			{
				header: "Provider",
				cell: (row) =>
					row.provider ? <span>{row.provider}</span> : <Muted>—</Muted>,
			},
			{
				header: "Bucket",
				cell: (row) =>
					row.bucket ? <Mono>{row.bucket}</Mono> : <Muted>—</Muted>,
			},
			{
				header: "Region",
				cell: (row) => <Muted>{row.region ?? "—"}</Muted>,
			},
			{
				header: "Endpoint",
				cell: (row) =>
					row.endpoint ? <Mono>{row.endpoint}</Mono> : <Muted>—</Muted>,
			},
			{
				header: "Created",
				cell: (row) => <Muted>{relativeTime(row.createdAt)}</Muted>,
			},
		],
	},
};

/**
 * The one page. Generic over the row type so each catalog's columns and helpers
 * are typed against its own entity rather than against `unknown`.
 */
function Catalog<T>({
	config,
	connection,
	refreshToken,
}: { config: CatalogConfig<T> } & InstancePageProps) {
	const state = useAsync(config.load, [connection?.id, refreshToken]);
	const rows = state.data ?? [];

	const copy = async (value: string | undefined) => {
		if (!value) return;
		try {
			await getBridge().app.copyText(value);
			toast.success("Copied to the clipboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "The copy failed.");
		}
	};

	const hasCopy = Boolean(config.copyValue);

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title={config.title}
				description={config.description}
				actions={
					<>
						<Button
							onClick={() =>
								void getBridge().app.openExternal(
									`${connection?.url ?? ""}/dashboard/${config.dashboardPath}`,
								)
							}
						>
							<ExternalLink aria-hidden className="size-3.5" />
							Manage in the dashboard
						</Button>
						<Button onClick={state.reload} busy={state.loading}>
							<RefreshCw aria-hidden className="size-3.5" />
							Refresh
						</Button>
					</>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{state.error ? (
					<ErrorNote error={state.error} onRetry={state.reload} />
				) : null}
				{state.loading && !state.data ? <LoadingState /> : null}

				{state.data && rows.length === 0 ? (
					<EmptyState
						icon={config.icon}
						title={config.emptyTitle}
						description={config.emptyDescription}
					/>
				) : null}

				{rows.length > 0 ? (
					<Panel>
						<PanelHeader
							title={config.panelTitle}
							description={config.panelDescription}
						/>
						<TableShell
							head={
								<>
									{config.columns.map((column) => (
										<Th key={column.header}>{column.header}</Th>
									))}
									{hasCopy ? (
										<Th className="w-0 text-right">
											<span className="sr-only">Actions</span>
										</Th>
									) : null}
								</>
							}
						>
							{rows.map((row) => {
								const value = config.copyValue?.(row);
								return (
									<Tr key={config.keyOf(row)}>
										{config.columns.map((column) => (
											<Td key={column.header}>{column.cell(row)}</Td>
										))}
										{hasCopy ? (
											<Td className="text-right">
												{value ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => void copy(value)}
													>
														<Copy aria-hidden className="size-3.5" />
														{config.copyLabel ?? "Copy"}
													</Button>
												) : (
													<Muted>—</Muted>
												)}
											</Td>
										) : null}
									</Tr>
								);
							})}
						</TableShell>
					</Panel>
				) : null}

				{/* Stated once, at the bottom, rather than repeated per column. */}
				<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Check aria-hidden className="size-3.5" />
					Private keys, registry passwords and access keys are removed by the
					desktop client before any of this reaches the window.
				</p>
			</div>
		</div>
	);
}

/** The section entry point. `kind` is fixed per route in `app.tsx`. */
export function OperationsPage({
	kind,
	...props
}: InstancePageProps & { kind: OperationsKind }) {
	return (
		<Catalog
			config={CATALOGS[kind] as CatalogConfig<OperationsRows[OperationsKind]>}
			{...props}
		/>
	);
}
