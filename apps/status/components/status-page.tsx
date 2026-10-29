import type {
	PublicIncidentDto,
	PublicMaintenanceDto,
	PublicPageDto,
} from "@notploy/status";
import { AlertTriangle, CalendarClock, DatabaseZap } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "./empty-state";
import { IncidentCard } from "./incident-card";
import { LiveStatus } from "./live-status";
import { MaintenanceCard } from "./maintenance-card";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { Subscribe } from "./subscribe";

export interface StatusPageViewProps {
	page: PublicPageDto;
	activeIncidents: PublicIncidentDto[];
	scheduledMaintenances: PublicMaintenanceDto[];
	resolvedIncidents: PublicIncidentDto[];
	snapshotMode: boolean;
}

export const StatusPageView = ({
	page,
	activeIncidents,
	scheduledMaintenances,
	resolvedIncidents,
	snapshotMode,
}: StatusPageViewProps) => (
	<div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6">
		<SiteHeader name={page.name} slug={page.slug} />
		<main className="flex flex-col gap-10 py-8">
			{page.description ? (
				<p className="max-w-2xl text-sm text-muted-foreground">
					{page.description}
				</p>
			) : null}

			{snapshotMode ? (
				<div className="flex items-start gap-2.5 rounded-xl border border-border px-4 py-3 text-sm tone-amber">
					<DatabaseZap className="mt-0.5 size-4" aria-hidden="true" />
					<span>
						Live storage is unavailable — this page serves the last known public
						state.
					</span>
				</div>
			) : null}

			<LiveStatus
				slug={page.slug}
				initialPage={page}
				refreshIntervalSeconds={page.refreshIntervalSeconds}
			/>

			{activeIncidents.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Active incidents
					</h2>
					{activeIncidents.map((incident) => (
						<IncidentCard key={incident.id} incident={incident} />
					))}
				</section>
			) : null}

			{scheduledMaintenances.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Scheduled maintenance
					</h2>
					{scheduledMaintenances.map((maintenance) => (
						<MaintenanceCard key={maintenance.id} maintenance={maintenance} />
					))}
				</section>
			) : null}

			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Past incidents
					</h2>
					<Link
						href={`/p/${page.slug}/history`}
						className="text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
					>
						View full history
					</Link>
				</div>
				{resolvedIncidents.length > 0 ? (
					<div className="flex flex-col gap-3">
						{resolvedIncidents.map((incident) => (
							<IncidentCard
								key={incident.id}
								incident={incident}
								withTimeline={false}
							/>
						))}
					</div>
				) : (
					<EmptyState
						icon={AlertTriangle}
						message="No resolved incident in the recent history."
					/>
				)}
			</section>

			{scheduledMaintenances.length === 0 ? (
				<EmptyState
					icon={CalendarClock}
					message="No maintenance is currently scheduled."
				/>
			) : null}

			<Subscribe slug={page.slug} />
		</main>
		<SiteFooter name={page.name} />
	</div>
);
