import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryList } from "@/components/history-list";
import { MaintenanceCard } from "@/components/maintenance-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
	listHistoryEntries,
	listScheduledMaintenances,
	resolvePublicPage,
} from "@/lib/data";

export const dynamic = "force-dynamic";

interface HistoryRouteProps {
	params: Promise<{ slug: string }>;
}

export const generateMetadata = async ({
	params,
}: HistoryRouteProps): Promise<Metadata> => {
	const { slug } = await params;
	const page = resolvePublicPage(slug);
	return { title: page ? `${page.name} history` : "Status history" };
};

export default async function HistoryRoute({ params }: HistoryRouteProps) {
	const { slug } = await params;
	const page = resolvePublicPage(slug);
	if (!page) {
		notFound();
	}
	const entries = listHistoryEntries(slug, 50);
	const maintenances = listScheduledMaintenances(slug);

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6">
			<SiteHeader name={page.name} slug={page.slug} />
			<main className="flex flex-col gap-10 py-8">
				<div className="flex flex-col gap-1">
					<h1 className="text-lg font-semibold">Incident history</h1>
					<p className="text-sm text-muted-foreground">
						Every published incident and maintenance event, most recent first.
					</p>
				</div>

				{maintenances.length > 0 ? (
					<section className="flex flex-col gap-3">
						<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Current &amp; upcoming maintenance
						</h2>
						{maintenances.map((maintenance) => (
							<MaintenanceCard key={maintenance.id} maintenance={maintenance} />
						))}
					</section>
				) : null}

				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Timeline
					</h2>
					<HistoryList entries={entries} />
				</section>
			</main>
			<SiteFooter name={page.name} />
		</div>
	);
}
