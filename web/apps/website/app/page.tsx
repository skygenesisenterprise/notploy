import { CallToAction } from "@/components/CallToAction";
import { Faqs } from "@/components/Faqs";
import { Hero } from "@/components/Hero";
import { CommunitySection } from "@/components/community-section";
import { FirstFeaturesSection } from "@/components/first-features";
import { HowItWorks } from "@/components/how-it-works";
import { ProblemSection } from "@/components/problem-section";
import { SecondaryFeaturesSections } from "@/components/secondary-features";
import { SelfVsCloud } from "@/components/self-vs-cloud";
import { StatsSection } from "@/components/stats";
import { WaysOfWorking } from "@/components/ways-of-working";
import { WhatIsNotploy } from "@/components/what-is-notploy";
import { WhoIsItFor } from "@/components/who-is-it-for";
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
		<div>
			<main>
				<Hero />
				<WhatIsNotploy />
				<ProblemSection />
				<FirstFeaturesSection />
				<HowItWorks />
				<SecondaryFeaturesSections />
				<SelfVsCloud />
				<WaysOfWorking />
				<WhoIsItFor />
				<CommunitySection />
				<StatsSection />
				<Faqs />
				<CallToAction />
			</main>
		</div>
	);
}
