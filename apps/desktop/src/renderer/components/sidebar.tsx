/**
 * The sidebar: the instance switcher on top, navigation below.
 *
 * The switcher comes first because it is the question the whole app depends on —
 * "which instance am I operating?" — and every page is scoped to its answer.
 *
 * A section is highlighted when it is the current route's section, even when a
 * resource inside it is open, so the sidebar keeps showing *where you are* while
 * the breadcrumb shows *what you are looking at*.
 *
 * Sections the active instance does not expose are shown disabled with the
 * reason, rather than hidden: an operator looking for "Databases" on an instance
 * that does not run one should learn why, not wonder whether they mis-remembered
 * the menu.
 */

import {
	Activity,
	Archive,
	Bell,
	Boxes,
	ChevronDown,
	Database,
	FolderKanban,
	KeyRound,
	LayoutDashboard,
	Package,
	Plug,
	Rocket,
	Settings,
	ShieldCheck,
	SquareStack,
	Tags,
} from "lucide-react";
import * as React from "react";
import { StatusDot } from "@/renderer/components/ui/primitives";
import { cn } from "@/renderer/lib/cn";
import { connectionStatus } from "@/renderer/lib/format";
import {
	type DeepLinkSection,
	FOOTER_NAV_ORDER,
	NAV_ORDER,
	type RouteState,
	SECTIONS,
} from "@/renderer/lib/routes";
import type { ConnectionSummary } from "@/shared/domain";

const ICONS: Record<DeepLinkSection, React.ReactNode> = {
	overview: <LayoutDashboard aria-hidden className="size-4" />,
	databases: <Database aria-hidden className="size-4" />,
	projects: <FolderKanban aria-hidden className="size-4" />,
	applications: <Boxes aria-hidden className="size-4" />,
	deployments: <Rocket aria-hidden className="size-4" />,
	infrastructure: <SquareStack aria-hidden className="size-4" />,
	monitoring: <Activity aria-hidden className="size-4" />,
	tags: <Tags aria-hidden className="size-4" />,
	certificates: <ShieldCheck aria-hidden className="size-4" />,
	"ssh-keys": <KeyRound aria-hidden className="size-4" />,
	registries: <Package aria-hidden className="size-4" />,
	destinations: <Archive aria-hidden className="size-4" />,
	notifications: <Bell aria-hidden className="size-4" />,
	connections: <Plug aria-hidden className="size-4" />,
	settings: <Settings aria-hidden className="size-4" />,
};

export interface SidebarProps {
	route: RouteState;
	onNavigate: (route: RouteState) => void;
	connections: ConnectionSummary[];
	active: ConnectionSummary | undefined;
	onSelectConnection: (id: string) => void;
	onAddConnection: () => void;
}

export function Sidebar({
	route,
	onNavigate,
	connections,
	active,
	onSelectConnection,
	onAddConnection,
}: SidebarProps) {
	/** Why a section cannot be opened on this instance, or `undefined`. */
	const blockedReason = (section: DeepLinkSection): string | undefined => {
		const definition = SECTIONS[section];
		if (!definition.requiresConnection) return undefined;
		if (!active) return "No instance selected";
		if (definition.capability && active.capabilities) {
			if (!active.capabilities[definition.capability]) {
				return `${active.name} does not expose the ${definition.router ?? definition.capability} router`;
			}
		}
		return undefined;
	};

	const renderItem = (section: DeepLinkSection) => {
		const definition = SECTIONS[section];
		const reason = blockedReason(section);
		return (
			<NavItem
				key={section}
				id={section}
				selected={route.section === section}
				disabled={Boolean(reason)}
				title={reason}
				onNavigate={() => onNavigate({ section })}
			/>
		);
	};

	return (
		<aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
			<ConnectionSwitcher
				connections={connections}
				active={active}
				onSelect={onSelectConnection}
				onAdd={onAddConnection}
			/>

			<nav aria-label="Sections" className="flex-1 overflow-y-auto px-2 py-3">
				<ul className="space-y-0.5">{NAV_ORDER.map(renderItem)}</ul>
			</nav>

			<nav
				aria-label="Application"
				className="border-t border-border px-2 py-2"
			>
				<ul className="space-y-0.5">{FOOTER_NAV_ORDER.map(renderItem)}</ul>
			</nav>
		</aside>
	);
}

function NavItem({
	id,
	selected,
	disabled,
	title,
	onNavigate,
}: {
	id: DeepLinkSection;
	selected: boolean;
	disabled: boolean;
	title?: string;
	onNavigate: () => void;
}) {
	const definition = SECTIONS[id];
	return (
		<li>
			<button
				type="button"
				onClick={onNavigate}
				disabled={disabled}
				title={title}
				aria-current={selected ? "page" : undefined}
				className={cn(
					"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
					selected
						? "bg-accent-soft text-content"
						: "text-content-muted hover:bg-surface-hover hover:text-content",
					disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
				)}
			>
				<span
					className={
						selected && !disabled ? "text-accent" : "text-content-subtle"
					}
				>
					{ICONS[id]}
				</span>
				<span className="min-w-0 flex-1 truncate">{definition.title}</span>
			</button>
		</li>
	);
}

function ConnectionSwitcher({
	connections,
	active,
	onSelect,
	onAdd,
}: {
	connections: ConnectionSummary[];
	active: ConnectionSummary | undefined;
	onSelect: (id: string) => void;
	onAdd: () => void;
}) {
	const [open, setOpen] = React.useState(false);
	const status = connectionStatus(active?.status ?? "unknown");

	return (
		<div className="relative border-b border-border p-3">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="flex w-full items-center gap-2.5 rounded-md border border-border bg-surface-raised px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
			>
				<StatusDot tone={status.tone} pulse={active?.status === "checking"} />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm text-content">
						{active?.name ?? "No instance selected"}
					</span>
					<span className="block truncate text-xs text-content-subtle">
						{active ? status.label : `${connections.length} configured`}
					</span>
				</span>
				<ChevronDown aria-hidden className="size-4 text-content-subtle" />
			</button>

			{open ? (
				<>
					{/*
						Click-away layer: the menu closes as soon as anything else is
						clicked. A button rather than a div with an onClick, so it is also a
						keyboard-reachable "close" control.
					*/}
					<button
						type="button"
						aria-label="Close the instance menu"
						className="fixed inset-0 z-10 cursor-default"
						onClick={() => setOpen(false)}
					/>
					<ul className="absolute inset-x-3 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-xl">
						{connections.length === 0 ? (
							<li className="px-2.5 py-2 text-xs text-content-muted">
								No connection configured yet.
							</li>
						) : null}
						{connections.map((connection) => {
							const entry = connectionStatus(connection.status);
							return (
								<li key={connection.id}>
									<button
										type="button"
										onClick={() => {
											setOpen(false);
											onSelect(connection.id);
										}}
										className={cn(
											"flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-hover",
											connection.active && "bg-accent-soft",
										)}
									>
										<StatusDot tone={entry.tone} />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm text-content">
												{connection.name}
											</span>
											<span className="block truncate text-xs text-content-subtle">
												{entry.label}
												{connection.cloud ? " · Cloud" : ""}
											</span>
										</span>
									</button>
								</li>
							);
						})}
						<li className="mt-1 border-t border-border pt-1">
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									onAdd();
								}}
								className="w-full rounded px-2.5 py-2 text-left text-sm text-accent transition-colors hover:bg-surface-hover"
							>
								Add a connection…
							</button>
						</li>
					</ul>
				</>
			) : null}
		</div>
	);
}
