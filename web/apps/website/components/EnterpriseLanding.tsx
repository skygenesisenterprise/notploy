"use client";

import {
	Box,
	Check,
	Cloud,
	GitBranch,
	Headphones,
	KeyRound,
	Lock,
	Paintbrush,
	RotateCcw,
	ScrollText,
	Server,
	Shield,
	UserCog,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ContactFormModal } from "./ContactFormModal";
import { Reveal } from "./home/Reveal";
import { PageHero } from "./pages/PageHero";
import { CellGrid, SectionHeading } from "./pages/PagePrimitives";
import { Container } from "./Container";
import { Button } from "./ui/button";

const features = [
	{
		icon: Lock,
		title: "SSO / SAML",
		description:
			"Seamless authentication with enterprise identity providers for secure, centralized access control.",
	},
	{
		icon: UserCog,
		title: "SCIM Provisioning",
		description:
			"Automatically provision, update, and deactivate users from Okta, Entra ID, or any SCIM 2.0 identity provider.",
	},
	{
		icon: Shield,
		title: "Audit Logs",
		description:
			"Comprehensive tracking of all system activities for compliance, security, and accountability.",
	},
	{
		icon: Users,
		title: "Fine-Grained RBAC",
		description:
			"Granular role-based access controls to ensure the right people have the right permissions.",
	},
	{
		icon: Headphones,
		title: "Custom Support & SLAs",
		description:
			"Dedicated support team with guaranteed response times and service level agreements.",
	},
	{
		icon: Server,
		title: "Flexible Hosting",
		description:
			"Deploy on-premises for maximum security or in the cloud for scalability—your infrastructure, your choice.",
	},
	{
		icon: GitBranch,
		title: "Granular User Controls",
		description:
			"Assign remote servers and specific git providers to individual team members.",
	},
	{
		icon: Paintbrush,
		title: "White Labeling",
		description:
			"Present Notploy as your own platform with custom branding, logo, and colors for your organization or clients.",
	},
];

const hostingOptions = [
	{
		icon: Server,
		title: "On-Premises Deployment",
		benefits: [
			"Complete data sovereignty",
			"Maximum security control",
			"Compliance with strict regulations",
			"No external dependencies",
		],
	},
	{
		icon: Cloud,
		title: "Cloud Deployment",
		benefits: [
			"Rapid scaling capabilities",
			"Reduced infrastructure overhead",
			"Global availability",
			"Managed infrastructure",
		],
	},
];

const aiGovernance = [
	{
		icon: ScrollText,
		title: "Audited deployments",
		description:
			"Every deployment triggered by an AI agent or team member is logged: who did what, when, and what changed.",
	},
	{
		icon: Box,
		title: "Sandbox environments",
		description:
			"AI-built apps run in isolated containers, separated from production infrastructure. Multitenancy keeps every workspace apart.",
	},
	{
		icon: KeyRound,
		title: "Controlled access",
		description:
			"Use fine-grained RBAC and SSO to decide who can deploy, see, and approve AI-built apps at every level.",
	},
	{
		icon: RotateCcw,
		title: "Instant rollback",
		description:
			"When an AI-built app behaves unexpectedly, roll back in seconds, with no manual intervention.",
	},
];

const screenshots = [
	{
		src: "/enterprise/custom-roles.png",
		alt: "Create custom roles with fine-grained permissions",
		title: "Custom roles",
		description:
			"Define roles with preset templates or build from scratch with granular permission toggles per resource.",
	},
	{
		src: "/enterprise/git-permission.png",
		alt: "Assign git providers to individual team members",
		title: "Git provider access",
		description:
			"Control which Git providers each team member can access across GitHub, GitLab, Bitbucket and Gitea.",
	},
	{
		src: "/enterprise/servers-permission.png",
		alt: "Assign remote servers to individual team members",
		title: "Server assignment",
		description:
			"Assign specific remote servers to individual team members so they only see what they need.",
	},
];

export function EnterpriseLanding() {
	const [contactOpen, setContactOpen] = useState(false);

	return (
		<div className="min-h-screen bg-background">
			<ContactFormModal open={contactOpen} onOpenChange={setContactOpen} />
			<PageHero
				badge="Enterprise"
				badgeDetail="Security, compliance, control"
				title="Enterprise-grade deployment,"
				highlight="your way"
				description="Scale with confidence. Deploy on-premises or in the cloud with enterprise security, compliance and support built for organisations that demand the best."
				actions={
					<>
						<Button
							className="rounded-full"
							onClick={() => setContactOpen(true)}
						>
							Contact sales
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								href="https://docs.notploy.com"
								target="_blank"
								rel="noreferrer"
							>
								View documentation
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/features/single-sign-on", label: "SSO & SCIM" },
					{ href: "/features/audit-logs", label: "Audit logs" },
					{ href: "/features/role-based-access-control", label: "RBAC" },
				]}
			/>

			<CellGrid
				id="enterprise-features"
				title="Built for enterprise teams"
				description="Everything you need to deploy, manage and scale mission-critical applications with confidence and security."
				items={features}
				columns={4}
			/>

			<section aria-labelledby="enterprise-hosting" className="py-20 sm:py-28">
				<Container>
					<SectionHeading
						id="enterprise-hosting"
						title="Deploy anywhere, without compromise"
						description="Host Notploy exactly where your business needs it: on your infrastructure or ours."
					/>
					<div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
						{hostingOptions.map((option) => (
							<Reveal key={option.title}>
								<div className="h-full rounded-2xl border border-border/50 bg-card p-8">
									<option.icon
										className="h-7 w-7 text-primary [stroke-width:1.5]"
										aria-hidden="true"
									/>
									<h3 className="mt-5 text-xl font-semibold text-foreground">
										{option.title}
									</h3>
									<ul className="mt-5 space-y-3">
										{option.benefits.map((benefit) => (
											<li key={benefit} className="flex gap-3 text-base">
												<Check
													className="mt-1 h-4 w-4 shrink-0 text-primary"
													aria-hidden="true"
												/>
												<span className="text-muted-foreground">
													{benefit}
												</span>
											</li>
										))}
									</ul>
								</div>
							</Reveal>
						))}
					</div>

					<Reveal className="mx-auto mt-4 max-w-5xl rounded-2xl border border-border/50 bg-card p-8 text-center">
						<h3 className="font-display text-2xl tracking-tight text-foreground">
							Hybrid deployments
						</h3>
						<p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
							Deploy Notploy across multiple environments with centralised
							management and unified monitoring.
						</p>
					</Reveal>
				</Container>
			</section>

			<CellGrid
				id="enterprise-ai-governance"
				title="Governance for AI-built apps"
				description="AI tools have accelerated how teams ship software. Notploy gives enterprises a safe way to do it, with audit trails, access controls and isolated environments."
				items={aiGovernance}
				columns={4}
			/>

			<section aria-labelledby="enterprise-rbac" className="py-20 sm:py-28">
				<Container>
					<SectionHeading
						id="enterprise-rbac"
						title="Granular access control, visualised"
						description="Complete visibility and control over who can access what, down to the individual resource level."
					/>
					<div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-3">
						{screenshots.map((item) => (
							<Reveal key={item.title}>
								<div className="h-full overflow-hidden rounded-2xl border border-border/50 bg-card">
									<div className="overflow-hidden bg-secondary p-4">
										<img
											src={item.src}
											alt={item.alt}
											className="w-full rounded-lg object-contain"
										/>
									</div>
									<div className="p-6">
										<h3 className="text-lg font-semibold text-foreground">
											{item.title}
										</h3>
										<p className="mt-3 text-base leading-relaxed text-muted-foreground">
											{item.description}
										</p>
									</div>
								</div>
							</Reveal>
						))}
					</div>
				</Container>
			</section>

			<section aria-labelledby="enterprise-cta" className="pb-20 sm:pb-28">
				<Container>
					<Reveal className="mx-auto max-w-3xl rounded-2xl border border-border/50 bg-card p-8 text-center sm:p-12">
						<h2
							id="enterprise-cta"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							Ready to scale enterprise?
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
							Talk to our team about your deployment needs and discover how
							Notploy Enterprise can transform your infrastructure.
						</p>
						<Button
							className="mt-8 rounded-full"
							onClick={() => setContactOpen(true)}
						>
							Schedule a call with sales
						</Button>
						<p className="mt-6 text-sm text-muted-foreground">
							Questions? Email us at{" "}
							<a
								href="mailto:sales@notploy.com"
								className="text-primary hover:underline"
							>
								sales@notploy.com
							</a>
						</p>
					</Reveal>
				</Container>
			</section>
		</div>
	);
}
