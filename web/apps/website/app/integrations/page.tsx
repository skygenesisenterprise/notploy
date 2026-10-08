import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { Button } from "@/components/ui/button";
import {
	IconApi,
	IconArrowRight,
	IconBrandGithub,
	IconBrandVscode,
	IconDeviceDesktop,
	IconPlug,
	IconRobot,
	IconTerminal2,
} from "@tabler/icons-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Integrations",
	description:
		"Notploy fits into the workflows you already use: GitHub, VS Code, CLI, API, SDK, MCP for AI agents, desktop and future providers — one infrastructure platform, many ways to work with it.",
	alternates: {
		canonical: "https://notploy.com/integrations",
	},
};

const integrations = [
	{
		icon: IconBrandGithub,
		title: "GitHub",
		tagline: "Commit to production",
		description:
			"Connect a repository, push to a branch, and let Notploy build and deploy automatically through webhooks. Preview environments and rollback stay one click away.",
		flow: ["Push to GitHub", "Notploy builds", "App updated"],
	},
	{
		icon: IconBrandVscode,
		title: "VS Code",
		tagline: "Deploy without leaving your editor",
		description:
			"Work on your code and drive your Notploy projects from the editor you already use, instead of switching to a browser tab for every operational action.",
		flow: ["Edit in VS Code", "Trigger deploy", "Watch it ship"],
	},
	{
		icon: IconTerminal2,
		title: "CLI",
		tagline: "Infrastructure from the terminal",
		description:
			"Script deployments, inspect applications and manage projects straight from your shell — in local development, in CI pipelines or over SSH.",
		flow: ["notploy deploy", "Build runs", "Logs streamed"],
	},
	{
		icon: IconApi,
		title: "API & SDK",
		tagline: "Automate everything",
		description:
			"A REST API and a TypeScript SDK expose the same operations as the dashboard, so provisioning, deployments and reporting fit into your own systems.",
		flow: ["Your system", "API call", "Infrastructure changes"],
	},
	{
		icon: IconRobot,
		title: "MCP",
		tagline: "Controlled access for AI agents",
		description:
			"The Model Context Protocol server lets AI tools and agents operate your Notploy infrastructure through a controlled, permission-aware interface instead of raw credentials.",
		flow: ["AI agent", "MCP server", "Scoped Notploy actions"],
	},
	{
		icon: IconDeviceDesktop,
		title: "Desktop",
		tagline: "A native surface for operators",
		description:
			"A dedicated desktop experience for working with Notploy day to day — notifications, quick actions and a place that lives outside the browser.",
		flow: ["Desktop app", "Connected to your instance", "Operate anywhere"],
	},
];

export default function IntegrationsPage() {
	return (
		<div className="min-h-screen bg-background">
			<section className="relative overflow-hidden border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-4xl text-center">
						<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
							Notploy fits the way you already work
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Notploy is not only a web dashboard. It is an infrastructure
							platform you can drive from GitHub, your editor, your terminal,
							your own systems and even AI agents — without changing how your
							team works.
						</p>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link href="/platform">Explore the platform</Link>
							</Button>
							<Button variant="outline" className="rounded-full" asChild>
								<Link href="https://docs.notploy.com/docs/core" target="_blank">
									Documentation
								</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Ways to work with Notploy
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Each integration solves a concrete workflow, not a checkbox.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
						{integrations.map((integration) => (
							<div
								key={integration.title}
								className="flex flex-col rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<integration.icon className="h-6 w-6" />
								</div>
								<h3 className="text-xl font-semibold">{integration.title}</h3>
								<p className="mt-1 text-sm font-medium text-primary">
									{integration.tagline}
								</p>
								<p className="mt-3 text-sm text-muted-foreground">
									{integration.description}
								</p>
								<div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									{integration.flow.map((step, index) => (
										<span key={step} className="flex items-center gap-2">
											<span className="rounded-full border border-border/50 bg-background px-2.5 py-1">
												{step}
											</span>
											{index < integration.flow.length - 1 && (
												<IconArrowRight
													className="h-3 w-3 text-primary"
													aria-hidden="true"
												/>
											)}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							A concrete workflow
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							How a change in your codebase reaches production on infrastructure
							you own.
						</p>
					</div>
					<ol className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{[
							{
								number: "01",
								title: "GitHub",
								description:
									"A developer pushes a branch. A webhook notifies Notploy of the change.",
							},
							{
								number: "02",
								title: "Notploy",
								description:
									"The platform builds the application, resolves configuration and secrets, and prepares the release.",
							},
							{
								number: "03",
								title: "Infrastructure",
								description:
									"Containers are scheduled on your servers or Swarm cluster; routing and TLS are updated automatically.",
							},
							{
								number: "04",
								title: "Applications",
								description:
									"The new version serves traffic. Logs, metrics and rollbacks are available from the dashboard, CLI or API.",
							},
						].map((step) => (
							<li
								key={step.number}
								className="relative rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="absolute right-6 top-6 font-display text-3xl font-bold text-primary/30">
									{step.number}
								</div>
								<h3 className="text-lg font-semibold">{step.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{step.description}
								</p>
							</li>
						))}
					</ol>
					<div className="mx-auto mt-12 max-w-2xl text-center">
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								href="https://docs.notploy.com/docs/core/architecture"
								target="_blank"
							>
								Go deeper: architecture documentation
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							More integrations on the way
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Notploy is built around reusable provider adapters, so new
							sources, editors and automation targets land without redesigning
							the platform. Have a workflow in mind? Propose it.
						</p>
						<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link href="/community">Join the community</Link>
							</Button>
							<Button variant="outline" className="rounded-full" asChild>
								<Link href="https://github.com/skygenesisenterprise/notploy" target="_blank">
									<IconPlug className="mr-2 h-4 w-4" aria-hidden="true" />
									Request an integration
								</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
