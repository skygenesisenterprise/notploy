import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/ghost";

interface JobCardProps {
	job: Job;
}

export function JobCard({ job }: JobCardProps) {
	return (
		<div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center gap-3">
					<h3 className="text-lg font-semibold">{job.title}</h3>
					{job.region && (
						<Badge
							variant="secondary"
							className="flex items-center gap-1 text-xs"
						>
							<MapPin className="h-3 w-3" />
							{job.region}
						</Badge>
					)}
				</div>
				<p className="mt-3 text-sm text-muted-foreground">{job.description}</p>
			</div>
			<Button asChild variant="outline" className="shrink-0">
				<a
					href={job.applyUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Apply to ${job.title}`}
				>
					Apply
					<ArrowRight className="ml-2 h-4 w-4" />
				</a>
			</Button>
		</div>
	);
}
