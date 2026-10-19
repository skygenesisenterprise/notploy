import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import {
	AlertTriangle,
	Bot,
	Boxes,
	CheckCircle2,
	Clock,
	Code2,
	Eye,
	FileCog,
	FlaskConical,
	GitBranch,
	Hammer,
	History,
	Layers,
	LayoutDashboard,
	LayoutTemplate,
	Unlock,
	Webhook,
	Workflow,
	XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { SectionHeading } from "@/components/pages/PagePrimitives";
import { Reveal } from "@/components/home/Reveal";

export const metadata: Metadata = {
	title: "Application & Software Deployment Platform",
	description:
		"Notploy's flexible, powerful application and software deployment platform enables self-hosting and secure AI app deployment, with Docker Compose support.",
	alternates: {
		canonical: "https://notploy.com/lp/deployment-platform",
	},
	robots: {
		index: false,
		follow: false,
	},
};

const professionalFeatures = [
	{
		icon: Code2,
		title: "Support for multiple languages",
		description:
			"Deploy apps written in Node, PHP, Python, Go, Ruby, and more. Notploy does not restrict programming languages.",
	},
	{
		icon: Boxes,
		title: "Deploy any app with any stack",
		description:
			"Notploy supports single services and multi-service apps. Deploy from Git, a container registry, or Docker Compose.",
	},
	{
		icon: Unlock,
		title: "Eliminate vendor lock-in",
		description:
			"Your apps, your servers, your data. A self-hosted PaaS gives you full control over where workloads run.",
	},
	{
		icon: Hammer,
		title: "Your build, your way",
		description:
			"Choose Nixpacks, Buildpacks, or a Dockerfile. Switch strategies per project without reworking your pipeline.",
	},
	{
		icon: GitBranch,
		title: "Ship from GitHub, Bitbucket, and more",
		description:
			"Connect your repo and deploy on push with webhooks. Control exactly what changes trigger a release, including monorepos.",
	},
	{
		icon: Bot,
		title: "Run your AI tools in-house",
		description:
			"Your tools run on your own server, so code, prompts, and outputs never leave your infrastructure. Create sandboxes where your team can deploy safely.",
	},
];

const comparisonRows = [
	{
		point: "Docker Compose",
		values: [
			{ status: "yes", text: "Native Compose support" },
			{ status: "yes", text: "Native Compose support" },
			{ status: "warn", text: "Dockerfile-first deploys" },
			{ status: "no", text: "No Docker deploys" },
			{ status: "warn", text: "Local Compose only" },
		],
	},
	{
		point: "Self-hosted option",
		values: [
			{ status: "yes", text: "Self-hosted VPS option" },
			{ status: "yes", text: "Self-hosted server option" },
			{ status: "yes", text: "Self-hosted PaaS option" },
			{ status: "no", text: "Managed cloud only" },
			{ status: "no", text: "Managed dyno platform" },
		],
	},
	{
		point: "Persistent storage",
		values: [
			{ status: "yes", text: "Built-in volume backups" },
			{ status: "warn", text: "Manual volume migration" },
			{ status: "warn", text: "Storage plugin needed" },
			{ status: "warn", text: "External Blob storage" },
			{ status: "no", text: "Ephemeral dyno filesystem" },
		],
	},
	{
		point: "Multi-server control",
		values: [
			{ status: "yes", text: "Remote server deploys" },
			{ status: "warn", text: "High availability needs setup" },
			{ status: "no", text: "Single-server design" },
			{ status: "warn", text: "Frontend global platform" },
			{ status: "warn", text: "Dyno scaling only" },
		],
	},
];

const competitors = ["Notploy", "Coolify", "Dokku", "Vercel", "Heroku"];

const statusIcon = {
	yes: <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />,
	warn: <AlertTriangle className="h-4 w-4 flex-shrink-0 text-primary/800" />,
	no: <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />,
} as const;

const automationFeatures = [
	{
		icon: Webhook,
		title: "Use webhooks to auto-deploy",
		description:
			"Trigger deployments automatically by git push if you're a GitHub user.",
	},
	{
		icon: FlaskConical,
		title: "Test changes before they go live",
		description:
			"Preview and test applications in isolated environments before production.",
	},
	{
		icon: Eye,
		title: "Set up automated watch paths",
		description:
			"Monitor directories or files for changes and trigger actions when they're modified.",
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
		icon: FileCog,
		title: "Configuration-first setup",
		description:
			"Use configuration files to maintain consistency in setup, configuration, and build across teams.",
	},
	{
		icon: History,
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
		icon: Layers,
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

const faqs = [
	{
		question: "Can I deploy Docker Compose apps with Notploy?",
		answer: (
			<>
				<p>
					Yes. Notploy supports deploying applications with Docker Compose,
					which is ideal when your implementation spans multiple services, data
					stores, and supporting tools.
				</p>
				<p className="mt-3">
					You can deploy a Compose stack as part of your deployment workflows,
					keep configuration in configuration files, and manage environments
					without increasing complexity as you scale.
				</p>
			</>
		),
	},
	{
		question: "Which Git providers can I deploy from?",
		answer: (
			<>
				<p>
					Notploy integrates seamlessly with popular version control systems and
					workflows, including GitHub and other git providers such as GitLab,
					Gitea, Bitbucket, and other Atlassian tools.
				</p>
				<p className="mt-3">
					You can connect repos from these version control systems, automate
					deployments on code changes, and align deployment workflows with CI/CD
					practices.
				</p>
				<p className="mt-3">
					If your team already uses GitHub Actions or Atlassian tools, Notploy
					fits into that process without forcing a new way of working.
				</p>
			</>
		),
	},
	{
		question: "Can I deploy from a Docker registry?",
		answer: (
			<>
				<p>
					Yes. You can deploy a Docker image directly from a registry, which is
					useful when you already build artifacts elsewhere or want tighter
					control over technologies and build tooling.
				</p>
				<p className="mt-3">
					This approach supports consistent deployments across environments and
					production, especially when combined with automation and rollback
					capabilities for safer releases.
				</p>
			</>
		),
	},
	{
		question: "How do preview deployments work in Notploy?",
		answer: (
			<>
				<p>
					Preview deployments create environments for testing code changes
					before they reach production environments. When a pull request or
					branch updates, Notploy can trigger automated deployments and
					deployment workflows so developers can validate functionality,
					reliability, and security in an isolated environment.
				</p>
				<p className="mt-3">
					This setup supports multiple environments, speeds up testing for new
					features, and helps teams reduce errors before customers and users see
					changes in production.
				</p>
			</>
		),
	},
	{
		question: "What is a deployment platform?",
		answer: (
			<>
				<p>
					A deployment platform helps developers and teams deploy apps and
					services through a repeatable deployment process.
				</p>
				<p className="mt-3">
					It brings software deployment tools and deployment workflows into one
					place so you can manage setup, configuration, build, deployment, and
					infrastructure management from a single dashboard.
				</p>
				<p className="mt-3">
					The goal is speed and reliability: automate routine steps, reduce
					errors from manual work, and keep production environments secure as
					applications evolve and ship new features.
				</p>
			</>
		),
	},
	{
		question:
			"What's the difference between a deployment platform and a software deployment platform?",
		answer: (
			<>
				<p>In practice, they overlap.</p>
				<p className="mt-3">
					A deployment platform often focuses on the mechanics of deployment
					tools and infrastructure, while a software deployment platform
					emphasizes end-to-end software delivery, including CI/CD, continuous
					integration, and continuous delivery.
				</p>
				<p className="mt-3">
					A software deployment platform typically ties deployment workflows to
					version control systems, configuration files, and multiple
					environments, so teams can maintain consistency from development to
					production, with rollback capabilities when issues arise.
				</p>
			</>
		),
	},
];

export default function DeploymentPlatformLandingPage() {
	return (
		<FeaturePageTemplate
			badge="Deployment platform"
			badgeDetail="Any app, any stack"
			title="The ultimate application"
			highlight="deployment platform"
			description="Deploy any type of application, including AI, with multiple build types, Docker Compose support and native Git integration."
			actions={
				<>
					<Button className="rounded-full" asChild>
						<Link href="/contact">Contact sales</Link>
					</Button>
					<Button variant="outline" className="rounded-full" asChild>
						<Link
							href="https://app.notploy.com/register"
							target="_blank"
							rel="noreferrer"
						>
							Get started
						</Link>
					</Button>
				</>
			}
			sections={[
				{
					id: "professional-features",
					title: "Professional features for every developer",
					description:
						"Flexible features that empower everyone, no matter your build strategy or the size of your team.",
					items: professionalFeatures,
					columns: 3,
				},
				{
					id: "automation",
					title: "Automate deployments and test changes",
					description:
						"Keep deployments hands-off, while staying in control of what ships and when.",
					items: automationFeatures,
					columns: 3,
				},
				{
					id: "platform",
					title: "Everything you need in a deployment platform",
					description:
						"Ship anything from a single service to a full multi-container stack.",
					items: platformFeatures,
					columns: 3,
				},
			]}
			faqs={{
				id: "deployment-faqs",
				title: "Application deployment FAQs",
				items: faqs,
			}}
			finalCta={{
				title: "Deploy on infrastructure you control",
				description:
					"Start with Notploy Self on your own servers, or let Notploy Cloud manage the control plane.",
				cta: "Create your account",
				href: "https://app.notploy.com/register",
				external: true,
			}}
		>
			<section aria-labelledby="comparison" className="py-20 sm:py-28">
				<Container>
					<SectionHeading
						id="comparison"
						title="Notploy vs. the competition"
						description="Learn why development teams are choosing Notploy."
					/>
					<Reveal className="mx-auto mt-12 max-w-6xl overflow-x-auto rounded-2xl border border-border/50 bg-card">
						<table className="w-full min-w-[820px] border-collapse text-left text-sm">
							<thead>
								<tr className="border-b border-border/50">
									<th className="p-4 font-semibold text-muted-foreground">
										Comparison point
									</th>
									{competitors.map((name) => (
										<th
											key={name}
											className={
												name === "Notploy"
													? "p-4 font-semibold text-primary"
													: "p-4 font-semibold text-foreground"
											}
										>
											{name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{comparisonRows.map((row) => (
									<tr
										key={row.point}
										className="border-b border-border/30 align-top last:border-b-0"
									>
										<th className="p-4 text-left font-medium text-foreground">
											{row.point}
										</th>
										{row.values.map((value, i) => (
											<td
												key={`${row.point}-${competitors[i + 1] ?? competitors[i]}`}
												className={
													i === 0
														? "bg-primary/5 p-4 text-muted-foreground"
														: "p-4 text-muted-foreground"
												}
											>
												<div className="flex items-start gap-2">
													{statusIcon[value.status as keyof typeof statusIcon]}
													<span>{value.text}</span>
												</div>
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</Reveal>
				</Container>
			</section>

			<section aria-labelledby="templates" className="pb-20 sm:pb-28">
				<Container>
					<Reveal className="grid gap-8 rounded-2xl border border-border/50 bg-card p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
						<div className="max-w-2xl">
							<LayoutTemplate
								className="h-7 w-7 text-primary [stroke-width:1.5]"
								aria-hidden="true"
							/>
							<h2
								id="templates"
								className="mt-5 font-display text-3xl tracking-tight text-foreground"
							>
								Hundreds of templates to get started
							</h2>
							<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
								Deploy popular open-source apps in one click with Notploy
								Templates, a ready-to-run library of pre-configured apps.
							</p>
						</div>
						<Button className="rounded-full" asChild>
							<Link
								href="https://templates.notploy.com"
								target="_blank"
								rel="noreferrer"
							>
								Browse templates
							</Link>
						</Button>
					</Reveal>
				</Container>
			</section>
		</FeaturePageTemplate>
	);
}
