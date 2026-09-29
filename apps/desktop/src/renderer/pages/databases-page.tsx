/**
 * Managed databases.
 *
 * The reference dashboard spreads databases across six service pages reachable
 * only through a project. An operations client wants the opposite question
 * answered first — *what databases exist on this instance, on any engine* — so
 * this page lists every engine at once and offers the same lifecycle actions the
 * per-engine pages do.
 *
 * Engine availability comes from the instance's capability report, so an
 * instance without the LibSQL router says so instead of showing an empty tab.
 */

import {
	Database,
	ExternalLink,
	LifeBuoy,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";
import * as React from "react";
import {
	Button,
	EmptyState,
	ErrorNote,
	Input,
	LoadingState,
	PageHeader,
	Panel,
	StatusBadge,
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
import { cn } from "@/renderer/lib/cn";
import { databaseStatus, relativeTime } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import {
	DATABASE_ENGINE_LABELS,
	DATABASE_ENGINES,
	type DatabaseEngine,
	type DatabaseSummary,
} from "@/shared/domain";

type EngineFilter = DatabaseEngine | "all";

export function DatabasesPage({
	connection,
	refreshToken,
	onNavigate,
}: InstancePageProps) {
	const [engine, setEngine] = React.useState<EngineFilter>("all");
	const [query, setQuery] = React.useState("");
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [busyId, setBusyId] = React.useState<string | undefined>();

	const { preferences } = usePreferences();
	const { confirm, dialog } = useConfirm();

	const result = useAsync(
		() => getBridge().databases.list(engine === "all" ? undefined : { engine }),
		[connection?.id, refreshToken, engine],
		{ enabled: Boolean(connection) },
	);

	const remove = async (database: DatabaseSummary) => {
		if (preferences.confirmDestructiveActions) {
			const agreed = await confirm({
				title: `Remove "${database.name}"?`,
				description:
					"The service and its data volume are deleted from the instance. This cannot be undone.",
				confirmLabel: "Remove service",
				destructive: true,
			});
			if (!agreed) return;
		}
		setFailure(undefined);
		setBusyId(database.id);
		try {
			await getBridge().databases.action({
				engine: database.engine,
				databaseId: database.id,
				action: "remove",
			});
			result.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusyId(undefined);
		}
	};

	// Filtering is local: the list is already bounded per engine, and a round
	// trip per keystroke would be worse on a slow instance.
	const needle = query.trim().toLowerCase();
	const rows = (result.data?.databases ?? []).filter((database) => {
		if (!needle) return true;
		return (
			database.name.toLowerCase().includes(needle) ||
			(database.databaseName ?? "").toLowerCase().includes(needle) ||
			(database.appName ?? "").toLowerCase().includes(needle)
		);
	});

	const available = new Set(
		DATABASE_ENGINES.filter(
			(candidate) => connection?.capabilities?.[candidate] !== false,
		),
	);

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Databases"
				description="Managed database services across every engine this instance exposes. Filtering is local; the list is read per engine from its own router."
				actions={
					<Button onClick={result.reload} busy={result.loading}>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-2">
				<div className="flex flex-wrap gap-1">
					<EngineTab
						label="All"
						active={engine === "all"}
						onClick={() => setEngine("all")}
					/>
					{DATABASE_ENGINES.map((candidate) => (
						<EngineTab
							key={candidate}
							label={DATABASE_ENGINE_LABELS[candidate].short}
							active={engine === candidate}
							disabled={!available.has(candidate)}
							onClick={() => setEngine(candidate)}
						/>
					))}
				</div>

				<div className="relative ml-auto w-64">
					<Search
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-content-subtle"
					/>
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Filter by name…"
						aria-label="Filter databases by name"
						className="pl-8"
					/>
				</div>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{result.error ? (
					<ErrorNote error={result.error} onRetry={result.reload} />
				) : null}

				{/* What could not be enumerated, said plainly rather than shown as
				    an empty list. */}
				{result.data && result.data.notes.length > 0 ? (
					<Panel className="border-warn/30 bg-warn/5">
						<div className="flex items-start gap-3 px-4 py-3">
							<LifeBuoy
								aria-hidden
								className="mt-0.5 size-4 shrink-0 text-warn"
							/>
							<ul className="space-y-1 text-xs text-content-muted">
								{result.data.notes.map((note) => (
									<li key={note}>{note}</li>
								))}
							</ul>
						</div>
					</Panel>
				) : null}

				{result.loading && !result.data ? (
					<LoadingState label="Loading databases…" />
				) : null}

				{!result.loading && rows.length === 0 ? (
					<EmptyState
						icon={<Database aria-hidden className="size-8" />}
						title={
							query ? "No database matches this filter" : "No managed database"
						}
						description={
							query
								? "Clear the filter to see everything this instance exposes."
								: "This instance runs no managed database service the API key can see. Databases are created from the Notploy dashboard — the desktop client operates them."
						}
						action={
							connection ? (
								<Button
									onClick={() =>
										void getBridge().app.openExternal(
											`${connection.url}/dashboard`,
										)
									}
								>
									<ExternalLink aria-hidden className="size-3.5" />
									Open the dashboard
								</Button>
							) : undefined
						}
					/>
				) : null}

				{rows.length > 0 ? (
					<Panel>
						<TableShell
							head={
								<>
									<Th>Service</Th>
									<Th>Engine</Th>
									<Th>Status</Th>
									<Th>Database</Th>
									<Th>Port</Th>
									<Th>Created</Th>
									<Th className="text-right">Actions</Th>
								</>
							}
						>
							{rows.map((database) => {
								const status = databaseStatus(database.applicationStatus);
								return (
									<Tr key={`${database.engine}:${database.id}`}>
										<Td className="max-w-56 truncate">
											<button
												type="button"
												onClick={() =>
													onNavigate({
														section: "databases",
														resource: {
															kind: "database",
															engine: database.engine,
															id: database.id,
														},
													})
												}
												className="truncate text-left text-content transition-colors hover:text-accent"
											>
												{database.name}
											</button>
											{database.environment ? (
												<span className="block truncate text-xs text-content-subtle">
													{database.environment.project?.name ?? "project"} /{" "}
													{database.environment.name}
												</span>
											) : null}
										</Td>
										<Td className="whitespace-nowrap text-content-muted">
											{DATABASE_ENGINE_LABELS[database.engine].short}
										</Td>
										<Td>
											<StatusBadge label={status.label} tone={status.tone} />
										</Td>
										<Td className="max-w-40 truncate text-content-muted">
											{database.databaseName ?? "—"}
										</Td>
										<Td className="text-content-muted">
											{database.externalPort ?? "—"}
										</Td>
										<Td className="whitespace-nowrap text-content-muted">
											{relativeTime(database.createdAt)}
										</Td>
										<Td>
											<div className="flex justify-end gap-1">
												<Button
													size="sm"
													onClick={() =>
														onNavigate({
															section: "databases",
															resource: {
																kind: "database",
																engine: database.engine,
																id: database.id,
															},
														})
													}
												>
													Open
												</Button>
												<Button
													size="sm"
													variant="destructive"
													busy={busyId === database.id}
													onClick={() => void remove(database)}
												>
													<Trash2 aria-hidden className="size-3.5" />
												</Button>
											</div>
										</Td>
									</Tr>
								);
							})}
						</TableShell>
					</Panel>
				) : null}
			</div>

			{dialog}
		</div>
	);
}

function EngineTab({
	label,
	active,
	disabled,
	onClick,
}: {
	label: string;
	active: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			disabled={disabled}
			title={disabled ? "This instance does not expose this engine" : undefined}
			className={cn(
				"rounded-md px-2.5 py-1 text-xs transition-colors",
				active
					? "bg-accent-soft text-content"
					: "text-content-muted hover:bg-surface-hover hover:text-content",
				disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
			)}
		>
			{label}
		</button>
	);
}
