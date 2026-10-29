import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentCard } from "@/components/incident-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { resolvePublicIncident, resolvePublicPage } from "@/lib/data";

export const dynamic = "force-dynamic";

interface IncidentRouteProps {
	params: Promise<{ slug: string; incidentId: string }>;
}

export const generateMetadata = async ({
	params,
}: IncidentRouteProps): Promise<Metadata> => {
	const { slug, incidentId } = await params;
	const incident = resolvePublicIncident(slug, incidentId);
	const page = resolvePublicPage(slug);
	return {
		title: incident ? `${incident.title} · ${page?.name ?? slug}` : "Incident",
	};
};

export default async function IncidentRoute({ params }: IncidentRouteProps) {
	const { slug, incidentId } = await params;
	const page = resolvePublicPage(slug);
	const incident = resolvePublicIncident(slug, incidentId);
	if (!page || !incident) {
		notFound();
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6">
			<SiteHeader name={page.name} slug={page.slug} />
			<main className="flex flex-col gap-6 py-8">
				<Link
					href={`/p/${page.slug}`}
					className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back to status
				</Link>
				<IncidentCard incident={incident} />
			</main>
			<SiteFooter name={page.name} />
		</div>
	);
}
