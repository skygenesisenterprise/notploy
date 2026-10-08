import { CallToAction } from "@/components/CallToAction";
import { Faqs } from "@/components/Faqs";
import { Hero } from "@/components/Hero";
import { Testimonials } from "@/components/Testimonials";
import { FirstFeaturesSection } from "@/components/first-features";
import { SecondaryFeaturesSections } from "@/components/secondary-features";
import { Sponsors } from "@/components/sponsors";
import { StatsSection } from "@/components/stats";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: {
		absolute: "Notploy - Deploy and operate applications on infrastructure you own",
	},
	description:
		"Open-source, self-hostable platform for deploying and operating applications, databases, Docker Compose projects, servers and clusters on infrastructure you own.",
};

export default function Home() {
	return (
		<div>
			<main>
				<Hero />
				<FirstFeaturesSection />
				<SecondaryFeaturesSections />
				<StatsSection />
				<Testimonials />
				<Faqs />
				{/* <Sponsors /> */}
				<CallToAction />
			</main>
		</div>
	);
}
