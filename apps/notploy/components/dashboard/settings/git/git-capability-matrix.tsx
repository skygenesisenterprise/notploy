import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { gitCapabilityLabels, gitCapabilityOrder } from "./git-provider-meta";

interface Props {
	capabilities: Record<string, boolean>;
	className?: string;
	/** Renders a tighter variant for inline use inside a provider row. */
	compact?: boolean;
	/** Cap on the number of badges, keeping rows readable. */
	max?: number;
}

/**
 * Capability badges for a Git provider, mirroring `DnsCapabilityMatrix`.
 *
 * The capabilities come from the provider adapter (via the health probe), never
 * from a provider-specific branch, so the UI hides what a connection cannot do
 * instead of letting a user pick an option that then fails at deploy time.
 */
export const GitCapabilityMatrix = ({
	capabilities,
	className,
	compact = false,
	max,
}: Props) => {
	const entries = gitCapabilityOrder.filter(
		(key) => capabilities[key] !== undefined,
	);
	const shown = typeof max === "number" ? entries.slice(0, max) : entries;
	const hiddenCount = entries.length - shown.length;

	return (
		<div
			className={cn(
				"flex flex-wrap gap-1.5",
				compact && "gap-1",
				className,
			)}
		>
			{shown.map((key) => {
				const supported = capabilities[key];
				const label = gitCapabilityLabels[key] ?? key;
				return (
					<span
						key={key}
						title={`${label}: ${supported ? "supported" : "not supported"}`}
						className={cn(
							"inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
							compact && "px-1 text-[10px]",
							supported
								? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
								: "border-border bg-muted/40 text-muted-foreground",
						)}
					>
						{supported ? (
							<Check className="size-3 shrink-0" aria-hidden="true" />
						) : (
							<Minus className="size-3 shrink-0" aria-hidden="true" />
						)}
						{label}
					</span>
				);
			})}
			{hiddenCount > 0 && (
				<span
					title={entries.slice(shown.length).join(", ")}
					className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums"
				>
					+{hiddenCount}
				</span>
			)}
		</div>
	);
};
