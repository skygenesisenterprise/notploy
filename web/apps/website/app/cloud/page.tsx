import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/pages/PageHero";
import {
	CellGrid,
	ChoicePanels,
	PageFaq,
	SectionHeading,
} from "@/components/pages/PagePrimitives";
import { Button } from "@/components/ui/button";
import {
	IconCheck,
	IconCloud,
	IconGauge,
	IconHeadset,
	IconRefresh,
	IconRocket,
	IconServer2,
	IconSettings,
	IconShieldCheck,
} from "@tabler/icons-react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notploy Cloud — The managed Notploy service",
	description:
		"Notploy Cloud is the managed Notploy service operated by Notploy: control plane hosting, upgrades, availability and support handled for you, while your applications keep running on your own infrastructure.",
	alternates: {
		canonical: "https://notploy.com/cloud",
	},
};

const notployResponsibilities = [
	{
		icon: IconSettings,
		title: "Control plane operations",
		description:
			"The Notploy dashboard, its database and its supporting services are hosted, monitored and upgraded by the Notploy team.",
	},
	{
		icon: IconRefresh,
		title: "Upgrades and maintenance",
		description:
			"New versions, patches and maintenance windows are handled for you — you always run a supported release without planning a migration.",
	},
	{
		icon: IconGauge,
		title: "Availability of the service",
		description:
			"The managed control plane is operated with availability commitments, so your team is not on call for the platform itself.",
	},
	{
		icon: IconHeadset,
		title: "Support",
		description:
			"Direct support channels with response commitments for incidents and questions about the platform.",
	},
];

const yourResponsibilities = [
	{
		icon: IconServer2,
		title: "Your workloads and servers",
		description:
			"Your applications keep running on infrastructure you control. You decide which servers connect, what runs on them and who can access them.",
	},
	{
		icon: IconShieldCheck,
		title: "Access and governance",
		description:
			"Teams, roles, permissions and secrets remain under your organization's governance, exactly as with Self.",
	},
];

const cloudCapabilities = [
	{
		icon: IconRocket,
		title: "No infrastructure to provision",
		description:
			"Skip the installation step entirely. Create your organization and start deploying — the Notploy control plane is already running.",
	},
	{
		icon: IconRefresh,
		title: "Always up to date",
		description:
			"Feature releases, security patches and upgrades are rolled out by the Notploy team without downtime planning on your side.",
	},
	{
		icon: IconCloud,
		title: "Operated by Notploy",
		description:
			"Notploy Cloud is run by Notploy (Sky Genesis Enterprise) — the same people who build the product — not by an anonymous reseller.",
	},
	{
		icon: IconGauge,
		title: "A fast path to production",
		description:
			"Ideal for teams that want the Notploy deployment experience immediately, without an initial hosting and setup phase.",
	},
];

const cloudFaqs = [
	{
		question: "Is Notploy Cloud just Self hosted by you?",
		answer:
			"No. Notploy Cloud is a managed service: the control plane is operated, monitored and upgraded by Notploy, with support and availability commitments. Self is the edition you run and operate yourself. The platform capabilities are shared; the operating models are different.",
	},
	{
		question: "Where do my applications run?",
		answer:
			"Your applications run on the servers you connect — your own servers or infrastructure, depending on your setup. Notploy manages the control plane, not a hidden multi-tenant runtime you cannot see.",
	},
	{
		question: "Can I switch between Self and Cloud?",
		answer:
			"Yes. Both editions run the same platform, so moving from one operating model to the other does not mean relearning the product or redesigning your projects.",
	},
	{
		question: "Who is Cloud for?",
		answer:
			"Teams that want Notploy without operating it: small teams without a dedicated ops function, organizations that prefer a managed service, and anyone evaluating Notploy who wants to start without provisioning a server first.",
	},
	{
		question: "How is Cloud priced?",
		answer:
			"Cloud is a paid managed service with plans based on the infrastructure you connect. Notploy Self remains free and open source. See the pricing page for current plans.",
	},
];

export default function CloudPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Notploy Cloud"
				badgeDetail="Managed by Notploy"
				title="Notploy,"
				highlight="operated for you"
				description="Notploy Cloud is the managed Notploy service operated by Notploy. The control plane is hosted, upgraded and supported by the team that builds the product — so you get the platform without taking on its operations."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="https://app.notploy.com/register" target="_blank">
								Get started with Cloud
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href="/pricing">
								See pricing
								<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/self", label: "Compare with Self" },
					{ href: "/platform", label: "Explore the platform" },
					{
						href: "https://docs.notploy.com/docs/core/differences",
						label: "Cloud vs Self docs",
						external: true,
					},
				]}
			>
				<div className="mx-auto grid max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3">
					{[
						{ label: "Control plane", value: "Operated by Notploy" },
						{ label: "Your workloads", value: "Your servers" },
						{ label: "Support", value: "Included" },
					].map((item) => (
						<div key={item.label} className="bg-card px-5 py-4">
							<p className="text-sm text-muted-foreground">{item.label}</p>
							<p className="mt-1 text-base font-semibold text-foreground">
								{item.value}
							</p>
						</div>
					))}
				</div>
			</PageHero>

			<section
				aria-labelledby="a-managed-service-not-a-hosted-copy"
				className="py-20 sm:py-28"
			>
				<Container>
					<SectionHeading
						id="a-managed-service-not-a-hosted-copy"
						title="A managed service, not a hosted copy"
						description="Running Notploy yourself and using Notploy Cloud are different operating models. Here is precisely who is responsible for what."
					/>

					<div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
						<div className="rounded-2xl border border-primary bg-primary p-8 text-primary-foreground">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h3 className="font-display text-2xl tracking-tight">
									Notploy operates
								</h3>
								<span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-sm font-medium">
									Managed
								</span>
							</div>
							<ul className="mt-8 space-y-6">
								{notployResponsibilities.map((item) => (
									<li key={item.title} className="flex gap-4">
										<item.icon
											className="mt-0.5 h-6 w-6 shrink-0 text-primary-foreground"
											stroke={1.5}
											aria-hidden="true"
										/>
										<div>
											<h4 className="text-lg font-semibold">{item.title}</h4>
											<p className="mt-1 text-base leading-relaxed text-primary-foreground/75">
												{item.description}
											</p>
										</div>
									</li>
								))}
							</ul>
						</div>

						<div className="rounded-2xl border border-border/50 bg-card p-8">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h3 className="font-display text-2xl tracking-tight">
									You keep
								</h3>
								<span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
									Your control
								</span>
							</div>
							<ul className="mt-8 space-y-6">
								{yourResponsibilities.map((item) => (
									<li key={item.title} className="flex gap-4">
										<item.icon
											className="mt-0.5 h-6 w-6 shrink-0 text-primary"
											stroke={1.5}
											aria-hidden="true"
										/>
										<div>
											<h4 className="text-lg font-semibold text-foreground">
												{item.title}
											</h4>
											<p className="mt-1 text-base leading-relaxed text-muted-foreground">
												{item.description}
											</p>
										</div>
									</li>
								))}
								<li className="flex gap-4 border-t border-border/40 pt-6">
									<IconCheck
										className="mt-0.5 h-6 w-6 shrink-0 text-primary"
										aria-hidden="true"
									/>
									<p className="text-base leading-relaxed text-muted-foreground">
										Nothing about your applications, data or credentials moves
										to Notploy. The service runs the control plane; the
										workloads stay yours.
									</p>
								</li>
							</ul>
						</div>
					</div>
				</Container>
			</section>

			<CellGrid
				id="what-cloud-adds-on-top-of-self"
				title="What Cloud adds on top of Self"
				description="Same platform, different responsibility model — plus the expectations you would have from a managed service."
				items={cloudCapabilities}
				columns={2}
			/>

			<ChoicePanels
				id="self-or-cloud"
				title="Self or Cloud?"
				description="Both editions share the same platform capabilities. The choice is about who operates the control plane."
				panels={[
					{
						name: "Notploy Self",
						tagline: "You operate the platform",
						description:
							"The open-source edition. Install it on infrastructure you own and keep full control over updates, data and network boundaries.",
						bullets: [
							"Free, open source (Apache-2.0)",
							"You install, upgrade and operate the control plane",
							"Maximum control: air-gapped, restricted networks, custom policies",
							"Best for self-hosters, homelabs and infrastructure teams",
						],
						cta: "Explore Self",
						href: "/self",
					},
					{
						name: "Notploy Cloud",
						tagline: "Notploy operates it for you",
						description:
							"The managed service operated by Notploy. The control plane is run and upgraded for you, with support and availability commitments.",
						bullets: [
							"Managed service operated by Notploy",
							"Control plane hosted, monitored and upgraded for you",
							"Support and availability commitments",
							"Best for teams that want Notploy without operating it",
						],
						cta: "Get started",
						href: "https://app.notploy.com/register",
						external: true,
						highlighted: true,
					},
				]}
			/>

			<PageFaq
				id="notploy-cloud-faqs"
				title="Notploy Cloud FAQs"
				description="What the managed service covers, and what stays on your side."
				faqs={cloudFaqs}
			/>

			<CallToAction />
		</div>
	);
}
