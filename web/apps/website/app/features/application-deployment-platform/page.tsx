import { ChoicePanels, ProductFrame } from "@/components/pages/PagePrimitives";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import { CallToAction } from "@/components/CallToAction";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	Code2,
	Layers,
	Wrench,
	GitBranch,
	Webhook,
	Eye,
	FolderInput,
	Server,
	Cloud,
	LayoutTemplate,
	Workflow,
	FileCode,
	RotateCcw,
	LayoutDashboard,
	CloudCog,
	Clock,
	Users,
	Bot,
	Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Application & Software Deployment Platform",
	description:
		"Notploy's flexible, powerful application and software deployment platform enables you to put code written in Node.js, PHP, Python, Go, and Ruby live.",
};

const professionalFeatures = [
	{
		icon: Code2,
		title: "Support for multiple languages",
		description:
			"Deploy apps written in Node, PHP, Python, Go, Ruby, and more. Notploy does not restrict programming languages.",
	},
	{
		icon: Layers,
		title: "Deploy any app with any stack",
		description:
			"Notploy supports single services and multi-service apps. Deploy from Git, a container registry, or Docker Compose.",
	},
	{
		icon: Wrench,
		title: "Your build, your way",
		description:
			"Choose Nixpacks, Buildpacks, or a Dockerfile. Switch strategies per project without reworking your pipeline.",
	},
];

const automationFeatures = [
	{
		icon: Webhook,
		title: "Use webhooks to auto-deploy",
		description:
			"Trigger deployments automatically by git push if you're a GitHub user.",
	},
	{
		icon: Eye,
		title: "Test changes before they go live",
		description:
			"Preview and test applications in isolated environments before production.",
	},
	{
		icon: FolderInput,
		title: "Set up automated watch paths",
		description:
			"Monitor directories or files for changes and trigger actions when they're modified.",
	},
];

const deploymentOptions = [
	{
		icon: Server,
		title: "On-Premise Deployment",
		items: [
			"Complete data sovereignty",
			"Maximum security control",
			"Compliance with strict regulations",
			"No external dependencies",
		],
	},
	{
		icon: Cloud,
		title: "Cloud Deployment",
		items: [
			"Rapid scaling capabilities",
			"Reduced infrastructure overhead",
			"Global availability",
			"Managed infrastructure",
		],
	},
];

const platformFeatures = [
	{
		icon: Workflow,
		title: "Automate deployments with CI/CD",
		description:
			"Build and publish your applications in any continuous integration, continuous delivery pipeline.",
	},
	{
		icon: FileCode,
		title: "Configuration-first setup",
		description:
			"Use configuration files to maintain consistency in setup, configuration, and build across teams.",
	},
	{
		icon: RotateCcw,
		title: "Rollback capabilities built in",
		description:
			"Rollback capabilities help teams recover quickly when new features impact production.",
	},
	{
		icon: LayoutDashboard,
		title: "Single dashboard with analytics",
		description:
			"Manage deployment tools, environments, infrastructure, and analytics from a single dashboard as you scale.",
	},
	{
		icon: CloudCog,
		title: "Simplify infrastructure management",
		description:
			"Utilize infrastructure as code across cloud providers and AWS services.",
	},
	{
		icon: Clock,
		title: "Automation beyond deployments",
		description:
			"Run cron jobs to automate recurring tasks for apps, services, and data workflows.",
	},
];

const aiDeploymentFeatures = [
	{
		icon: Users,
		title: "Anyone can deploy",
		description:
			"Once Notploy is set up, non-technical users can take code from an AI tool to a running app without engineering support.",
	},
	{
		icon: Layers,
		title: "Isolated team environments",
		description:
			"Multitenancy keeps every team's projects and data separate. AI experimentation stays contained.",
	},
	{
		icon: Bot,
		title: "AI agents via MCP",
		description:
			"Notploy's MCP server lets AI agents trigger deployments, query app state, and manage services without a custom integration.",
	},
	{
		icon: Shield,
		title: "Governed by default",
		description:
			"SSO, audit logs, IP allowlisting, and rollback in seconds. Speed from AI tools doesn't have to come at the cost of control.",
	},
];

const faqs = [
	{
		question: "Can I deploy Docker Compose apps with Notploy?",
		answer:
			"Yes. Notploy supports deploying applications with Docker Compose, which is ideal when your implementation spans multiple services, data stores, and supporting tools. You can deploy a Compose stack as part of your deployment workflows, keep configuration in configuration files, and manage environments without increasing complexity as you scale.",
	},
	{
		question: "Which Git providers can I deploy from?",
		answer:
			"Notploy integrates seamlessly with popular version control systems and workflows, including GitHub and other git providers such as GitLab, Gitea, Bitbucket, and other Atlassian tools. You can connect repos from these version control systems, automate deployments on code changes, and align deployment workflows with CI/CD practices. If your team already uses GitHub Actions or Atlassian tools, Notploy fits into that process without forcing a new way of working.",
	},
	{
		question: "Can I deploy from a Docker registry?",
		answer:
			"Yes. You can deploy a Docker image directly from a registry, which is useful when you already build artifacts elsewhere or want tighter control over technologies and build tooling. This approach supports consistent deployments across environments and production, especially when combined with automation and rollback capabilities for safer releases.",
	},
	{
		question: "How do preview deployments work in Notploy?",
		answer:
			"Preview deployments create environments for testing code changes before they reach production environments. When a pull request or branch updates, Notploy can trigger automated deployments and deployment workflows so developers can validate functionality, reliability, and security in an isolated environment. This setup supports multiple environments, speeds up testing for new features, and helps teams reduce errors before customers and users see changes in production.",
	},
	{
		question: "What is a deployment platform?",
		answer:
			"A deployment platform helps developers and teams deploy apps and services through a repeatable deployment process. It brings software deployment tools and deployment workflows into one place so you can manage setup, configuration, build, deployment, and infrastructure management from a single dashboard. The goal is speed and reliability: automate routine steps, reduce errors from manual work, and keep production environments secure as applications evolve and ship new features.",
	},
	{
		question:
			"What's the difference between a deployment platform and a software deployment platform?",
		answer:
			"In practice, they overlap. A deployment platform often focuses on the mechanics of deployment tools and infrastructure, while a software deployment platform emphasizes end-to-end software delivery, including CI/CD, continuous integration, and continuous delivery. A software deployment platform typically ties deployment workflows to version control systems, configuration files, and multiple environments, so teams can maintain consistency from development to production, with rollback capabilities when code changes introduce issues.",
	},
	{
		question: "Can I use Notploy to deploy AI-generated apps?",
		answer:
			"Yes. Notploy works with code from any source, including apps built or scaffolded by AI coding tools. You deploy using the same Git, Docker, and Compose workflows as any other application—there's no separate process for AI-generated code.",
	},
];

export default function ApplicationDeploymentPlatformPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Deploy anything"
			title="The ultimate"
			highlight="deployment platform"
			description="Deploy any type of application with a straightforward workflow. Benefit from multiple build strategies, Docker Compose support, and native Git integration — without giving up control of the infrastructure."
			actions={
				<>
					<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
						<Link href="https://app.notploy.com/register" target="_blank">
							Get Started
						</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full rounded-full px-6 sm:w-auto"
						asChild
					>
						<Link href="/contact">Contact Us</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/platform", label: "Platform overview" },
				{ href: "/templates", label: "Templates" },
				{ href: "/pricing", label: "Pricing" },
			]}
			sections={[
				{
					id: "professional-features",
					title: "Professional features for every developer",
					description:
						"Take advantage of flexible features that empower everyone, no matter your build strategy or the size of your team.",
					items: professionalFeatures,
					columns: 3,
				},
				{
					id: "ai-built-apps",
					title: "Deploy the apps your teams are already building with AI",
					description:
						"AI coding tools are changing how applications get written. Notploy handles the deployment side, from AI-generated code to a live URL, powered by your existing workflows.",
					items: aiDeploymentFeatures,
					columns: 4,
					callout: {
						title: "Need a governed environment for AI tools?",
						description:
							"See how Notploy handles sandboxed deploys, non-technical users, and enterprise security for AI-built apps.",
						cta: "Deploy AI tools with Notploy",
						href: "/deploy-ai",
					},
				},
				{
					id: "automate-deployments",
					title: "Automate deployments and test changes",
					description:
						"Keep application deployments hands-off, while still staying in control of what ships and when.",
					items: automationFeatures,
					columns: 3,
					layout: "split",
				},
				{
					id: "everything-you-need",
					title: "Everything you need in a deployment platform",
					description:
						"Notploy is the software deployment platform for shipping anything from a single service to a full multi-container stack.",
					items: platformFeatures,
					columns: 3,
				},
			]}
			faqs={{
				id: "application-deployment-faqs",
				title: "Application deployment FAQs",
				description:
					"The questions that come up before the first deployment.",
				items: faqs,
			}}
			finalCta={{
				title: "Ship your first application today",
				description:
					"Create an account and deploy from Git, a container registry or Docker Compose in minutes.",
				cta: "Get Started",
				href: "https://app.notploy.com/register",
				external: true,
			}}
		>
			<section className="py-20 sm:py-28">
				<Container>
					<div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
						<div className="rounded-2xl border border-border/50 bg-card p-8">
							<GitBranch className="h-7 w-7 text-primary" strokeWidth={1.5} aria-hidden="true" />
							<h2 className="mt-5 font-display text-2xl tracking-tight text-foreground">
								Ship from GitHub, Bitbucket, and more
							</h2>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground">
								Connect your repo and deploy on push with webhooks. We support
								GitHub, GitLab, Gitea, Bitbucket, Docker registry, and Git
								generic provider. Control exactly what changes trigger a
								release, including monorepos.
							</p>
							<Button className="mt-6 rounded-full" variant="outline" asChild>
								<Link href="/integrations">
									See integrations
								</Link>
							</Button>
						</div>
						<div className="rounded-2xl border border-border/50 bg-card p-8">
							<LayoutTemplate className="h-7 w-7 text-primary" strokeWidth={1.5} aria-hidden="true" />
							<h2 className="mt-5 font-display text-2xl tracking-tight text-foreground">
								Hundreds of templates to get started
							</h2>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground">
								Deploy popular open-source apps in one click with Notploy
								Templates, a ready-to-run library of pre-configured apps you
								can deploy fast, without rebuilding the same stack from
								scratch.
							</p>
							<Button className="mt-6 rounded-full" variant="outline" asChild>
								<Link href="/templates">Browse templates</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<Container className="pb-20 sm:pb-28">
				<ProductFrame
					src="/dashboard.png"
					alt="Notploy dashboard showing projects and deployed services"
					path="app.notploy.com/projects"
					caption="Projects, services and deployment history in one control plane."
				/>
			</Container>

			<ChoicePanels
				id="host-where-needed"
				title="Host Notploy where your business needs it"
				description="Choose a deployment option that suits your business — on your infrastructure or ours."
				panels={[
					{
						name: "Self-hosted",
						tagline: "Full control",
						description:
							"Run the full platform on infrastructure you own and keep data, secrets and backups inside your boundary.",
						bullets: [
							"Complete data sovereignty",
							"Maximum security control",
							"Compliance with strict regulations",
							"No external dependencies",
						],
						cta: "Explore Self",
						href: "/self",
					},
					{
						name: "Notploy Cloud",
						tagline: "Managed for you",
						description:
							"The control plane is hosted, upgraded and supported by Notploy while your apps run on your servers.",
						bullets: [
							"Rapid scaling capabilities",
							"Reduced infrastructure overhead",
							"Global availability",
							"Managed infrastructure",
						],
						cta: "Explore Cloud",
						href: "/cloud",
						highlighted: true,
					},
				]}
			/>
		</FeaturePageTemplate>
	);
}
