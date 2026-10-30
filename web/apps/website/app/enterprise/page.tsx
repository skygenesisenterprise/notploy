import { Container } from "@/components/Container";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PageIntro } from "@/components/marketing/PageIntro";
import { PageFaq, SectionHeading } from "@/components/pages/PagePrimitives";
import { links } from "@/lib/content/links";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "For teams & organisations",
	description:
		"Notploy for teams that need repeatable deployments, access control, audit trails and support — on infrastructure they control or through the managed platform.",
	alternates: { canonical: "https://notploy.com/enterprise" },
};

const capabilities = [
	{
		title: "Organisations & projects",
		description:
			"Separate environments, projects and access rules without running one installation per team.",
	},
	{
		title: "Roles & permissions",
		description:
			"Give people the access their work requires, and revoke it when it changes.",
	},
	{
		title: "Single sign-on",
		description:
			"Connect the identity provider you already run, with SCIM provisioning where the offer includes it.",
	},
	{
		title: "Audit logs",
		description:
			"Keep a trace of deployments, configuration changes and access decisions for internal review.",
	},
	{
		title: "Backups & recovery",
		description:
			"Schedule database and volume backups to storage you control, and test restores before you need them.",
	},
	{
		title: "Support",
		description:
			"Commercial support and contractual terms are available for teams that need them; the scope is agreed in writing.",
	},
];

const faqs = [
	{
		question: "Is this a third platform next to Self and Cloud?",
		answer:
			"No. It is the commercial offer for teams, on top of the same platform. You can run it self-hosted or use Cloud; what changes is the governance and support included.",
	},
	{
		question: "Do you provide compliance certification?",
		answer:
			"No. Notploy provides controls — access management, audit logs, self-hosting — that support your own compliance work. Certification and legal obligations stay with your organisation.",
	},
	{
		question: "Where can I get contractual terms?",
		answer:
			"Contact us. Commercial terms, data processing terms and support commitments are agreed in writing rather than asserted on a marketing page.",
	},
];

export default function EnterprisePage() {
	return (
		<main>
			<PageIntro
				eyebrow="For teams & organisations"
				title="Notploy,"
				highlight="with governance"
				description="The same platform, with the access control, audit trail and support a team needs when infrastructure is shared and decisions have to be explained."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="/contact">
								Talk to us
								<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href="/cloud">Explore Notploy Cloud</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/comparison", label: "Compare editions" },
					{ href: links.docs.sso, label: "SSO documentation", external: true },
					{ href: links.docs.auditLogs, label: "Audit logs documentation", external: true },
				]}
			/>

			<section aria-labelledby="team-capabilities" className="py-20 sm:py-24">
				<Container>
					<SectionHeading
						id="team-capabilities"
						title="What teams get"
						description="Governance features are documented individually; availability depends on the edition and the identity provider you use."
						align="left"
					/>

					<dl className="mt-12 grid border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-3">
						{capabilities.map((capability) => (
							<div
								key={capability.title}
								className="border-b border-r border-border/40 px-6 py-7"
							>
								<dt className="text-base font-semibold text-foreground">
									{capability.title}
								</dt>
								<dd className="mt-2 text-base leading-relaxed text-muted-foreground">
									{capability.description}
								</dd>
							</div>
						))}
					</dl>

					<p className="mt-8 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
						This page describes the commercial offer, not a separate product.
						Contractual commitments, service levels and data processing terms
						are agreed in writing.{" "}
						<Link
							href="/contact"
							className="text-foreground underline underline-offset-4 hover:text-primary"
						>
							Request the details
						</Link>
						.
					</p>
				</Container>
			</section>

			<section
				aria-labelledby="team-deployment"
				className="border-y border-border/40 py-20 sm:py-24"
			>
				<Container>
					<div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
						<div>
							<h2
								id="team-deployment"
								className="font-display text-3xl tracking-tight sm:text-4xl"
							>
								Deployed where your data already lives
							</h2>
							<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
								Self-hosted means the platform, the applications and the data
								can stay inside a boundary you define. Cloud keeps the same
								workloads on servers you connect, with the control plane
								operated for you.
							</p>
							<div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
								<Link
									href="/self"
									className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
								>
									Notploy Self
									<ArrowRight className="h-4 w-4" aria-hidden="true" />
								</Link>
								<Link
									href="/trust"
									className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
								>
									Read our principles
								</Link>
							</div>
						</div>

						<ul className="space-y-4">
							{[
								"Run on your own servers, or connect them to a managed control plane.",
								"Keep an audit trail of deployments and configuration changes.",
								"Use the identity provider your organisation already operates.",
								"Back up to storage inside your own account or network.",
								"Start with a single node and add capacity when the workload justifies it.",
							].map((item) => (
								<li
									key={item}
									className="flex gap-3 border-b border-border/40 pb-4 text-base leading-relaxed text-muted-foreground"
								>
									<span
										className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary"
										aria-hidden="true"
									/>
									<span>{item}</span>
								</li>
							))}
							<li className="text-sm text-muted-foreground">
								<a
									href={links.docs.featureMatrix}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
								>
									Check the feature matrix before committing
									<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
								</a>
							</li>
						</ul>
					</div>
				</Container>
			</section>

			<PageFaq
				id="enterprise-faqs"
				title="Team questions"
				description="What the commercial offer is — and is not."
				faqs={faqs}
			/>

			<FinalCta />
		</main>
	);
}
