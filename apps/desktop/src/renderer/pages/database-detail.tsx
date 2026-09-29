/**
 * One managed database.
 *
 * The reference dashboard shows six near-identical service pages for the six
 * engines; here there is one detail view parameterised by engine, which is what
 * makes adding an engine a data change rather than a new page.
 *
 * Three things the API forces this page to be careful about:
 *
 * - **`reload` needs the generated `appName`**, not just the id. It is already
 *   on the record, so it is passed through instead of being re-read.
 * - **LibSQL has no `changePassword`.** The action is hidden rather than shown
 *   and then failing.
 * - **The password is a live credential.** It is fetched with the service, kept
 *   masked, and copied through the main process — never rendered by default and
 *   never logged.
 */

import {
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	KeyRound,
	Play,
	RefreshCw,
	RotateCcw,
	Square,
	Trash2,
	Wrench,
} from "lucide-react";
import * as React from "react";
import { BreadcrumbBar } from "@/renderer/components/breadcrumbs";
import {
	Button,
	CodeBlock,
	EmptyState,
	ErrorNote,
	Field,
	Input,
	KeyValue,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	StatusBadge,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { useConfirm } from "@/renderer/hooks/use-confirm";
import { usePreferences } from "@/renderer/hooks/use-preferences";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import {
	dashboardUrl,
	databaseStatus,
	relativeTime,
} from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import { resourceOfKind } from "@/renderer/lib/page-props";
import {
	DATABASE_ENGINE_FEATURES,
	DATABASE_ENGINE_LABELS,
	type DatabaseAction,
} from "@/shared/domain";

const FOLLOW_OPTIONS = [0, 5, 15, 30] as const;

/** Every action, with the wording and the confirmation it needs. */
const ACTION_META: Record<
	DatabaseAction,
	{ label: string; icon: React.ReactNode; destructive: boolean; about: string }
> = {
	deploy: {
		label: "Deploy",
		icon: <Play aria-hidden className="size-3.5" />,
		destructive: false,
		about: "Builds the image and starts the service.",
	},
	start: {
		label: "Start",
		icon: <Play aria-hidden className="size-3.5" />,
		destructive: false,
		about: "Starts the existing container.",
	},
	stop: {
		label: "Stop",
		icon: <Square aria-hidden className="size-3.5" />,
		destructive: true,
		about:
			"Stops the container. Anything connecting to this database will lose its connection.",
	},
	reload: {
		label: "Reload",
		icon: <RotateCcw aria-hidden className="size-3.5" />,
		destructive: true,
		about:
			"Recreates the container without rebuilding the image. Existing connections are dropped.",
	},
	rebuild: {
		label: "Rebuild",
		icon: <Wrench aria-hidden className="size-3.5" />,
		destructive: true,
		about:
			"Rebuilds the service from its current configuration. The data volume is kept, but the service is unavailable while it runs.",
	},
	remove: {
		label: "Remove",
		icon: <Trash2 aria-hidden className="size-3.5" />,
		destructive: true,
		about:
			"Deletes the service **and its data volume**. This cannot be undone.",
	},
};

export function DatabaseDetailPage({
	connection,
	refreshToken,
	onNavigate,
	route,
}: InstancePageProps) {
	const resource = resourceOfKind(route, "database");
	const engine = resource?.engine;
	const databaseId = resource?.id;

	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [busy, setBusy] = React.useState<DatabaseAction | undefined>();
	const [followSeconds, setFollowSeconds] = React.useState(0);
	const [revealed, setRevealed] = React.useState(false);
	const [rotating, setRotating] = React.useState(false);

	const { preferences } = usePreferences();
	const { confirm, dialog } = useConfirm();

	const database = useAsync(
		() =>
			engine && databaseId
				? getBridge().databases.one(engine, databaseId)
				: Promise.reject(
						new Error("This view needs a database engine and identifier."),
					),
		[engine, databaseId, refreshToken],
		{ enabled: Boolean(engine && databaseId) },
	);

	const logs = useAsync(
		() =>
			engine && databaseId
				? getBridge().databases.logs(
						engine,
						databaseId,
						preferences.logTailLines,
					)
				: Promise.resolve(""),
		[engine, databaseId, preferences.logTailLines, refreshToken],
		{ enabled: Boolean(engine && databaseId) },
	);

	// Polling, because the API has no streaming endpoint for service logs.
	React.useEffect(() => {
		if (followSeconds === 0) return;
		const timer = setInterval(() => logs.reload(), followSeconds * 1000);
		return () => clearInterval(timer);
	}, [followSeconds, logs.reload]);

	const run = async (action: DatabaseAction) => {
		if (!engine || !databaseId) return;
		const meta = ACTION_META[action];

		if (meta.destructive && preferences.confirmDestructiveActions) {
			const agreed = await confirm({
				title: `${meta.label} ${database.data?.name ?? "this service"}?`,
				description: meta.about.replace("**", "").replace("**", ""),
				confirmLabel: meta.label,
				destructive: action === "remove" || action === "stop",
			});
			if (!agreed) return;
		}

		setFailure(undefined);
		setBusy(action);
		try {
			await getBridge().databases.action({
				engine,
				databaseId,
				action,
				appName: database.data?.appName,
			});
			if (action === "remove") {
				onNavigate({ section: "databases" });
				return;
			}
			database.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusy(undefined);
		}
	};

	const rotatePassword = async (password: string) => {
		if (!engine || !databaseId) return;
		setFailure(undefined);
		setBusy("reload");
		try {
			await getBridge().databases.changePassword(engine, databaseId, password);
			setRotating(false);
			database.reload();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusy(undefined);
		}
	};

	const record = database.data;
	const label = record ? DATABASE_ENGINE_LABELS[record.engine] : undefined;
	const status = databaseStatus(record?.applicationStatus);
	const canChangePassword = engine
		? DATABASE_ENGINE_FEATURES[engine].changePassword
		: false;

	return (
		<div className="flex h-full flex-col">
			<BreadcrumbBar
				items={[
					{
						label: "Databases",
						onClick: () => onNavigate({ section: "databases" }),
					},
					{ label: record?.name ?? databaseId ?? "Database" },
				]}
			/>

			<PageHeader
				title={record?.name ?? "Database"}
				description={
					label
						? `${label.name} service · ${record?.databaseName ?? "no database name reported"}`
						: undefined
				}
				actions={
					<>
						<Button onClick={database.reload} busy={database.loading}>
							<RefreshCw aria-hidden className="size-3.5" />
							Refresh
						</Button>
						{connection ? (
							<Button
								variant="ghost"
								onClick={() =>
									void getBridge().app.openExternal(
										dashboardUrl(
											connection.url,
											`/project/${record?.environment?.project?.projectId ?? ""}/environment/${record?.environmentId ?? ""}`,
										),
									)
								}
							>
								<ExternalLink aria-hidden className="size-3.5" />
								Dashboard
							</Button>
						) : null}
					</>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{database.error ? (
					<ErrorNote error={database.error} onRetry={database.reload} />
				) : null}
				{database.loading && !record ? (
					<LoadingState label="Loading the service…" />
				) : null}

				{!database.loading && !record && !database.error ? (
					<EmptyState
						title="This service could not be read"
						description="The instance returned no record for this identifier on the selected engine. It may have been removed since the link was created."
					/>
				) : null}

				{record ? (
					<>
						<Panel>
							<PanelHeader
								title="Service"
								description="Read from the engine's own router. Only the fields the instance reports are shown."
								actions={
									<StatusBadge label={status.label} tone={status.tone} />
								}
							/>
							<div className="px-4 py-4">
								<KeyValue
									items={[
										{ label: "Engine", value: label?.name ?? record.engine },
										{ label: "Generated name", value: record.appName ?? "—" },
										{ label: "Image", value: record.dockerImage ?? "—" },
										{ label: "Database", value: record.databaseName ?? "—" },
										{ label: "User", value: record.databaseUser ?? "—" },
										{
											label: "External port",
											value: record.externalPort ?? "not published",
										},
										{
											label: "Server",
											value: record.server?.name ?? record.serverId ?? "—",
										},
										{
											label: "Environment",
											value: record.environment
												? `${record.environment.project?.name ?? "project"} / ${record.environment.name}`
												: (record.environmentId ?? "—"),
										},
										{
											label: "Created",
											value: relativeTime(record.createdAt),
										},
										{
											label: "Password",
											value: (
												<CredentialRow
													password={record.databasePassword}
													revealed={revealed}
													onToggle={() => setRevealed((value) => !value)}
												/>
											),
										},
									]}
								/>
							</div>
						</Panel>

						<Panel>
							<PanelHeader
								title="Actions"
								description="Every action maps to one procedure on this engine's router. Destructive ones ask first."
							/>
							<div className="flex flex-wrap gap-2 px-4 py-3">
								{(
									[
										"deploy",
										"start",
										"stop",
										"reload",
										"rebuild",
										"remove",
									] as DatabaseAction[]
								).map((action) => {
									const meta = ACTION_META[action];
									return (
										<Button
											key={action}
											variant={
												action === "remove"
													? "destructive"
													: meta.destructive
														? "secondary"
														: "default"
											}
											onClick={() => void run(action)}
											busy={busy === action}
											disabled={busy !== undefined && busy !== action}
										>
											{meta.icon}
											{meta.label}
										</Button>
									);
								})}

								{canChangePassword ? (
									<Button
										variant="ghost"
										onClick={() => setRotating((value) => !value)}
									>
										<KeyRound aria-hidden className="size-3.5" />
										Change password
									</Button>
								) : (
									<span className="self-center text-xs text-content-subtle">
										{label?.name} exposes no password procedure.
									</span>
								)}
							</div>

							{rotating && canChangePassword ? (
								<PasswordForm
									busy={busy !== undefined}
									onCancel={() => setRotating(false)}
									onSubmit={rotatePassword}
								/>
							) : null}
						</Panel>

						<Panel>
							<PanelHeader
								title="Logs"
								description={`${engine}.readLogs. There is no streaming route, so following re-reads on an interval.`}
								actions={
									<>
										<label
											htmlFor="database-follow"
											className="self-center text-xs text-content-muted"
										>
											Follow
										</label>
										<select
											id="database-follow"
											value={followSeconds}
											onChange={(event) =>
												setFollowSeconds(Number(event.target.value))
											}
											className="rounded-md border border-border bg-canvas px-2 py-1 text-xs text-content"
										>
											{FOLLOW_OPTIONS.map((seconds) => (
												<option key={seconds} value={seconds}>
													{seconds === 0 ? "off" : `every ${seconds}s`}
												</option>
											))}
										</select>
										<Button size="sm" onClick={logs.reload} busy={logs.loading}>
											Reload
										</Button>
									</>
								}
							/>
							{logs.error ? (
								<ErrorNote
									error={logs.error}
									className="m-3"
									onRetry={logs.reload}
								/>
							) : (
								<CodeBlock
									content={logs.data ?? ""}
									emptyLabel={
										logs.loading ? "Loading…" : "This service wrote no logs."
									}
								/>
							)}
						</Panel>
					</>
				) : null}
			</div>

			{dialog}
		</div>
	);
}

/**
 * The masked credential.
 *
 * Masked by default, copied through the main process (the renderer's clipboard
 * permission is denied by the content policy), and never written anywhere.
 */
function CredentialRow({
	password,
	revealed,
	onToggle,
}: {
	password: string | undefined;
	revealed: boolean;
	onToggle: () => void;
}) {
	const [copied, setCopied] = React.useState(false);

	if (!password) {
		return <span className="text-content-subtle">not reported</span>;
	}

	return (
		<span className="flex items-center gap-2">
			<span className="truncate font-mono text-xs">
				{revealed ? password : "•".repeat(Math.min(password.length, 20))}
			</span>
			<button
				type="button"
				onClick={onToggle}
				aria-label={revealed ? "Hide the password" : "Reveal the password"}
				className="rounded p-1 text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
			>
				{revealed ? (
					<EyeOff aria-hidden className="size-3.5" />
				) : (
					<Eye aria-hidden className="size-3.5" />
				)}
			</button>
			<button
				type="button"
				onClick={() => {
					void getBridge()
						.app.copyText(password)
						.then(() => setCopied(true))
						.catch(() => setCopied(false));
				}}
				aria-label="Copy the password"
				className="rounded p-1 text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
			>
				<Copy aria-hidden className="size-3.5" />
			</button>
			{copied ? <span className="text-xs text-ok">copied</span> : null}
		</span>
	);
}

/** Rotation form. The password is sent once and never stored on this machine. */
function PasswordForm({
	busy,
	onCancel,
	onSubmit,
}: {
	busy: boolean;
	onCancel: () => void;
	onSubmit: (password: string) => Promise<void>;
}) {
	const [password, setPassword] = React.useState("");
	const [confirmation, setConfirmation] = React.useState("");
	const mismatch = password.length > 0 && password !== confirmation;

	return (
		<form
			className="space-y-3 border-t border-border px-4 py-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (!password || mismatch) return;
				void onSubmit(password).then(() => {
					setPassword("");
					setConfirmation("");
				});
			}}
		>
			<p className="text-xs text-content-muted">
				The new password is sent to the instance and is not stored on this
				machine. Update anything that connects to this database.
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="New password" htmlFor="database-password">
					<Input
						id="database-password"
						type="password"
						autoComplete="new-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
				<Field
					label="Confirm"
					htmlFor="database-password-confirmation"
					hint={mismatch ? "The two values do not match." : undefined}
				>
					<Input
						id="database-password-confirmation"
						type="password"
						autoComplete="new-password"
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
					/>
				</Field>
			</div>
			<div className="flex justify-end gap-2">
				<Button variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="default"
					busy={busy}
					disabled={!password || mismatch}
				>
					Change password
				</Button>
			</div>
		</form>
	);
}
