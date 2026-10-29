import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusPageView } from "@/components/status-page";
import { loadStatusPage, resolvePublicPage } from "@/lib/data";

export const dynamic = "force-dynamic";

interface StatusPageRouteProps {
	params: Promise<{ slug: string }>;
}

export const generateMetadata = async ({
	params,
}: StatusPageRouteProps): Promise<Metadata> => {
	const { slug } = await params;
	const page = resolvePublicPage(slug);
	if (!page) {
		return { title: "Status page not found" };
	}
	return {
		title: page.name,
		description:
			page.description ||
			`Real-time status and uptime history for ${page.name}.`,
	};
};

export default async function StatusPageRoute({
	params,
}: StatusPageRouteProps) {
	const { slug } = await params;
	const data = loadStatusPage(slug);
	if (!data) {
		notFound();
	}
	return <StatusPageView {...data} />;
}
