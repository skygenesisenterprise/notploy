/**
 * Projects and their environments.
 *
 * Environments are loaded when a project is expanded, not up front: an instance
 * with many projects would otherwise issue one request per project on every
 * refresh. `application.search` is only queried for environments the user opened.
 */

import {
	ChevronDown,
	ChevronRight,
	FolderKanban,
	RefreshCw,
} from "lucide-react";
import * as React from "react";
import {
	Button,
	EmptyState,
	ErrorNote,
	LoadingState,
	PageHeader,
	Panel,
	StatusBadge,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import { applicationStatus } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";
import type { EnvironmentSummary } from "@/shared/domain";

export function ProjectsPage({
	connection,
	refreshToken,
	onNavigate,
}: InstancePageProps) {
	const projects = useAsync(
		() => getBridge().projects.list(),
		[connection?.id, refreshToken],
	);

	const [open, setOpen] = React.useState<Record<string, boolean>>({});
	const [environments, setEnvironments] = React.useState<
		Record<string, EnvironmentSummary[]>
	>({});
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();

	const loadEnvironments = async (projectId: string) => {
		setFailure(undefined);
		try {
			const value = await getBridge().projects.environments(projectId);
			setEnvironments((current) => ({ ...current, [projectId]: value }));
		} catch (caught) {
			setFailure(asFailure(caught));
		}
	};

	const toggle = (projectId: string) => {
		setOpen((current) => {
			const next = { ...current, [projectId]: !current[projectId] };
			if (next[projectId] && !environments[projectId]) {
				void loadEnvironments(projectId);
			}
			return next;
		});
	};

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Projects"
				description="Projects from project.all, with their environments from environment.byProjectId. Environments are read when you open a project."
				actions={
					<Button onClick={projects.reload} busy={projects.loading}>
						<RefreshCw aria-hidden className="size-3.5" />
						Refresh
					</Button>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{failure ? <ErrorNote error={failure} /> : null}
				{projects.error ? (
					<ErrorNote error={projects.error} onRetry={projects.reload} />
				) : null}
				{projects.loading && !projects.data ? (
					<LoadingState label="Loading projects…" />
				) : null}

				{projects.data?.length === 0 ? (
					<EmptyState
						icon={<FolderKanban aria-hidden className="size-8" />}
						title="No project"
						description="This instance has no project yet. Create one from the Notploy dashboard — the desktop client operates existing projects, it does not create them."
						action={
							<Button
								onClick={() =>
									void getBridge().app.openExternal(
										`${connection?.url ?? ""}/dashboard`,
									)
								}
							>
								Open the dashboard
							</Button>
						}
					/>
				) : null}

				<div className="space-y-2">
					{(projects.data ?? []).map((project) => {
						const expanded = Boolean(open[project.projectId]);
						const loaded = environments[project.projectId];
						return (
							<Panel key={project.projectId}>
								<button
									type="button"
									onClick={() => toggle(project.projectId)}
									aria-expanded={expanded}
									className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
								>
									{expanded ? (
										<ChevronDown
											aria-hidden
											className="size-4 text-content-subtle"
										/>
									) : (
										<ChevronRight
											aria-hidden
											className="size-4 text-content-subtle"
										/>
									)}
									<span className="flex-1">
										<span className="block text-sm font-medium text-content">
											{project.name}
										</span>
										{project.description ? (
											<span className="block text-xs text-content-muted">
												{project.description}
											</span>
										) : null}
									</span>
								</button>

								{expanded ? (
									<div className="border-t border-border px-4 py-3">
										{!loaded ? (
											<LoadingState label="Loading environments…" />
										) : loaded.length === 0 ? (
											<p className="text-xs text-content-subtle">
												This project has no environment.
											</p>
										) : (
											<ul className="space-y-3">
												{loaded.map((environment) => (
													<li
														key={environment.environmentId}
														className="rounded-md border border-border bg-surface-raised px-3 py-2.5"
													>
														<div className="flex items-center gap-2">
															<span className="text-sm text-content">
																{environment.name}
															</span>
															{environment.isDefault ? (
																<span className="text-xs text-content-subtle">
																	default
																</span>
															) : null}
														</div>

														{(environment.applications?.length ?? 0) === 0 ? (
															<p className="mt-1 text-xs text-content-subtle">
																No application embedded by this environment
																payload.
															</p>
														) : (
															<ul className="mt-2 space-y-1">
																{environment.applications?.map(
																	(application) => {
																		const status = applicationStatus(
																			application.applicationStatus,
																		);
																		return (
																			<li
																				key={application.applicationId}
																				className="flex items-center justify-between gap-3"
																			>
																				<span className="truncate text-sm text-content-muted">
																					{application.name}
																				</span>
																				<StatusBadge
																					label={status.label}
																					tone={status.tone}
																				/>
																			</li>
																		);
																	},
																)}
															</ul>
														)}
													</li>
												))}
											</ul>
										)}

										<Button
											size="sm"
											variant="ghost"
											className="mt-3"
											onClick={() => onNavigate("applications")}
										>
											Open Applications
										</Button>
									</div>
								) : null}
							</Panel>
						);
					})}
				</div>
			</div>
		</div>
	);
}
