import { Button } from "@/components/ui/button";
import {
	Bot,
	Boxes,
	Activity,
	Users,
	MousePointerClick,
	Network,
	KeyRound,
	ShieldCheck,
	FlaskConical,
	Rocket,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/Container";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Reveal } from "@/components/home/Reveal";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Deploy AI Apps Securely with Notploy",
	description:
		"Empower your team to deploy AI-built apps in a secure, isolated sandbox, with SSO, multitenancy, audit logs, and one-click deploys.",
	alternates: {
		canonical: "https://notploy.com/deploy-ai",
	},
};

const coreFeatures = [
	{
		icon: Bot,
		title: "Connect AI agents directly to Notploy",
		description:
			"Notploy's MCP server enables AI agents to interact with your deployment environment through the Model Context Protocol. An AI tool can trigger deployments, query application state, and manage services—without needing a custom integration.",
	},
	{
		icon: Boxes,
		title: "Deploy any app, from any source",
		description:
			"Whether it's a Git repo, a Docker image, or a Docker Compose file, Notploy handles it. Non-technical users can go from AI-generated code to a running application without a DevOps team in the loop.",
	},
	{
		icon: Activity,
		title: "Catch issues before they become problems",
		description:
			"Real-time monitoring, centralized logs, and instant rollback mean that when an AI-built app misbehaves, your team can see why and recover fast—before it touches anything else.",
	},
];

const guardrailFeatures = [
	{
		icon: Users,
		title: "Separate every team's environment",
		description:
			"Notploy's multitenancy keeps projects and data isolated at the team level. One team can't see, access, or interfere with another's applications, so AI experimentation stays contained without needing a separate instance per team.",
	},
	{
		icon: MousePointerClick,
		title: "Let anyone deploy without the risk",
		description:
			"Non-technical users get a clean, simple interface for deploying and managing their apps. There's no CLI to learn and no config file to edit, just a straightforward path from code to running apps that doesn't require an engineer on standby.",
	},
	{
		icon: Network,
		title: "Lock down who can reach your environment",
		description:
			"Configure IP allowlisting to keep your internal deployment environment off the public internet. Wildcard subdomain support means every app gets its own clean internal URL, with access controlled at the network level.",
	},
	{
		icon: KeyRound,
		title: "Sign in with the identity provider you already use",
		description:
			"Notploy supports SSO via Okta, Azure AD, Auth0, and more, with SCIM provisioning and deprovisioning. When someone joins a team, they get access. When they leave, it's revoked automatically—no manual cleanup, no lingering credentials.",
		link: {
			href: "/features/single-sign-on",
			label: "Learn more about SSO",
		},
	},
];

const testFreelyPoints = [
	"Deploy AI-built apps without touching production infrastructure",
	"Keep all environments fully isolated from live data and services",
	"Audit logs record every action across your Notploy environment",
	"Roll back any deployment in seconds if something goes wrong",
	"Run experiments that never reach customers until you're ready",
];

const empowerTeamPoints = [
	"Sales, design, ops—anyone can deploy an app without IT involvement",
	"No infrastructure knowledge required to get from code to URL",
	"Subdomain support gives every app a clean, shareable internal link",
	"Security and compliance requirements are handled at the platform level",
	"Promising projects can graduate to production on your own timeline",
];

export default function DeployAIPage() {
	return (
		<FeaturePageTemplate
			badge="AI deployment"
			badgeDetail="Sandboxes & guardrails"
			title="Deploy AI apps"
			highlight="without the risk"
			description="Your teams are building with AI. Notploy gives them a safe, governed environment to ship those tools without touching production infrastructure or waiting on an engineer."
			actions={
				<>
					<Button className="rounded-full" asChild>
						<Link
							href="https://app.notploy.com/register"
							target="_blank"
							rel="noreferrer"
						>
							Get started
						</Link>
					</Button>
					<Button variant="outline" className="rounded-full" asChild>
						<Link href="/contact">Talk to an expert</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/platform", label: "Platform overview" },
				{ href: "/enterprise", label: "Enterprise" },
				{ href: "/features/single-sign-on", label: "SSO & SCIM" },
			]}
			sections={[
				{
					id: "ai-deployment-essentials",
					title: "Everything you need to deploy AI today",
					description:
						"Notploy is built to take an app from an AI coding tool to a live, internal URL in minutes.",
					items: coreFeatures,
					columns: 3,
				},
				{
					id: "guardrails-not-gatekeepers",
					title: "Guardrails, not gatekeepers",
					description:
						"AI-generated code moves fast. Notploy's enterprise features make sure that speed doesn't come at the cost of security or control.",
					items: guardrailFeatures,
					columns: 2,
					callout: {
						title: "Bring AI deployment to the whole company",
						description:
							"SSO, audit logs, fine-grained RBAC and priority support, deployed on your infrastructure.",
						cta: "Discover Notploy Enterprise",
						href: "/enterprise",
					},
				},
			]}
			finalCta={{
				title: "Unlock your deployment potential",
				description:
					"Say goodbye to infrastructure hassles. Notploy Cloud handles deployments, containers and traffic so your team can focus on building.",
				cta: "Create an account",
				href: "https://app.notploy.com/register",
				external: true,
			}}
		>
			<section aria-labelledby="internal-sandbox" className="py-20 sm:py-28">
				<Container>
					<Reveal className="mx-auto max-w-2xl text-center">
						<h2
							id="internal-sandbox"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							Test freely. Ship confidently.
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
							A dedicated internal sandbox means your teams can move fast
							without creating risk for the rest of the business.
						</p>
					</Reveal>
					<div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
						{[
							{
								title: "Test without the risk",
								icon: FlaskConical,
								points: testFreelyPoints,
							},
							{
								title: "Empower your team",
								icon: Rocket,
								points: empowerTeamPoints,
							},
						].map((card) => (
							<Reveal key={card.title}>
								<div className="h-full rounded-2xl border border-border/50 bg-card p-8">
									<card.icon
										className="h-7 w-7 text-primary [stroke-width:1.5]"
										aria-hidden="true"
									/>
									<h3 className="mt-5 text-lg font-semibold text-foreground">
										{card.title}
									</h3>
									<ul className="mt-5 space-y-3">
										{card.points.map((point) => (
											<li key={point} className="flex gap-3 text-base">
												<CheckCircle2
													className="mt-1 h-4 w-4 shrink-0 text-primary"
													aria-hidden="true"
												/>
												<span className="text-muted-foreground">{point}</span>
											</li>
										))}
									</ul>
								</div>
							</Reveal>
						))}
					</div>
				</Container>
			</section>

			<section aria-labelledby="openclaw" className="pb-20 sm:pb-28">
				<Container>
					<Reveal className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 sm:p-12">
						<div className="max-w-2xl">
							<Sparkles
								className="h-7 w-7 text-primary [stroke-width:1.5]"
								aria-hidden="true"
							/>
							<h2
								id="openclaw"
								className="mt-5 font-display text-3xl tracking-tight text-foreground"
							>
								Openclaw in one click
							</h2>
							<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
								Openclaw is an open-source AI coding assistant you can
								self-host on Notploy with a single template deploy. Your team
								gets a private, internal AI environment, and no data leaves
								your infrastructure.
							</p>
							<div className="mt-7">
								<Button variant="outline" className="rounded-full" asChild>
									<Link
										href="https://docs.notploy.com/docs/templates/openclaw"
										target="_blank"
										rel="noreferrer"
									>
										Read the Openclaw docs
									</Link>
								</Button>
							</div>
						</div>
					</Reveal>
				</Container>
			</section>
		</FeaturePageTemplate>
	);
}
