import type { PublicHistoryEntryDto } from "@notploy/status";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryLabel, severityTone } from "@/lib/view-model";
import { EmptyState } from "./empty-state";
import { RelativeTime } from "./relative-time";

const dotForEntry = (entry: PublicHistoryEntryDto): string =>
	entry.severity ? `dot-${severityTone(entry.severity)}` : "dot-blue";

export const HistoryList = ({
	entries,
}: {
	entries: PublicHistoryEntryDto[];
}) => {
	if (entries.length === 0) {
		return (
			<EmptyState icon={History} message="No public incident history yet." />
		);
	}
	return (
		<ol className="status-card divide-y divide-border">
			{entries.map((entry) => (
				<li key={entry.id} className="flex gap-4 p-4">
					<span
						className={cn("status-dot mt-1.5", dotForEntry(entry))}
						aria-hidden="true"
					/>
					<div className="flex min-w-0 flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-medium">{entry.title}</span>
							{entry.state ? (
								<span className="status-badge tone-neutral">
									{categoryLabel(entry.state)}
								</span>
							) : null}
						</div>
						{entry.message ? (
							<p className="text-sm text-muted-foreground">{entry.message}</p>
						) : null}
						<p className="text-xs text-muted-foreground">
							<RelativeTime iso={entry.createdAt} />
						</p>
					</div>
				</li>
			))}
		</ol>
	);
};
