import { AudiencePaths } from "@/components/marketing/AudiencePaths";
import { CapabilityOverview } from "@/components/marketing/CapabilityOverview";
import { EditionPaths } from "@/components/marketing/EditionPaths";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Hero } from "@/components/marketing/Hero";
import { Lifecycle } from "@/components/marketing/Lifecycle";
import { OpenSource } from "@/components/marketing/OpenSource";
import { Principles } from "@/components/marketing/Principles";
import { Topology } from "@/components/marketing/Topology";
import { PageFaq } from "@/components/pages/PagePrimitives";
import { homeFaqs } from "@/lib/content/home";
import { links, SITE_URL } from "@/lib/content/links";
import type { Metadata } from "next";

const TITLE = "Notploy — European PaaS tools for people & businesses";
const DESCRIPTION =
	"Deploy, operate and control the services you depend on — on infrastructure you control with Notploy Self, or through the managed Notploy Cloud. From a personal server or homelab to a growing multi-node infrastructure.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: SITE_URL },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: SITE_URL,
		siteName: "Notploy",
		locale: "en_GB",
		type: "website",
		images: "/og.png",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/og.png"],
	},
};

const structuredData = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			name: "Notploy",
			url: SITE_URL,
			logo: `${SITE_URL}/icon.svg`,
			slogan: "European PaaS tools for people & businesses",
			sameAs: [links.github.repo, links.community.discord],
		},
		{
			"@type": "SoftwareApplication",
			name: "Notploy",
			applicationCategory: "DeveloperApplication",
			operatingSystem: "Linux, Windows Server",
			url: SITE_URL,
			license: "https://www.apache.org/licenses/LICENSE-2.0",
			offers: {
				"@type": "Offer",
				price: "0",
				priceCurrency: "EUR",
				description: "Notploy Self, free and open source (Apache-2.0)",
			},
			description: DESCRIPTION,
		},
	],
};

/**
 * Homepage composition.
 *
 * Follows the rhythm of the previous site — capabilities, product screenshots,
 * editions, FAQ, calls to action — with the new positioning sections in between
 * and the same design language as the rest of the site.
 */
export default function Home() {
	return (
		<main>
			<script
				type="application/ld+json"
				// Static, server-rendered structured data.
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>
			<Hero />
			<CapabilityOverview />
			<Lifecycle />
			<AudiencePaths />
			<EditionPaths />
			<Topology />
			<Principles />
			<OpenSource />
			<PageFaq
				id="home-faqs"
				title="Questions before the first install"
				description="The practical points that decide between Self and Cloud — and what Notploy does not do for you."
				faqs={homeFaqs}
			/>
			<FinalCta />
		</main>
	);
}
