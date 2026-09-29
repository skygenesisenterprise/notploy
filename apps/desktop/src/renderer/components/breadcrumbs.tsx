/**
 * The breadcrumb trail.
 *
 * Answers the question the sidebar deliberately does not: *inside* a section,
 * which project, environment or resource am I looking at. It is rendered by the
 * page rather than by the shell, because the page is what knows the display
 * names — a project id is not a label, and inventing one in the shell would mean
 * re-fetching what the page already has.
 *
 * The last crumb is the current view and is not a button: there is nowhere to go.
 */

import { ChevronRight } from "lucide-react";
import type * as React from "react";
import { cn } from "@/renderer/lib/cn";

export interface Crumb {
	/** Shown to the user. Falls back to the identifier if it is unknown yet. */
	label: string;
	/** Absent on the final crumb, which is the current view. */
	onClick?: () => void;
}

export function Breadcrumbs({
	items,
	className,
}: {
	items: Crumb[];
	className?: string;
}) {
	if (items.length === 0) return null;

	return (
		<nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
			<ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
				{items.map((crumb, index) => {
					const last = index === items.length - 1;
					return (
						<li
							key={`${crumb.label}-${index}`}
							className="flex min-w-0 items-center gap-1"
						>
							{index > 0 ? (
								<ChevronRight
									aria-hidden
									className="size-3 shrink-0 text-content-subtle"
								/>
							) : null}
							{last || !crumb.onClick ? (
								<span
									aria-current={last ? "page" : undefined}
									className={cn(
										"max-w-64 truncate",
										last ? "text-content" : "text-content-subtle",
									)}
								>
									{crumb.label}
								</span>
							) : (
								<button
									type="button"
									onClick={crumb.onClick}
									className="max-w-64 truncate rounded text-content-muted transition-colors hover:text-accent"
								>
									{crumb.label}
								</button>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

/**
 * One row of a section's local toolbar: the trail on the left, actions on the
 * right, so a drilled-down page keeps its header structure.
 */
export function BreadcrumbBar({
	items,
	actions,
}: {
	items: Crumb[];
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-2">
			<Breadcrumbs items={items} />
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}
