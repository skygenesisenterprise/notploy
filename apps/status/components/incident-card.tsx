import type { PublicIncidentDto } from "@notploy/status";
import { cn } from "@/lib/utils";
import { incidentStateLabel, severityTone } from "@/lib/view-model";
import { RelativeTime } from "./relative-time";
import { SeverityBadge, toneTextClass } from "./status-badge";

const borderTone: Record<string, string> = {
	green: "border-l-[var(--status-operational)]",
	amber: "border-l-[var(--status-degraded)]",
	orange: "border-l-[var(--status-partial)]",
	red: "border-l-[var(--status-critical)]",
	blue: "border-l-[var(--status-maintenance)]",
	neutral: "border-l-[var(--muted-foreground)]",
};

interface IncidentCardProps {
	incident: PublicIncidentDto;
	/** Show the public timeline of updates (active incidents). */
	withTimeline?: boolean;
}

export const IncidentCard = ({
	incident,
	withTimeline = true,
}: IncidentCardProps) => {
	const tone = severityTone(incident.severity);
	return (
		<article
			className={cn(
				"status-card flex flex-col gap-4 border-l-4 p-5",
				borderTone[tone],
			)}
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h3 className="font-semibold">{incident.title}</h3>
					<p className="text-xs text-muted-foreground">
						<span className={cn("font-medium", toneTextClass(tone))}>
							{incidentStateLabel(incident.state)}
						</span>{" "}
						· started <RelativeTime iso={incident.startedAt} />
						{incident.resolvedAt ? (
							<>
								{" "}
								· resolved <RelativeTime iso={incident.resolvedAt} />
							</>
						) : null}
					</p>
				</div>
				<SeverityBadge severity={incident.severity} />
			</header>
			{incident.summary ? (
				<p className="text-sm text-muted-foreground">{incident.summary}</p>
			) : null}
			{withTimeline && incident.updates.length > 0 ? (
				<ol className="flex flex-col gap-3 border-l border-border pl-4">
					{[...incident.updates].reverse().map((update) => (
						<li key={update.id} className="flex flex-col gap-0.5">
							<p className="text-xs text-muted-foreground">
								<span className="font-medium text-foreground">
									{incidentStateLabel(update.state)}
								</span>{" "}
								· <RelativeTime iso={update.createdAt} />
							</p>
							<p className="text-sm">{update.message}</p>
						</li>
					))}
				</ol>
			) : null}
		</article>
	);
};
