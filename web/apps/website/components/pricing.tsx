"use client";

import { cn } from "@/lib/utils";
import clsx from "clsx";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ContactFormModal } from "./ContactFormModal";
import { Container } from "./Container";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import AnimatedGridPattern from "./ui/animated-grid-pattern";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";

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

function SwirlyDoodle(props: React.ComponentPropsWithoutRef<"svg">) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 281 40"
			preserveAspectRatio="none"
			{...props}
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M240.172 22.994c-8.007 1.246-15.477 2.23-31.26 4.114-18.506 2.21-26.323 2.977-34.487 3.386-2.971.149-3.727.324-6.566 1.523-15.124 6.388-43.775 9.404-69.425 7.31-26.207-2.14-50.986-7.103-78-15.624C10.912 20.7.988 16.143.734 14.657c-.066-.381.043-.344 1.324.456 10.423 6.506 49.649 16.322 77.8 19.468 23.708 2.65 38.249 2.95 55.821 1.156 9.407-.962 24.451-3.773 25.101-4.692.074-.104.053-.155-.058-.135-1.062.195-13.863-.271-18.848-.687-16.681-1.389-28.722-4.345-38.142-9.364-15.294-8.15-7.298-19.232 14.802-20.514 16.095-.934 32.793 1.517 47.423 6.96 13.524 5.033 17.942 12.326 11.463 18.922l-.859.874.697-.006c2.681-.026 15.304-1.302 29.208-2.953 25.845-3.07 35.659-4.519 54.027-7.978 9.863-1.858 11.021-2.048 13.055-2.145a61.901 61.901 0 0 0 4.506-.417c1.891-.259 2.151-.267 1.543-.047-.402.145-2.33.913-4.285 1.707-4.635 1.882-5.202 2.07-8.736 2.903-3.414.805-19.773 3.797-26.404 4.829Zm40.321-9.93c.1-.066.231-.085.29-.041.059.043-.024.096-.183.119-.177.024-.219-.007-.107-.079ZM172.299 26.22c9.364-6.058 5.161-12.039-12.304-17.51-11.656-3.653-23.145-5.47-35.243-5.576-22.552-.198-33.577 7.462-21.321 14.814 12.012 7.205 32.994 10.557 61.531 9.831 4.563-.116 5.372-.288 7.337-1.559Z"
			/>
		</svg>
	);
}

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

export function Pricing() {
	const [openContactModal, setOpenContactModal] = useState(false);

	return (
		<section
			aria-labelledby="pricing-heading"
			className="relative border-t border-border/30 bg-background py-20 sm:py-32 overflow-hidden"
		>
			<Container className="relative">
				<div className="relative text-center overflow-hidden py-8 -my-8">
					<AnimatedGridPattern
						numSquares={20}
						maxOpacity={0.1}
						height={40}
						width={40}
						duration={3}
						repeatDelay={1}
						className={cn(
							"[mask-image:radial-gradient(600px_circle_at_50%_50%,white,transparent)]",
							"absolute inset-0",
						)}
					/>
					<Link
						href="https://github.com/skygenesisenterprise/notploy"
						target="_blank"
						aria-label="Notploy is open source and Apache-2.0 licensed"
						className="relative mb-4 inline-flex"
					>
						<Badge
							variant="secondary"
							className="gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-primary transition-colors hover:bg-primary/20"
						>
							<Sparkles className="h-3.5 w-3.5" />
							Open source · Apache-2.0
						</Badge>
					</Link>
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary relative">
						Pricing
					</p>
					<h2
						id="pricing-heading"
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						<span className="relative whitespace-nowrap">
							<SwirlyDoodle className="absolute left-0 top-1/2 h-[1em] w-full fill-muted-foreground" />
							<span className="relative">Open source</span>
						</span>{" "}
						at the core.
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Self-host the full platform for free, or let us run it for you.
					</p>
				</div>

				<div className="mx-auto mt-12 flex max-w-6xl flex-col gap-8">
					<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
						{/* Self */}
						<section
							className={clsx(
								"flex flex-col rounded-3xl border-2 border-dashed border-border/50 bg-background/50 px-6 py-8",
							)}
						>
							<h3 className="text-lg font-medium text-foreground">Self</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Open-source, self-hosted on your infrastructure
							</p>
							<div className="mt-4">
								<span className="text-2xl font-semibold text-primary">
									Free
								</span>
								<span className="ml-2 text-sm text-muted-foreground">
									forever, MIT/Apache-2.0 core
								</span>
							</div>
							<ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
								{selfFeatures.map((f) => (
									<li key={f} className="flex gap-2">
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										{f}
									</li>
								))}
							</ul>
							<div className="mt-auto pt-6">
								<Link
									href={DOCS_INSTALL_URL}
									target="_blank"
									className={buttonVariants({
										variant: "default",
										className: "w-full",
									})}
								>
									Install Notploy
								</Link>
							</div>
						</section>

						{/* Cloud */}
						<section
							className={clsx(
								"relative flex flex-col rounded-3xl border-2 border-primary/50 bg-card/80 px-6 py-8",
							)}
						>
							<Badge className="absolute -top-2.5 left-6">Managed</Badge>
							<h3 className="text-lg font-medium text-foreground">Cloud</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Managed Notploy operated by Notploy Enterprise
							</p>
							<div className="mt-4">
								<span className="text-2xl font-semibold text-primary">
									Managed service
								</span>
								<p className="mt-1 text-sm text-muted-foreground">
									We run the control plane, you bring the infrastructure
								</p>
							</div>
							<ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
								{cloudFeatures.map((f) => (
									<li key={f} className="flex gap-2">
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										{f}
									</li>
								))}
							</ul>
							<div className="mt-auto pt-6">
								<Link
									href={`${CLOUD_APP_URL}/register`}
									target="_blank"
									className={buttonVariants({
										variant: "default",
										className: "w-full",
									})}
								>
									Get Started
								</Link>
							</div>
						</section>

						{/* Enterprise */}
						<section
							className={clsx(
								"flex flex-col rounded-3xl border-2 border-dashed border-border/50 bg-background/50 px-6 py-8",
							)}
						>
							<h3 className="text-lg font-medium text-foreground">Enterprise</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Commercial edition and premium support
							</p>
							<div className="mt-4 grid grid-cols-2 gap-3">
								<div className="rounded-xl border border-border/50 bg-background/50 px-4 py-3">
									<p className="font-medium text-foreground text-center">Cloud</p>
									<p className="mt-0.5 text-xs text-muted-foreground text-center">
										We host and manage everything for you
									</p>
								</div>
								<div className="rounded-xl border border-border/50 bg-background/50 px-4 py-3">
									<p className="font-medium text-foreground text-center">
										Self Hosted
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground text-center">
										Install on-prem or in your own cloud
									</p>
								</div>
							</div>
							<ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
								{enterpriseFeatures.map((f) => (
									<li key={f} className="flex gap-2">
										<Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
										{f}
									</li>
								))}
							</ul>
							<div className="mt-auto pt-6">
								<Button
									onClick={() => setOpenContactModal(true)}
									className="w-full"
								>
									Contact Sales
								</Button>
							</div>
						</section>
					</div>
				</div>

				{/* Pricing FAQ */}
				<div className="mx-auto mt-24 max-w-3xl">
					<div className="text-center">
						<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
							FAQs
						</p>
						<h3 className="text-2xl font-semibold text-foreground">
							Frequently asked questions
						</h3>
						<p className="mt-4 text-sm text-muted-foreground">
							Have a different question? Contact us via Discord or email.
						</p>
					</div>
					<Accordion type="single" collapsible className="mt-8 w-full">
						{pricingFaqs.map((faq, index) => (
							<AccordionItem value={`${index}`} key={index}>
								<AccordionTrigger className="text-left">
									{faq.question}
								</AccordionTrigger>
								<AccordionContent>{faq.answer}</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</Container>

			<ContactFormModal
				open={openContactModal}
				onOpenChange={setOpenContactModal}
				defaultInquiryType="sales"
			/>
		</section>
	);
}
