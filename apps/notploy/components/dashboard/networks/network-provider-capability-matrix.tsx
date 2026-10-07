import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { networkCapabilityLabels } from "./network-provider-meta";

interface Props {
	capabilities: Record<string, boolean>;
	className?: string;
	compact?: boolean;
}

const CAPABILITY_ORDER = [
	"networks",
	"bridge",
	"overlay",
	"ipam",
	"internal",
	"attachable",
	"peers",
	"subnets",
	"mesh",
	"multiServer",
	"encrypted",
	"remoteAccess",
	"natTraversal",
	"healthChecks",
	"automaticSync",
	"connectivityTest",
] as const;

export const NetworkProviderCapabilityMatrix = ({
	capabilities,
	className,
	compact = false,
}: Props) => {
	const entries = CAPABILITY_ORDER.filter(
		(key) => capabilities[key] !== undefined,
	);

	return (
		<div
			className={cn("flex flex-wrap gap-1.5", compact && "gap-1", className)}
		>
			{entries.map((key) => {
				const supported = capabilities[key];
				const label = networkCapabilityLabels[key] ?? key;
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
		</div>
	);
};
