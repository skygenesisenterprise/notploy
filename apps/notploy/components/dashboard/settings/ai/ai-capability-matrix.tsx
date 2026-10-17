import { Check, CircleHelp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	AI_CAPABILITY_META,
	AI_CAPABILITY_ORDER,
	type AiCapabilities,
} from "./ai-provider-meta";

interface Props {
	capabilities: Partial<AiCapabilities>;
	verifiedCapabilities?: Partial<AiCapabilities> | null;
	className?: string;
	compact?: boolean;
}

export const AiCapabilityMatrix = ({
	capabilities,
	verifiedCapabilities,
	className,
	compact = false,
}: Props) => {
	const entries = AI_CAPABILITY_ORDER.filter(
		(key) => capabilities[key] !== undefined,
	);

	return (
		<div
			className={cn("flex flex-wrap gap-1.5", compact && "gap-1", className)}
		>
			{entries.map((key) => {
				const support = capabilities[key] ?? "unknown";
				const verified = verifiedCapabilities?.[key] === "supported";
				const meta = AI_CAPABILITY_META[key];
				const supported = support === "supported";
				return (
					<span
						key={key}
						title={`${meta.label}: ${
							verified
								? "verified by a connection test"
								: support === "supported"
									? "declared by the adapter"
									: support === "unknown"
										? "not verified"
										: "not supported"
						}`}
						className={cn(
							"inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
							compact && "px-1 text-[10px]",
							supported
								? verified
									? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
									: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
								: support === "unknown"
									? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
									: "border-border bg-muted/40 text-muted-foreground",
						)}
					>
						{supported ? (
							<Check className="size-3 shrink-0" aria-hidden="true" />
						) : support === "unknown" ? (
							<CircleHelp className="size-3 shrink-0" aria-hidden="true" />
						) : (
							<Minus className="size-3 shrink-0" aria-hidden="true" />
						)}
						{meta.label}
						{verified && <span className="sr-only"> verified</span>}
					</span>
				);
			})}
		</div>
	);
};
