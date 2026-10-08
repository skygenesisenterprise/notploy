import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	IconCheck,
	IconCloud,
	IconGauge,
	IconHeadset,
	IconRefresh,
	IconShieldCheck,
	IconServer2,
	IconSettings,
} from "@tabler/icons-react";
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

const managedResponsibilities = [
	{
		icon: IconSettings,
		title: "Control plane operations",
		who: "Notploy",
		description:
			"The Notploy dashboard, its database and its supporting services are hosted, monitored and upgraded by the Notploy team.",
	},
	{
		icon: IconRefresh,
		title: "Upgrades and maintenance",
		who: "Notploy",
		description:
			"New versions, patches and maintenance windows are handled for you — you always run a supported release without planning a migration.",
	},
	{
		icon: IconGauge,
		title: "Availability of the service",
		who: "Notploy",
		description:
			"The managed control plane is operated with availability commitments, so your team is not on call for the platform itself.",
	},
	{
		icon: IconServer2,
		title: "Your workloads and servers",
		who: "You",
		description:
			"Your applications keep running on infrastructure you control. You decide which servers connect, what runs on them and who can access them.",
	},
	{
		icon: IconShieldCheck,
		title: "Access and governance",
		who: "You",
		description:
			"Teams, roles, permissions and secrets remain under your organization's governance, exactly as with Self.",
	},
	{
		icon: IconHeadset,
		title: "Support",
		who: "Notploy",
		description:
			"Direct support channels with response commitments for incidents and questions about the platform.",
	},
];

const cloudCapabilities = [
	{
		title: "No infrastructure to provision",
		description:
			"Skip the installation step entirely. Create your organization and start deploying — the Notploy control plane is already running.",
	},
	{
		title: "Always up to date",
		description:
			"Feature releases, security patches and upgrades are rolled out by the Notploy team without downtime planning on your side.",
	},
	{
		title: "Operated by Notploy",
		description:
			"Notploy Cloud is run by Notploy (Sky Genesis Enterprise) — the same people who build the product — not by an anonymous reseller.",
	},
	{
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
			<section className="relative overflow-hidden border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-4xl text-center">
						<p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
							Notploy Cloud
						</p>
						<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
							Notploy, operated for you
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Notploy Cloud is the managed Notploy service operated by Notploy.
							The control plane is hosted, upgraded and supported by the team
							that builds the product — so you get the platform without taking
							on its operations.
						</p>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link
									href="https://app.notploy.com/register"
									target="_blank"
									aria-label="Create a Notploy Cloud account"
								>
									Get started with Cloud
								</Link>
							</Button>
							<Button variant="outline" className="rounded-full" asChild>
								<Link href="/pricing">See pricing</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<section aria-labelledby="a-managed-service-not-a-hosted-copy" className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
							Who operates what
						</p>
						<h2 id="a-managed-service-not-a-hosted-copy" className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							A managed service, not a hosted copy
						</h2>
						<p className="mt-4 text-lg tracking-tight text-muted-foreground">
							Running Notploy yourself and using Notploy Cloud are different
							operating models. Here is precisely who is responsible for what.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
						{managedResponsibilities.map((item) => (
							<div
								key={item.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex items-center justify-between">
									<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
										<item.icon className="h-5 w-5" />
									</div>
									<span className="rounded-full border border-border/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										{item.who}
									</span>
								</div>
								<h3 className="text-lg font-semibold">{item.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{item.description}
								</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section aria-labelledby="what-cloud-adds-on-top-of-self" className="border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
							Beyond self-hosting
						</p>
						<h2 id="what-cloud-adds-on-top-of-self" className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							What Cloud adds on top of Self
						</h2>
						<p className="mt-4 text-lg tracking-tight text-muted-foreground">
							Same platform, different responsibility model — plus the
							expectations you would have from a managed service.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2">
						{cloudCapabilities.map((capability) => (
							<div
								key={capability.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<h3 className="text-lg font-semibold">{capability.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{capability.description}
								</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section aria-labelledby="self-or-cloud" className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
							Choosing an edition
						</p>
						<h2 id="self-or-cloud" className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							Self or Cloud?
						</h2>
						<p className="mt-4 text-lg tracking-tight text-muted-foreground">
							Both editions share the same platform capabilities. The choice is
							about who operates the control plane.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-2">
						<div className="rounded-xl border border-border/50 bg-card p-6">
							<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<IconServer2 className="h-5 w-5" />
							</div>
							<h3 className="text-lg font-semibold">Notploy Self</h3>
							<ul className="mt-6 space-y-3 text-sm text-muted-foreground">
								{[
									"Free, open source (Apache-2.0)",
									"You install, upgrade and operate the control plane",
									"Maximum control: air-gapped, restricted networks, custom policies",
									"Best for self-hosters, homelabs and infrastructure teams",
								].map((bullet) => (
									<li key={bullet} className="flex gap-3">
										<IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
										<span>{bullet}</span>
									</li>
								))}
							</ul>
							<div className="mt-6">
								<Button variant="outline" className="rounded-full" asChild>
									<Link href="/self">Explore Self</Link>
								</Button>
							</div>
						</div>
						<div className="rounded-xl border border-border/50 bg-card p-6">
							<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<IconCloud className="h-5 w-5" />
							</div>
							<h3 className="text-lg font-semibold">Notploy Cloud</h3>
							<ul className="mt-6 space-y-3 text-sm text-muted-foreground">
								{[
									"Managed service operated by Notploy",
									"Control plane hosted, monitored and upgraded for you",
									"Support and availability commitments",
									"Best for teams that want Notploy without operating it",
								].map((bullet) => (
									<li key={bullet} className="flex gap-3">
										<IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
										<span>{bullet}</span>
									</li>
								))}
							</ul>
							<div className="mt-6">
								<Button className="rounded-full" asChild>
									<Link href="https://app.notploy.com/register" target="_blank">
										Get started
									</Link>
								</Button>
							</div>
						</div>
					</div>
					<div className="mx-auto mt-10 max-w-2xl text-center">
						<p className="text-sm text-muted-foreground">
							Looking for the operational details?{" "}
							<Link
								href="https://docs.notploy.com/docs/core/differences"
								target="_blank"
								className="text-primary underline underline-offset-4 hover:text-primary/80"
							>
								Cloud vs Self in the documentation
							</Link>
							.
						</p>
					</div>
				</Container>
			</section>

			<section aria-labelledby="notploy-cloud-faqs" className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
							Common questions
						</p>
						<h2 id="notploy-cloud-faqs" className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							Notploy Cloud FAQs
						</h2>
					</div>
					<div className="mx-auto mt-12 w-full max-w-3xl">
						<Accordion type="single" collapsible>
							{cloudFaqs.map((faq, index) => (
								<AccordionItem value={`faq-${index}`} key={faq.question}>
									<AccordionTrigger className="text-left">
										{faq.question}
									</AccordionTrigger>
									<AccordionContent>{faq.answer}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
