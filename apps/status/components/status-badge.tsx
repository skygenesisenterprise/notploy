import type { GlobalStatus, IncidentSeverity } from "@notploy/status";
import { cn } from "@/lib/utils";
import {
	componentStatusLabel,
	severityLabel,
	severityTone,
	statusLabel,
	statusTone,
	type Tone,
} from "@/lib/view-model";

export const toneClass = (tone: Tone): string => `tone-${tone}`;
export const dotClass = (tone: Tone): string => `dot-${tone}`;

/** Foreground-only tone, for inline status words. */
export const toneTextClass = (tone: Tone): string =>
	(
		({
			green: "text-[var(--status-operational)]",
			amber: "text-[var(--status-degraded)]",
			orange: "text-[var(--status-partial)]",
			red: "text-[var(--status-critical)]",
			blue: "text-[var(--status-maintenance)]",
			neutral: "text-muted-foreground",
		}) satisfies Record<Tone, string>
	)[tone];

export const toneForStatus = (status: GlobalStatus): Tone => statusTone(status);

interface StatusBadgeProps {
	status: GlobalStatus;
	/** Use the shorter component wording ("Operational" vs "All systems…"). */
	scope?: "page" | "component";
	pending?: boolean;
	className?: string;
}

export const StatusBadge = ({
	status,
	scope = "component",
	pending = false,
	className,
}: StatusBadgeProps) => (
	<span
		className={cn("status-badge", toneClass(statusTone(status)), className)}
	>
		<span className="status-dot" aria-hidden="true" />
		{scope === "page" ? statusLabel(status) : componentStatusLabel(status)}
		{pending ? (
			<span className="font-normal opacity-70">(recovering)</span>
		) : null}
	</span>
);

interface SeverityBadgeProps {
	severity: IncidentSeverity;
	className?: string;
}

export const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => (
	<span
		className={cn("status-badge", toneClass(severityTone(severity)), className)}
	>
		{severityLabel(severity)}
	</span>
);
