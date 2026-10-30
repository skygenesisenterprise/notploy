import { Container } from "@/components/Container";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PageIntro } from "@/components/marketing/PageIntro";
import { PageFaq, SectionHeading } from "@/components/pages/PagePrimitives";
import { links } from "@/lib/content/links";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Trust & principles",
	description:
		"What European development means at Notploy, what self-hosting changes, which dependencies the platform relies on, and the claims we deliberately do not make.",
	alternates: { canonical: "https://notploy.com/trust" },
};

const commitments = [
	{
		title: "European development",
		body: "Notploy is developed by a European team. That describes where the work happens and who is accountable for it. It does not mean that every dependency, provider or deployment you configure stays in Europe — that depends on the infrastructure and services you choose.",
	},
	{
		title: "Self-hosting first",
		body: "The default way to run Notploy is on infrastructure you control. Notploy Self does not require a Notploy-hosted service to operate, and the platform can run without outbound access to a vendor cloud.",
	},
	{
		title: "Open source",
		body: "The platform source is published under Apache-2.0. You can read it, audit it, modify it and redistribute it. Issues and release notes are public.",
	},
	{
		title: "Transparent dependencies",
		body: "Notploy builds on Docker, Docker Compose, Docker Swarm and Traefik. Those are technologies you can inspect, replace or migrate away from, rather than a proprietary runtime only we understand.",
	},
	{
		title: "Your data stays yours",
		body: "With Self, code, databases, secrets and backups remain on infrastructure you own. With Cloud, your workloads run on the servers you connect; what the managed service operates is the control plane, and the documentation describes the split.",
	},
	{
		title: "Verifiable statements",
		body: "Capability claims are traced to the documentation or the product. Where something is in development or depends on your setup, we say so instead of turning it into a badge.",
	},
];

const notClaimed = [
	'We do not claim to be "fully sovereign": sovereignty depends on your hosting, providers and legal arrangements, not on a product label.',
	'We do not claim blanket "GDPR compliance". Notploy Self gives you the deployment model and controls; your obligations remain yours.',
	'We do not claim "100% European infrastructure". The platform runs wherever you install it, and Cloud relies on infrastructure that the documentation describes.',
	"We do not claim automatic high availability. Multi-node distributes workloads; redundancy is an architectural decision.",
	"We do not claim that every workload, runtime or enterprise requirement is supported. The limitations page lists what is not.",
];

const faqs = [
	{
		question: "Is Notploy Cloud operated by a different company?",
		answer:
			"Cloud is operated by the same team that builds Notploy. The responsibility split between Cloud and Self is documented; where it matters for a purchase, ask us in writing.",
	},
	{
		question: "Where is the website's analytics?",
		answer:
			"The marketing site can load Google Analytics and OpenPanel when they are configured; they are optional and the site works without them. The privacy policy describes what is collected.",
	},
	{
		question: "How do I report a security issue?",
		answer:
			"Use the vulnerability disclosure process documented on the documentation site. Please do not open a public issue for an unpatched vulnerability.",
	},
];

export default function TrustPage() {
	return (
		<main>
			<PageIntro
				eyebrow="Trust & principles"
				title="What we stand for."
				highlight="And what we do not claim."
				description="Notploy is built around ownership, open technology and European development. This page states those commitments precisely, including their limits."
				links={[
					{ href: links.docs.security, label: "Report a vulnerability", external: true },
					{ href: "/privacy", label: "Privacy policy" },
					{ href: "/terms-of-service", label: "Terms of service" },
				]}
			/>

			<section aria-labelledby="commitments" className="py-20 sm:py-24">
				<Container>
					<SectionHeading
						id="commitments"
						title="Commitments"
						description="Each statement describes what Notploy does, not what a deployment automatically guarantees."
						align="left"
					/>

					<dl className="mt-12 grid border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-3">
						{commitments.map((item) => (
							<div
								key={item.title}
								className="border-b border-r border-border/40 px-6 py-7"
							>
								<dt className="text-base font-semibold text-foreground">
									{item.title}
								</dt>
								<dd className="mt-2 text-base leading-relaxed text-muted-foreground">
									{item.body}
								</dd>
							</div>
						))}
					</dl>
				</Container>
			</section>

			<section
				aria-labelledby="not-claimed"
				className="border-y border-border/40 py-20 sm:py-24"
			>
				<Container>
					<SectionHeading
						id="not-claimed"
						title="What we do not claim"
						description="Labels are easy to print and hard to defend. These are deliberately absent from our copy."
						align="left"
					/>

					<ul className="mt-12 max-w-3xl space-y-4">
						{notClaimed.map((item) => (
							<li
								key={item}
								className="border-l-2 border-primary/40 pl-4 text-base leading-relaxed text-muted-foreground"
							>
								{item}
							</li>
						))}
					</ul>

					<p className="mt-8 max-w-3xl text-sm text-muted-foreground">
						Where a claim depends on your infrastructure or your legal
						obligations, the documentation is the place to check it.{" "}
						<Link
							href="/capabilities"
							className="text-foreground underline underline-offset-4 hover:text-primary"
						>
							See the capability domains
						</Link>
						.
					</p>
				</Container>
			</section>

			<PageFaq
				id="trust-faqs"
				title="Trust questions"
				description="The points that come up before a purchase or a security review."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
