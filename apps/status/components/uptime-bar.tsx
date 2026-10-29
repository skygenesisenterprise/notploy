import type { PublicComponentUptimeDto } from "@notploy/status";
import { cn } from "@/lib/utils";
import {
	componentStatusLabel,
	componentStatusTone,
	formatUptimePercent,
} from "@/lib/view-model";

const barClass = (
	status: PublicComponentUptimeDto["days"][number]["status"],
): string =>
	status === null
		? "dot-neutral opacity-40"
		: `dot-${componentStatusTone(status)}`;

/**
 * One segment per day over the window (oldest first). A day without data is
 * rendered muted, never green: the graph must not claim health nobody
 * observed.
 */
export const UptimeBar = ({ uptime }: { uptime: PublicComponentUptimeDto }) => {
	if (uptime.days.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">No uptime history yet.</p>
		);
	}
	return (
		<div className="flex flex-col gap-1.5">
			<div
				className="flex h-8 items-stretch gap-px"
				role="img"
				aria-label={`Uptime over the last ${uptime.windowDays} days`}
			>
				{uptime.days.map((day) => (
					<span
						key={day.date}
						title={`${day.date} — ${
							day.status === null ? "No data" : componentStatusLabel(day.status)
						}`}
						className={cn("flex-1 rounded-[2px]", barClass(day.status))}
					/>
				))}
			</div>
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span>{uptime.windowDays} days ago</span>
				<span className="font-medium text-foreground">
					{formatUptimePercent(uptime.uptimePercent)} uptime
				</span>
				<span>Today</span>
			</div>
		</div>
	);
};
