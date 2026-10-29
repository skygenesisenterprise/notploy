import type { GlobalStatus } from "@notploy/status";
import { cn } from "@/lib/utils";
import { type FreshnessState, statusLabel, statusTone } from "@/lib/view-model";
import { dotClass, toneClass } from "./status-badge";

interface StatusBannerProps {
	status: GlobalStatus;
	/** Human-readable "last updated" text, computed by the caller. */
	updatedLabel?: string;
}

export const StatusBanner = ({ status, updatedLabel }: StatusBannerProps) => {
	const tone = statusTone(status);
	return (
		<section
			className={cn("status-banner justify-between", toneClass(tone))}
			aria-live="polite"
		>
			<span className="flex items-center gap-2.5">
				<span className={cn("status-dot", dotClass(tone))} aria-hidden="true" />
				{statusLabel(status)}
			</span>
			{updatedLabel ? (
				<span
					className="text-xs font-normal opacity-80"
					suppressHydrationWarning
				>
					{updatedLabel}
				</span>
			) : null}
		</section>
	);
};

export const FreshnessNotice = ({
	freshness,
}: {
	freshness: FreshnessState;
}) => {
	if (freshness.kind === "live") {
		return null;
	}
	return (
		<div
			className={cn(
				"flex items-start gap-2.5 rounded-xl border border-border px-4 py-3 text-sm",
				toneClass(freshness.tone),
			)}
			role="status"
		>
			<span className={cn("status-dot mt-1.5", dotClass(freshness.tone))} />
			<span>{freshness.label}</span>
		</div>
	);
};
