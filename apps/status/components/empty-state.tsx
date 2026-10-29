import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon?: LucideIcon;
	message: string;
}

export const EmptyState = ({ icon: Icon, message }: EmptyStateProps) => (
	<div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
		{Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
		<span>{message}</span>
	</div>
);
