import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/pages/PageHero";
import {
	ProcessRail,
	SectionHeading,
} from "@/components/pages/PagePrimitives";
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
import { ArrowUpRight } from "lucide-react";
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

const workflow = [
	{
		title: "A branch is pushed",
		description:
			"A developer pushes a branch. A webhook notifies Notploy of the change.",
		label: "GitHub",
	},
	{
		title: "Notploy builds",
		description:
			"The platform builds the application, resolves configuration and secrets, and prepares the release.",
		label: "Build",
	},
	{
		title: "Infrastructure updates",
		description:
			"Containers are scheduled on your servers or Swarm cluster; routing and TLS are updated automatically.",
		label: "Deploy",
	},
	{
		title: "The app serves traffic",
		description:
			"The new version serves traffic. Logs, metrics and rollbacks are available from the dashboard, CLI or API.",
		label: "Live",
	},
];

export default function IntegrationsPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Integrations"
				badgeDetail="GitHub · CLI · API · MCP"
				title="Fits"
				highlight="the way you work"
				description="Notploy is not only a web dashboard. It is an infrastructure platform you can drive from GitHub, your editor, your terminal, your own systems and even AI agents — without changing how your team works."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="/platform">
								Explore the platform
								<IconArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href="https://docs.notploy.com/docs/core" target="_blank">
								Documentation
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/templates", label: "Deploy a template" },
					{ href: "/community", label: "Request an integration" },
					{
						href: "https://docs.notploy.com/docs/core/ai",
						label: "AI & MCP docs",
						external: true,
					},
				]}
			/>

			<section
				aria-labelledby="ways-to-work-with-notploy"
				className="pb-20 sm:pb-28"
			>
				<Container>
					<SectionHeading
						id="ways-to-work-with-notploy"
						title="Ways to work with Notploy"
						description="Each integration solves a concrete workflow, not a checkbox."
					/>

					<div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 border-l border-t border-border/40 sm:grid-cols-2">
						{integrations.map((integration) => (
							<div
								key={integration.title}
								className="group flex flex-col border-b border-r border-border/40 p-6 transition-colors hover:bg-card sm:p-8"
							>
								<div className="flex items-start justify-between gap-4">
									<integration.icon
										className="h-7 w-7 text-primary"
										stroke={1.5}
										aria-hidden="true"
									/>
									<span className="text-sm text-muted-foreground">
										{integration.title}
									</span>
								</div>
								<h3 className="mt-5 text-xl font-semibold text-foreground">
									{integration.tagline}
								</h3>
								<p className="mt-3 text-base leading-relaxed text-muted-foreground">
									{integration.description}
								</p>
								<div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
									{integration.flow.map((step, index) => (
										<span key={step} className="flex items-center gap-2">
											<span className="rounded-full bg-secondary px-3 py-1">
												{step}
											</span>
											{index < integration.flow.length - 1 && (
												<IconArrowRight
													className="h-3.5 w-3.5 text-primary"
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

			<ProcessRail
				id="a-concrete-workflow"
				title="A concrete workflow"
				description="How a change in your codebase reaches production on infrastructure you own."
				steps={workflow}
			/>

			<section aria-labelledby="more-integrations-on-the-way" className="py-20 sm:py-28">
				<Container>
					<div className="mx-auto grid max-w-6xl gap-8 rounded-2xl border border-border/50 bg-card p-8 sm:p-12 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
						<div>
							<h2
								id="more-integrations-on-the-way"
								className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
							>
								More integrations on the way
							</h2>
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
								Notploy is built around reusable provider adapters, so new
								sources, editors and automation targets land without
								redesigning the platform. Have a workflow in mind? Propose it.
							</p>
						</div>
						<div className="flex flex-col gap-3">
							<Button className="w-full rounded-full" asChild>
								<Link href="/community">Join the community</Link>
							</Button>
							<Button variant="outline" className="w-full rounded-full" asChild>
								<Link
									href="https://github.com/skygenesisenterprise/notploy"
									target="_blank"
								>
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
