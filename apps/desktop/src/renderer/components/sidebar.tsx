/**
 * The sidebar: the instance switcher on top, navigation below.
 *
 * The switcher comes first because it is the question the whole app depends on —
 * "which instance am I operating?" — and every page is scoped to its answer.
 */

import {
	Activity,
	Bell,
	Boxes,
	ChevronDown,
	FolderKanban,
	LayoutDashboard,
	Plug,
	Rocket,
	Settings,
	SquareStack,
} from "lucide-react";
import * as React from "react";
import { StatusDot } from "@/renderer/components/ui/primitives";
import { cn } from "@/renderer/lib/cn";
import { connectionStatus } from "@/renderer/lib/format";
import {
	FOOTER_NAV_ORDER,
	NAV_ORDER,
	ROUTES,
	type RouteId,
} from "@/renderer/lib/routes";
import type { ConnectionSummary } from "@/shared/domain";

const ICONS: Record<RouteId, React.ReactNode> = {
	overview: <LayoutDashboard aria-hidden className="size-4" />,
	infrastructure: <SquareStack aria-hidden className="size-4" />,
	projects: <FolderKanban aria-hidden className="size-4" />,
	applications: <Boxes aria-hidden className="size-4" />,
	deployments: <Rocket aria-hidden className="size-4" />,
	monitoring: <Activity aria-hidden className="size-4" />,
	notifications: <Bell aria-hidden className="size-4" />,
	connections: <Plug aria-hidden className="size-4" />,
	settings: <Settings aria-hidden className="size-4" />,
};

export interface SidebarProps {
	route: RouteId;
	onNavigate: (route: RouteId) => void;
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
	return (
		<aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
			<ConnectionSwitcher
				connections={connections}
				active={active}
				onSelect={onSelectConnection}
				onAdd={onAddConnection}
			/>

			<nav className="flex-1 overflow-y-auto px-2 py-3">
				<ul className="space-y-0.5">
					{NAV_ORDER.map((id) => (
						<NavItem key={id} id={id} current={route} onNavigate={onNavigate} />
					))}
				</ul>
			</nav>

			<nav className="border-t border-border px-2 py-2">
				<ul className="space-y-0.5">
					{FOOTER_NAV_ORDER.map((id) => (
						<NavItem key={id} id={id} current={route} onNavigate={onNavigate} />
					))}
				</ul>
			</nav>
		</aside>
	);
}

function NavItem({
	id,
	current,
	onNavigate,
}: {
	id: RouteId;
	current: RouteId;
	onNavigate: (route: RouteId) => void;
}) {
	const definition = ROUTES[id];
	const selected = current === id;
	return (
		<li>
			<button
				type="button"
				onClick={() => onNavigate(id)}
				aria-current={selected ? "page" : undefined}
				className={cn(
					"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
					selected
						? "bg-accent-soft text-content"
						: "text-content-muted hover:bg-surface-hover hover:text-content",
				)}
			>
				<span className={selected ? "text-accent" : "text-content-subtle"}>
					{ICONS[id]}
				</span>
				{definition.title}
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
