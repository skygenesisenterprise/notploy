/**
 * Infrastructure.
 *
 * One server selector drives every tab, because every Docker read accepts an
 * optional `serverId` — that is the API's own model, not a convenience invented
 * here. Container actions are the only destructive part and go through the
 * confirmation dialog when `confirmDestructiveActions` is on.
 */

import {
	Boxes,
	HardDrive,
	Layers,
	Network,
	Play,
	RefreshCw,
	RotateCw,
	Square,
	Trash2,
	Zap,
} from "lucide-react";
import * as React from "react";
import {
	Button,
	CodeBlock,
	EmptyState,
	ErrorNote,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	Select,
	TableShell,
	Td,
	Th,
	Tr,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { useConfirm } from "@/renderer/hooks/use-confirm";
import { usePreferences } from "@/renderer/hooks/use-preferences";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import { relativeTime, shorten } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import type { DockerContainer } from "@/shared/domain";

type Tab = "containers" | "images" | "volumes" | "networks" | "swarm";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
	{
		id: "containers",
		label: "Containers",
		icon: <Boxes aria-hidden className="size-4" />,
	},
	{
		id: "images",
		label: "Images",
		icon: <Layers aria-hidden className="size-4" />,
	},
	{
		id: "volumes",
		label: "Volumes",
		icon: <HardDrive aria-hidden className="size-4" />,
	},
	{
		id: "networks",
		label: "Networks",
		icon: <Network aria-hidden className="size-4" />,
	},
	{
		id: "swarm",
		label: "Docker Swarm",
		icon: <Zap aria-hidden className="size-4" />,
	},
];

export function InfrastructurePage({
	connection,
	refreshToken,
}: InstancePageProps) {
	const [tab, setTab] = React.useState<Tab>("containers");
	const [serverId, setServerId] = React.useState<string>("");
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [inspecting, setInspecting] = React.useState<string | undefined>();
	const [busyContainer, setBusyContainer] = React.useState<
		string | undefined
	>();

	const { confirm, dialog } = useConfirm();
	const { preferences } = usePreferences();

	const servers = useAsync(
		() => getBridge().infrastructure.servers(),
		[connection?.id, refreshToken],
		{ enabled: Boolean(connection?.capabilities?.servers) },
	);

	const scope = serverId || undefined;

	const containers = useAsync(
		() => getBridge().infrastructure.containers(scope),
		[connection?.id, scope, refreshToken, tab],
		{ enabled: Boolean(connection) && tab === "containers" },
	);

	const images = useAsync(
		() => getBridge().infrastructure.images(scope),
		[connection?.id, scope, refreshToken, tab],
		{ enabled: Boolean(connection) && tab === "images" },
	);

	const volumes = useAsync(
		() => getBridge().infrastructure.volumes(scope),
		[connection?.id, scope, refreshToken, tab],
		{ enabled: Boolean(connection) && tab === "volumes" },
	);

	const networks = useAsync(
		() => getBridge().infrastructure.networks(scope),
		[connection?.id, scope, refreshToken, tab],
		{ enabled: Boolean(connection) && tab === "networks" },
	);

	const swarm = useAsync(
		() => getBridge().infrastructure.swarmNodes(scope),
		[connection?.id, scope, refreshToken, tab],
		{ enabled: Boolean(connection) && tab === "swarm" },
	);

	const config = useAsync(
		() =>
			inspecting
				? getBridge().infrastructure.containerConfig(inspecting, scope)
				: Promise.resolve(undefined),
		[inspecting, scope],
		{ enabled: Boolean(inspecting) },
	);

	const refreshAll = () => {
		servers.reload();
		containers.reload();
		images.reload();
		volumes.reload();
		networks.reload();
		swarm.reload();
	};

	const containerAction = async (
		container: DockerContainer,
		action: "start" | "stop" | "restart" | "kill" | "remove",
	) => {
		const destructive =
			action === "stop" || action === "kill" || action === "remove";
		if (destructive && preferences.confirmDestructiveActions) {
			const agreed = await confirm({
				title: `${action === "remove" ? "Remove" : action === "kill" ? "Kill" : "Stop"} ${container.name}?`,
				description:
					action === "remove"
						? "The container is removed from the Docker host. Volumes mounted from named volumes are kept; anonymous ones are lost."
						: "This affects the running workload immediately.",
				confirmLabel: action === "remove" ? "Remove container" : "Continue",
				destructive: true,
			});
			if (!agreed) return;
		}

		setBusyContainer(container.containerId);
		setFailure(undefined);
		try {
			await getBridge().infrastructure.containerAction({
				action,
				containerId: container.containerId,
				serverId: container.serverId ?? scope,
			});
			containers.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusyContainer(undefined);
		}
	};

	const activeError =
		(tab === "containers" && containers.error) ||
		(tab === "images" && images.error) ||
		(tab === "volumes" && volumes.error) ||
		(tab === "networks" && networks.error) ||
		(tab === "swarm" && swarm.error);

	const loading =
		(tab === "containers" && containers.loading) ||
		(tab === "images" && images.loading) ||
		(tab === "volumes" && volumes.loading) ||
		(tab === "networks" && networks.loading) ||
		(tab === "swarm" && swarm.loading);

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Infrastructure"
				description="Docker resources managed by this instance. Selecting a server scopes every read through the API's own serverId parameter."
				actions={
					<Button onClick={refreshAll} busy={loading}>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex items-center gap-3 border-b border-border px-6 py-2.5">
				<div className="flex gap-1">
					{TABS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							onClick={() => setTab(entry.id)}
							className={
								tab === entry.id
									? "flex items-center gap-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-sm text-content"
									: "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
							}
						>
							{entry.icon}
							{entry.label}
						</button>
					))}
				</div>

				<div className="ml-auto w-64">
					<Select
						value={serverId}
						onChange={(event) => setServerId(event.target.value)}
						aria-label="Server"
					>
						<option value="">Local server</option>
						{(servers.data ?? []).map((server) => (
							<option key={server.serverId} value={server.serverId}>
								{server.name} ({server.serverType})
							</option>
						))}
					</Select>
				</div>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{activeError ? (
					<ErrorNote
						error={activeError}
						onRetry={() => {
							containers.reload();
							images.reload();
							volumes.reload();
							networks.reload();
							swarm.reload();
						}}
					/>
				) : null}

				{loading && !activeError ? <LoadingState /> : null}

				{tab === "containers" && containers.data ? (
					containers.data.length === 0 ? (
						<EmptyState
							title="No container on this server"
							description="Nothing is running and no stopped container is present."
						/>
					) : (
						<Panel>
							<TableShell
								head={
									<>
										<Th>Name</Th>
										<Th>Image</Th>
										<Th>State</Th>
										<Th>Ports</Th>
										<Th className="text-right">Actions</Th>
									</>
								}
							>
								{containers.data.map((container) => (
									<Tr key={container.containerId}>
										<Td className="font-mono text-xs">{container.name}</Td>
										<Td className="text-content-muted">
											{shorten(container.image)}
										</Td>
										<Td className="whitespace-nowrap">{container.status}</Td>
										<Td className="font-mono text-xs text-content-muted">
											{container.ports || "—"}
										</Td>
										<Td>
											<div className="flex justify-end gap-1">
												<Button
													size="sm"
													variant="ghost"
													title="Inspect"
													onClick={() =>
														setInspecting(
															inspecting === container.containerId
																? undefined
																: container.containerId,
														)
													}
												>
													Inspect
												</Button>
												<Button
													size="sm"
													variant="ghost"
													title="Start"
													busy={busyContainer === container.containerId}
													onClick={() =>
														void containerAction(container, "start")
													}
												>
													<Play aria-hidden className="size-3.5" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													title="Restart"
													onClick={() =>
														void containerAction(container, "restart")
													}
												>
													<RotateCw aria-hidden className="size-3.5" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													title="Stop"
													onClick={() =>
														void containerAction(container, "stop")
													}
												>
													<Square aria-hidden className="size-3.5" />
												</Button>
												<Button
													size="sm"
													variant="danger"
													title="Remove"
													onClick={() =>
														void containerAction(container, "remove")
													}
												>
													<Trash2 aria-hidden className="size-3.5" />
												</Button>
											</div>
										</Td>
									</Tr>
								))}
							</TableShell>
						</Panel>
					)
				) : null}

				{inspecting ? (
					<Panel>
						<PanelHeader
							title="Container configuration"
							description="docker.getConfig — the raw inspect payload."
							actions={
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setInspecting(undefined)}
								>
									Close
								</Button>
							}
						/>
						{config.error ? (
							<ErrorNote
								error={config.error}
								className="m-3"
								onRetry={config.reload}
							/>
						) : (
							<CodeBlock
								content={JSON.stringify(config.data ?? {}, null, 2)}
								emptyLabel="Loading…"
							/>
						)}
					</Panel>
				) : null}

				{tab === "images" && images.data ? (
					<Panel>
						{images.data.length === 0 ? (
							<EmptyState title="No image on this server" />
						) : (
							<TableShell
								head={
									<>
										<Th>Repository</Th>
										<Th>Tag</Th>
										<Th>Size</Th>
										<Th>Created</Th>
									</>
								}
							>
								{images.data.map((image) => (
									<Tr key={`${image.ID}-${image.Tag}`}>
										<Td>{image.Repository}</Td>
										<Td className="text-content-muted">{image.Tag}</Td>
										<Td className="text-content-muted">{image.Size}</Td>
										<Td className="text-content-muted">{image.CreatedSince}</Td>
									</Tr>
								))}
							</TableShell>
						)}
					</Panel>
				) : null}

				{tab === "volumes" && volumes.data ? (
					<Panel>
						{volumes.data.length === 0 ? (
							<EmptyState title="No volume on this server" />
						) : (
							<TableShell
								head={
									<>
										<Th>Name</Th>
										<Th>Driver</Th>
										<Th>Scope</Th>
										<Th>Size</Th>
									</>
								}
							>
								{volumes.data.map((volume) => (
									<Tr key={volume.Name}>
										<Td className="font-mono text-xs">{volume.Name}</Td>
										<Td className="text-content-muted">{volume.Driver}</Td>
										<Td className="text-content-muted">{volume.Scope}</Td>
										<Td className="text-content-muted">
											{/* The size is only present when the instance computes it;
											    an em dash says so instead of implying zero bytes. */}
											{volume.Size ?? "—"}
										</Td>
									</Tr>
								))}
							</TableShell>
						)}
					</Panel>
				) : null}

				{tab === "networks" && networks.data ? (
					<Panel>
						{networks.data.length === 0 ? (
							<EmptyState title="No network on this server" />
						) : (
							<TableShell
								head={
									<>
										<Th>Name</Th>
										<Th>Driver</Th>
										<Th>Created</Th>
									</>
								}
							>
								{networks.data.map((network, index) => (
									<Tr key={`${network.networkId ?? network.name ?? index}`}>
										<Td>{network.name ?? network.networkId ?? "—"}</Td>
										<Td className="text-content-muted">
											{network.driver ?? "—"}
										</Td>
										<Td className="text-content-muted">
											{network.createdAt
												? relativeTime(network.createdAt)
												: "—"}
										</Td>
									</Tr>
								))}
							</TableShell>
						)}
					</Panel>
				) : null}

				{tab === "swarm" && swarm.data ? (
					<Panel>
						{swarm.data.length === 0 ? (
							<EmptyState
								title="No Swarm node"
								description="This server is not part of a Docker Swarm, or the swarm has no listed nodes."
							/>
						) : (
							<TableShell
								head={
									<>
										<Th>Hostname</Th>
										<Th>Role</Th>
										<Th>State</Th>
										<Th>Address</Th>
									</>
								}
							>
								{swarm.data.map((node) => (
									<Tr key={node.ID}>
										<Td>
											{node.Description?.Hostname ?? node.ID.slice(0, 12)}
										</Td>
										<Td className="text-content-muted">
											{node.Spec?.Role ?? "—"}
										</Td>
										<Td className="text-content-muted">
											{node.Status?.State ?? "—"}
										</Td>
										<Td className="font-mono text-xs text-content-muted">
											{node.Status?.Addr ?? "—"}
										</Td>
									</Tr>
								))}
							</TableShell>
						)}
					</Panel>
				) : null}
			</div>

			{dialog}
		</div>
	);
}
