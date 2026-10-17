import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "@/components/ui/card";

/**
 * Empty state, treated as a normal interface state: it explains what is
 * missing and offers the actions that make sense at this point (onboarding,
 * creating the first project, reading the documentation).
 */
export const HomeEmptyState = ({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	children?: React.ReactNode;
}) => (
	<Card className="min-w-0 overflow-hidden">
		<div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
			<Icon className="size-8 text-muted-foreground" aria-hidden />
			<div className="space-y-1">
				<p className="font-medium">{title}</p>
				<p className="mx-auto max-w-xl text-sm text-muted-foreground">
					{description}
				</p>
			</div>
			{children && (
				<div className="flex flex-wrap items-center justify-center gap-2 pt-1">
					{children}
				</div>
			)}
		</div>
	</Card>
);
