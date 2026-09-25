import { Container } from "@/components/Container";
import { CallToAction } from "@/components/CallToAction";
import { Testimonials } from "@/components/Testimonials";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import { ArrowRight, GitBranch, Activity, Users, Gauge } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notploy Vs. and PaaS Comparison Pages | Notploy",
	description:
		"How does Notploy compare to other application deployment, database management, and PaaS solutions? Learn on our \"Notploy vs.\" alternative comparison pages.",
};

const competitors = [
	{
		name: "Coolify",
		href: "/notploy-vs-coolify",
		description:
			"See how Notploy's polished UI, monitoring, and automation compare to Coolify's indie-dev approach.",
	},
	{
		name: "Portainer",
		href: "/notploy-vs-portainer",
		description:
			"Compare Notploy's full deployment platform against Portainer's container management focus.",
	},
	{
		name: "CapRover",
		href: "/notploy-vs-caprover",
		description:
			"Discover why teams choose Notploy over CapRover for monitoring, backups, and team collaboration.",
	},
	{
		name: "Dokku",
		href: "/notploy-vs-dokku",
		description:
			"See how Notploy's visual dashboard and built-in tooling compare to Dokku's CLI-first workflow.",
	},
	{
		name: "Render",
		href: "/notploy-vs-render",
		description:
			"Compare Notploy's self-hosted infrastructure ownership to Render's fully managed, per-service PaaS.",
	},
	{
		name: "Vercel",
		href: "/notploy-vs-vercel",
		description:
			"See how Notploy's Docker-native, full-stack deployment compares to Vercel's serverless, frontend-first platform.",
	},
];

const whyNotploy = [
	{
		icon: GitBranch,
		title: "Deploy straight from your repo",
		description:
			"Notploy is built for actual application deployment, not just container management. You connect your repo, push code, and Notploy handles builds, containers, routing, and SSL without the extra scripts or side tools you end up stitching together elsewhere.",
	},
	{
		icon: Activity,
		title: "Monitor and back up by default",
		description:
			"Notploy gives you real-time metrics, alerts, and scheduled S3-compatible backups in the same product from day one. That means less setup, fewer moving parts, and a much shorter path from learning that something's wrong to fixing the problem.",
	},
	{
		icon: Users,
		title: "Scale across teams and servers",
		description:
			"Notploy fits the way teams actually work once a project stops being a solo side build. With multi-user support, RBAC, project grouping, and multi-server deployments, it gives you room to grow without forcing a platform switch later.",
	},
	{
		icon: Gauge,
		title: "Move faster in a polished UI",
		description:
			"Notploy keeps the workflow clean, responsive, and predictable, which has a big impact when you're deploying often. It also combines lightweight resource usage with a more refined interface, so you get less friction in the day-to-day and less overhead on the server side.",
	},
];

export default function ComparisonPage() {
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
							Notploy vs.
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Read our comparison pages to discover why so many people are
							choosing Notploy.
						</p>

						<Button className="mt-10 rounded-full" asChild>
							<Link
								href="https://app.notploy.com/register"
								target="_blank"
								rel="noopener noreferrer"
							>
								Get started
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			{/* Competitor comparison cards */}
			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
						{competitors.map((competitor) => (
							<Link
								key={competitor.name}
								href={competitor.href}
								className="group rounded-xl border border-border/50 bg-card p-8 transition hover:border-border hover:bg-muted/30"
							>
								<div className="flex items-center justify-between">
									<h2 className="text-xl font-semibold text-white">
										Notploy vs. {competitor.name}
									</h2>
									<ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
								</div>
								<p className="mt-3 text-sm text-muted-foreground">
									{competitor.description}
								</p>
							</Link>
						))}
					</div>
				</Container>
			</section>

			{/* Why Notploy is the best PaaS solution */}
			<section className="border-b border-border/30 bg-black py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
							Why Notploy is the best PaaS solution for scaling teams
						</h2>
					</div>

					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2">
						{whyNotploy.map((item) => (
							<div
								key={item.title}
								className="group rounded-2xl border border-border/30 bg-gradient-to-b from-gray-900/50 to-black p-8 transition hover:border-border/60"
							>
								<div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition group-hover:bg-primary/20">
									<item.icon className="h-6 w-6 text-primary" />
								</div>
								<h3 className="mb-3 text-xl font-semibold text-white">
									{item.title}
								</h3>
								<p className="leading-relaxed text-muted-foreground">
									{item.description}
								</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			{/* Testimonials */}
			<Testimonials />

			{/* Final CTA */}
			<CallToAction />
		</div>
	);
}
