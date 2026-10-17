import type * as React from "react";
import { Badge } from "@/components/ui/badge";

interface HomeHeaderProps {
	title: string;
	description: string;
	/** What the page covers — instance, workspace or operator scope. */
	scope: string;
	scopeDetail?: string;
	actions?: React.ReactNode;
}

/**
 * Contextual header: title, description, scope and the actions available in
 * this environment. The scope is stated explicitly because the same route
 * serves three very different perimeters.
 */
export const HomeHeader = ({
	title,
	description,
	scope,
	scopeDetail,
	actions,
}: HomeHeaderProps) => (
	<header className="flex flex-wrap items-start justify-between gap-3">
		<div className="min-w-0 space-y-1">
			<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
			<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			<div className="flex flex-wrap items-center gap-2 pt-1">
				<Badge variant="secondary">{scope}</Badge>
				{scopeDetail && (
					<span className="text-xs text-muted-foreground">{scopeDetail}</span>
				)}
			</div>
		</div>
		{actions && (
			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		)}
	</header>
);
