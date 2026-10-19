import { CallToAction } from "@/components/CallToAction";
import { Faqs } from "@/components/Faqs";
import { CommunityMarquee } from "@/components/home/CommunityMarquee";
import { EditionsCompact } from "@/components/home/EditionsCompact";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { HeroBoard } from "@/components/home/HeroBoard";
import { OpenStats } from "@/components/home/OpenStats";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: {
		absolute:
			"Notploy - The open-source infrastructure platform for deploying and operating applications",
	},
	description:
		"Notploy is an open-source operational layer for deploying and operating applications on infrastructure you control. Deploy applications, databases and Compose projects, manage servers and clusters, and handle routing, certificates and backups — self-hosted with Notploy Self or managed with Notploy Cloud.",
};

export default function Home() {
	return (
		<main>
			<HeroBoard />
			<FeatureGrid />
			<ProductShowcase />
			<OpenStats />
			<CommunityMarquee />
			<EditionsCompact />
			<Faqs />
			<CallToAction />
		</main>
	);
}
