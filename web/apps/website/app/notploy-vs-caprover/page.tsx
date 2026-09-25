import { Container } from "@/components/Container";
import { CallToAction } from "@/components/CallToAction";
import { Testimonials } from "@/components/Testimonials";
import { ComparisonStats } from "@/components/comparison-stats";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Check, X, Zap, Bell, Users, LayoutDashboard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Notploy vs. CapRover Comparison | Notploy",
	description:
		"Notploy vs. CapRover: Compare self-hosted PaaS platforms for app deployment, database management, monitoring, and team collaboration.",
};

type FeatureValue = boolean | "limited";

interface FeatureRow {
	feature: string;
	notploy: FeatureValue;
	caprover: FeatureValue;
	section?: string;
}

const featureComparisonRows: FeatureRow[] = [
	// Setup & Installation
	{ feature: "One-command installation", notploy: true, caprover: true, section: "Setup & Installation" },
	{ feature: "Installation feedback and progress logs", notploy: true, caprover: false },
	{ feature: "Works with firewall and Tailscale out of the box", notploy: true, caprover: false },
	{ feature: "Lightweight CPU usage while idle", notploy: true, caprover: false },
	{ feature: "Built with Next.js / TypeScript", notploy: true, caprover: false },
	// Deployment
	{ feature: "Deploy from GitHub, GitLab, Bitbucket", notploy: true, caprover: "limited", section: "Deployment" },
	{ feature: "Auto-deploy on git push", notploy: true, caprover: true },
	{ feature: "Docker Compose support", notploy: true, caprover: "limited" },
	{ feature: "Deploy from custom Docker images", notploy: true, caprover: true },
	{ feature: "Nixpacks and Buildpack support", notploy: true, caprover: false },
	{ feature: "Preview deployments (review apps)", notploy: true, caprover: false },
	{ feature: "One-click app templates", notploy: true, caprover: true },
	// Networking & Domains
	{ feature: "Built-in reverse proxy (Notploy: Traefik, CapRover: Nginx)", notploy: true, caprover: true, section: "Networking & Domains" },
	{ feature: "Automatic SSL via Let's Encrypt", notploy: true, caprover: true },
	{ feature: "Custom domain management", notploy: true, caprover: true },
	// Infrastructure
	{ feature: "Multi-server deployment", notploy: true, caprover: "limited", section: "Infrastructure" },
	{ feature: "Docker Swarm clustering", notploy: true, caprover: true },
	{ feature: "Scheduled database backups (S3)", notploy: true, caprover: false },
	{ feature: "Back up arbitrary Docker volumes", notploy: true, caprover: false },
	// Monitoring & Alerts
	{ feature: "Real-time monitoring (CPU, RAM, disk)", notploy: true, caprover: false, section: "Monitoring & Alerts" },
	{ feature: "Metrics enabled by default", notploy: true, caprover: false },
	{ feature: "Automated alerts from metrics", notploy: true, caprover: false },
	// Teams & Access
	{ feature: "Teams and multi-user support", notploy: true, caprover: false, section: "Teams & Access" },
	{ feature: "Role-based access control (RBAC)", notploy: true, caprover: false },
	{ feature: "Projects grouping", notploy: true, caprover: false },
	{ feature: "API and CLI access", notploy: true, caprover: true },
	{ feature: "AI-assisted deployments", notploy: true, caprover: false },
];

const whyChooseItems = [
	{
		icon: Zap,
		title: "Go beyond simple app hosting",
		description:
			"CapRover is great for getting a single app online fast, but Notploy handles the full deployment lifecycle. From git-connected builds with Nixpacks and Buildpacks to Docker Compose orchestration, preview deployments, and multi-server scaling—Notploy grows with your project instead of hitting a ceiling.",
		image: {
			src: "/images/notploy-build-logs.png",
			alt: "Notploy deployment panel showing build and deployment logs",
		},
	},
	{
		icon: Bell,
		title: "Monitor, alert, and back up without plugins",
		description:
			"CapRover doesn't include built-in monitoring or backup tools—you'd need to bolt on Prometheus, Grafana, or custom scripts. Notploy ships with real-time CPU, memory, and disk metrics, automated alerting, and scheduled S3-compatible backups for databases and volumes, all in one dashboard.",
		image: {
			src: "/images/notploy-monitoring-dashboard.png",
			alt: "Notploy monitoring dashboard showing CPU, memory and disk metrics",
		},
	},
	{
		icon: Users,
		title: "Collaborate with your team from day one",
		description:
			"CapRover is designed for single-user setups with no built-in team management, RBAC, or project organization. Notploy supports multiple users, role-based permissions, and project grouping out of the box—making it ready for teams and agencies, not just solo side projects.",
		image: {
			src: "/images/notploy-users.png",
			alt: "Notploy team members with role-based access permissions",
		},
	},
	{
		icon: LayoutDashboard,
		title: "Work in a modern, polished interface",
		description:
			"Notploy's UI is built with Next.js and TypeScript, offering a fast, consistent experience with predictable workflows. CapRover's captain dashboard is functional but dated, and many operations require CLI commands or manual configuration. Notploy keeps everything accessible in the browser.",
		image: {
			src: "/images/notploy-projects-dashboard.png",
			alt: "Notploy dashboard with projects and services grid",
		},
	},
];

const integrationRows = [
	{
		category: "Git providers",
		notploy: "GitHub, GitLab, Bitbucket, Gitea, Git Generic",
		caprover: "GitHub (via webhook), custom Git",
	},
	{
		category: "Build and deployment systems",
		notploy: "Docker, Docker Compose, Nixpacks, Heroku Buildpacks, Paketo Buildpacks, Railpack",
		caprover: "Docker, Captain Definition file",
	},
	{
		category: "Notifications and communication",
		notploy: "Slack, Telegram, Discord, Lark, Email (SMTP), Resend, Gotify, Ntfy, Pushover, Webhook",
		caprover: "None built-in",
	},
];

function FeatureCell({ value }: { value: FeatureValue }) {
	if (value === true) return <Check className="mx-auto h-5 w-5 text-green-500" />;
	if (value === "limited") return <span className="text-xs text-amber-500">Limited</span>;
	return <X className="mx-auto h-5 w-5 text-muted-foreground/50" />;
}

export default function NotployVsCapRoverPage() {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="relative overflow-hidden border-b border-border/30 bg-black py-20 sm:py-32">
				<AnimatedGridPattern
					numSquares={30}
					maxOpacity={0.1}
					height={40}
					width={40}
					duration={3}
					repeatDelay={1}
					className="[mask-image:radial-gradient(800px_circle_at_center,white,transparent)] absolute inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
				/>
				<Container className="relative z-10">
					<div className="mx-auto max-w-4xl text-center">
						<h1 className="font-display text-4xl tracking-tight text-white sm:text-5xl lg:text-6xl">
							Notploy vs. CapRover
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Both platforms let you self-host applications on your own server.
							But they take very different approaches to deployment, monitoring,
							and team workflows—here's how they compare.
						</p>

						<div className="mt-16 grid gap-8 sm:grid-cols-2">
							<div className="rounded-xl border border-border/50 bg-card p-6 text-left">
								<h3 className="text-xl font-semibold text-white">Notploy</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									For teams that want a modern, polished deployment platform
									with built-in monitoring, automated backups, multi-server
									support, and a clean UI designed for productivity—choose
									Notploy.
								</p>
							</div>
							<div className="rounded-xl border border-border/50 bg-card p-6 text-left">
								<h3 className="text-xl font-semibold text-white">CapRover</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									For solo developers who want a simple, Heroku-like PaaS with
									one-click apps and a straightforward captain dashboard
									that's easy to get started with—choose CapRover.
								</p>
							</div>
						</div>

						<Button className="mt-10 rounded-full" asChild>
							<Link
								href="https://app.notploy.com/register"
								target="_blank"
								rel="noopener noreferrer"
							>
								Get started with Notploy
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			{/* Notploy vs CapRover at a glance */}
			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Notploy vs. CapRover at a glance
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Read our comprehensive Notploy vs. CapRover comparison before you
							make your decision.
						</p>
					</div>

					<div className="mx-auto mt-12 max-w-5xl overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="border-b border-border">
									<th className="px-4 py-4 text-left font-semibold">Feature</th>
									<th className="px-4 py-4 text-center font-semibold">Notploy</th>
									<th className="px-4 py-4 text-center font-semibold">CapRover</th>
								</tr>
							</thead>
							<tbody>
								{featureComparisonRows.map((row) => (
									<>
										{row.section && (
											<tr key={`section-${row.section}`} className="border-b border-border bg-muted/20">
												<td
													colSpan={3}
													className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
												>
													{row.section}
												</td>
											</tr>
										)}
										<tr
											key={row.feature}
											className="border-b border-border/50 hover:bg-muted/30"
										>
											<td className="px-4 py-3 text-sm">{row.feature}</td>
											<td className="px-4 py-3 text-center">
												<FeatureCell value={row.notploy} />
											</td>
											<td className="px-4 py-3 text-center">
												<FeatureCell value={row.caprover} />
											</td>
										</tr>
									</>
								))}
							</tbody>
						</table>
					</div>
				</Container>
			</section>

			{/* Why you should go with Notploy */}
			<section className="border-b border-border/30 bg-black py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
							Why you should go with Notploy
						</h2>
					</div>

					<div className="mx-auto mt-16 max-w-6xl space-y-20">
						{whyChooseItems.map((item, index) => (
							<div
								key={item.title}
								className={`flex flex-col gap-8 md:flex-row md:items-center ${
									index % 2 === 1 ? "md:flex-row-reverse" : ""
								}`}
							>
								<div className="flex-1">
									<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
										<item.icon className="h-6 w-6" />
									</div>
									<h3 className="text-xl font-semibold text-white">
										{item.title}
									</h3>
									<p className="mt-3 text-muted-foreground">{item.description}</p>
								</div>
								<div className="flex-1">
									<div className="relative aspect-video overflow-hidden rounded-xl border border-border/50">
										<Image
											src={item.image.src}
											alt={item.image.alt}
											fill
											className="object-cover object-top"
											sizes="(max-width: 768px) 100vw, 50vw"
										/>
									</div>
								</div>
							</div>
						))}
					</div>
				</Container>
			</section>

			{/* Notploy integrates with the leading solutions */}
			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Notploy integrates with the leading solutions
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							When it comes to a Notploy vs. CapRover comparison, you want the
							deployment platform that syncs with the tools in your workflow.
						</p>
					</div>

					<div className="mx-auto mt-12 max-w-4xl overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="border-b border-border">
									<th className="px-4 py-4 text-left font-semibold">Category</th>
									<th className="px-4 py-4 text-left font-semibold">Notploy</th>
									<th className="px-4 py-4 text-left font-semibold">CapRover</th>
								</tr>
							</thead>
							<tbody>
								{integrationRows.map((row) => (
									<tr
										key={row.category}
										className="border-b border-border/50"
									>
										<td className="px-4 py-3 font-medium">{row.category}</td>
										<td className="px-4 py-3 text-sm text-muted-foreground">
											{row.notploy}
										</td>
										<td className="px-4 py-3 text-sm text-muted-foreground">
											{row.caprover}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Container>
			</section>

			{/* Why Notploy is perfect for teams */}
			<section className="border-b border-border/30 bg-black py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-3xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
							Why Notploy is perfect for teams of any size
						</h2>
						<p className="mt-6 text-lg text-muted-foreground">
							Whether you're outgrowing CapRover's single-user setup or planning
							a production deployment from the start, Notploy gives you the team
							features, monitoring, and automation that CapRover leaves
							out—without sacrificing the simplicity of self-hosted deployments.
						</p>
					</div>
				</Container>
			</section>

			{/* Stats */}
			<ComparisonStats />

			{/* Testimonials */}
			<Testimonials />

			{/* Final CTA */}
			<CallToAction />
		</div>
	);
}
