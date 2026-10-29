import type { PublicMaintenanceDto } from "@notploy/status";
import { cn } from "@/lib/utils";
import { formatDateTime, maintenanceStateLabel } from "@/lib/view-model";
import { RelativeTime } from "./relative-time";

const stateTone: Record<string, string> = {
	scheduled: "tone-blue",
	in_progress: "tone-blue",
	completed: "tone-neutral",
	cancelled: "tone-neutral",
};

export const MaintenanceCard = ({
	maintenance,
}: {
	maintenance: PublicMaintenanceDto;
}) => (
	<article className="status-card flex flex-col gap-3 border-l-4 border-l-[var(--status-maintenance)] p-5">
		<header className="flex flex-wrap items-start justify-between gap-3">
			<h3 className="font-semibold">{maintenance.title}</h3>
			<span
				className={cn(
					"status-badge",
					stateTone[maintenance.state] ?? "tone-blue",
				)}
			>
				{maintenanceStateLabel(maintenance.state)}
			</span>
		</header>
		{maintenance.description ? (
			<p className="text-sm text-muted-foreground">{maintenance.description}</p>
		) : null}
		<p className="text-xs text-muted-foreground">
			{formatDateTime(maintenance.startAt)} →{" "}
			{formatDateTime(maintenance.endAt)} ({maintenance.timeZone}) · starts{" "}
			<RelativeTime iso={maintenance.startAt} />
		</p>
	</article>
);
