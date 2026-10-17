import type * as React from "react";
import { Card } from "@/components/ui/card";

interface HomePanelProps {
	title: string;
	description: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

/**
 * Card shell used by every block of the homepages, so the three compositions
 * share one heading, one spacing scale and one card treatment.
 */
export const HomePanel = ({
	title,
	description,
	action,
	children,
	className,
}: HomePanelProps) => (
	<Card className={`min-w-0 overflow-hidden ${className ?? ""}`}>
		<div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
			<div className="min-w-0">
				<h2 className="font-medium tracking-tight">{title}</h2>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
			{action}
		</div>
		{children}
	</Card>
);

/** Centred message filling a panel body, for empty, error and gate states. */
export const HomePanelMessage = ({
	children,
}: {
	children: React.ReactNode;
}) => (
	<div className="flex min-h-48 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
		{children}
	</div>
);
