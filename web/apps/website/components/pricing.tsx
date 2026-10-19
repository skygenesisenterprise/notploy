"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CallToAction } from "./CallToAction";
import { ContactFormModal } from "./ContactFormModal";
import { Container } from "./Container";
import { PageHero } from "./pages/PageHero";
import { PageFaq, SectionHeading } from "./pages/PagePrimitives";
import { Button } from "./ui/button";
import { Reveal } from "./home/Reveal";

const CLOUD_APP_URL = "https://app.notploy.com";
const DOCS_INSTALL_URL = "https://docs.notploy.com/docs/core/installation";

const pricingFaqs = [
	{
		question: "Is Notploy free?",
		answer:
			"Yes. The core platform is open source under the Apache-2.0 license and the self-hosted edition is free to run on your own infrastructure.",
	},
	{
		question: "What is the difference between Self and Cloud?",
		answer:
			"Notploy Self is the open-source product you host yourself. Notploy Cloud is a managed service operated by Notploy Enterprise: we run the control plane and take on operational responsibility, while you keep using the same platform.",
	},
	{
		question: "Is there a limit on the number of deployments?",
		answer:
			"No. The platform does not limit the number of applications, databases, services or deployments you can run. Practical limits come from the capacity of the infrastructure you provide.",
	},
	{
		question: "What is the Enterprise edition?",
		answer:
			"A commercial edition with additional features and premium support, maintained by Sky Genesis Enterprise. It is available both as a managed service and self-hosted. Contact us to discuss your requirements.",
	},
	{
		question: "Do I need to provide my own server?",
		answer:
			"Yes. You provide your own infrastructure — a VPS, dedicated servers, on-premise hardware or machines from a hosting provider — and Notploy deploys and operates your workloads on it.",
	},
	{
		question: "What kind of support do I get?",
		answer:
			"Community support is available through Discord and GitHub for everyone. Commercial and enterprise customers can access premium support through Sky Genesis Enterprise.",
	},
];

const selfFeatures = [
	"Apache-2.0 open source",
	"Full platform, no feature gating",
	"Your servers, your data, your rules",
	"Applications, Compose and databases",
	"Servers and Docker Swarm clusters",
	"Community support via Discord",
];

const cloudFeatures = [
	"Everything in Self, managed for you",
	"Managed control plane and updates",
	"Operational responsibility handled",
	"Availability and support commitments",
	"Same platform, no migration surprise",
	"Start with an account, add your servers",
];

const enterpriseFeatures = [
	"Everything in Cloud, plus…",
	"Commercial edition",
	"Premium support from Sky Genesis Enterprise",
	"Deployment flexibility (Cloud or Self-hosted)",
	"Assistance for regulated environments",
	"Tailored onboarding",
];

function PlanFeatureList({
	features,
	highlighted,
}: {
	features: string[];
	highlighted?: boolean;
}) {
	return (
		<ul className="mt-6 flex-1 space-y-3">
			{features.map((feature) => (
				<li
					key={feature}
					className={cn(
						"flex gap-3 text-base",
						highlighted ? "text-primary-foreground/75" : "text-muted-foreground",
					)}
				>
					<Check
						className={cn(
							"mt-1 h-4 w-4 shrink-0",
							highlighted ? "text-primary-foreground" : "text-primary",
						)}
						aria-hidden="true"
					/>
					<span>{feature}</span>
				</li>
			))}
		</ul>
	);
}

export function Pricing() {
	const [openContactModal, setOpenContactModal] = useState(false);

	return (
		<div className="relative w-full bg-background">
			<PageHero
				badge="Pricing"
				badgeDetail="Apache-2.0 · No per-seat fees"
				badgeHref="https://github.com/skygenesisenterprise/notploy"
				title="Open source"
				highlight="at the core"
				description="Self-host the full platform for free, or let us run it for you. No per-seat charges on Self, and no reduced edition hiding the capabilities you need."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href={DOCS_INSTALL_URL} target="_blank">
								Install Notploy
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href={`${CLOUD_APP_URL}/register`} target="_blank">
								Get started with Cloud
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/self", label: "Explore Self" },
					{ href: "/cloud", label: "Explore Cloud" },
					{ href: "/enterprise", label: "Enterprise" },
				]}
			/>

			<section aria-labelledby="pricing-heading" className="pb-20 sm:pb-28">
				<Container>
					<SectionHeading
						id="pricing-heading"
						title="Three ways to run Notploy"
						description="Same platform, different operating responsibility. Start free on your own servers, or hand the control plane to Notploy."
					/>

					<div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-3">
						<Reveal>
							<section className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-8">
								<h3 className="font-display text-2xl tracking-tight text-foreground">
									Self
								</h3>
								<p className="mt-2 text-base font-medium text-primary">
									Open-source, self-hosted on your infrastructure
								</p>
								<div className="mt-6">
									<p className="font-display text-4xl tracking-tight text-foreground">
										Free
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										forever, Apache-2.0 core
									</p>
								</div>
								<PlanFeatureList features={selfFeatures} />
								<div className="mt-8">
									<Link
										href={DOCS_INSTALL_URL}
										target="_blank"
										className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
									>
										Install Notploy
									</Link>
								</div>
							</section>
						</Reveal>

						<Reveal delay={0.08}>
							<section className="flex h-full flex-col rounded-2xl border border-primary bg-primary p-8 text-primary-foreground">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h3 className="font-display text-2xl tracking-tight">Cloud</h3>
									<span className="rounded-full bg-primary-foreground/15 px-3 py-1 text-sm font-medium">
										Managed
									</span>
								</div>
								<p className="mt-2 text-base font-medium text-primary-foreground">
									Managed Notploy operated by Notploy Enterprise
								</p>
								<div className="mt-6">
									<p className="font-display text-4xl tracking-tight">
										Managed
									</p>
									<p className="mt-1 text-sm text-primary-foreground/75">
										We run the control plane, you bring the infrastructure
									</p>
								</div>
								<PlanFeatureList features={cloudFeatures} highlighted />
								<div className="mt-8">
									<Link
										href={`${CLOUD_APP_URL}/register`}
										target="_blank"
										className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary-foreground px-5 text-sm font-medium text-primary transition-colors hover:bg-primary-foreground/90"
									>
										Get Started
									</Link>
								</div>
							</section>
						</Reveal>

						<Reveal delay={0.16}>
							<section className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-8">
								<h3 className="font-display text-2xl tracking-tight text-foreground">
									Enterprise
								</h3>
								<p className="mt-2 text-base font-medium text-primary">
									Commercial edition and premium support
								</p>
								<div className="mt-6">
									<p className="font-display text-4xl tracking-tight text-foreground">
										Custom
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Cloud or self-hosted, tailored to your requirements
									</p>
								</div>

								<div className="mt-6 grid grid-cols-2 gap-3">
									<div className="rounded-xl border border-border/50 bg-background/50 px-4 py-3">
										<p className="text-center font-medium text-foreground">
											Cloud
										</p>
										<p className="mt-0.5 text-center text-xs text-muted-foreground">
											We host and manage everything for you
										</p>
									</div>
									<div className="rounded-xl border border-border/50 bg-background/50 px-4 py-3">
										<p className="text-center font-medium text-foreground">
											Self Hosted
										</p>
										<p className="mt-0.5 text-center text-xs text-muted-foreground">
											Install on-prem or in your own cloud
										</p>
									</div>
								</div>

								<PlanFeatureList features={enterpriseFeatures} />
								<div className="mt-8">
									<Button
										onClick={() => setOpenContactModal(true)}
										className="h-11 w-full rounded-full"
									>
										Contact Sales
									</Button>
								</div>
							</section>
						</Reveal>
					</div>
				</Container>
			</section>

			<PageFaq
				id="pricing-faqs"
				title="Pricing questions"
				description="The commercial model in plain terms."
				faqs={pricingFaqs}
			/>

			<CallToAction />

			<ContactFormModal
				open={openContactModal}
				onOpenChange={setOpenContactModal}
				defaultInquiryType="sales"
			/>
		</div>
	);
}
