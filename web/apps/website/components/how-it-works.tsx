import { Container } from "./Container";
import { Button } from "./ui/button";
import Link from "next/link";

const steps = [
	{
		number: "01",
		title: "Git repository",
		description:
			"A push or pull request notifies Notploy through a webhook — GitHub, GitLab, Gitea or Bitbucket.",
	},
	{
		number: "02",
		title: "Notploy",
		description:
			"The control plane resolves your configuration, environments and secrets, then plans the release.",
	},
	{
		number: "03",
		title: "Build & deploy",
		description:
			"The application is built with Nixpacks, Buildpacks, Railpack or your own Dockerfile and turned into a release.",
	},
	{
		number: "04",
		title: "Infrastructure",
		description:
			"Containers are scheduled on your servers or Swarm cluster. Routing, DNS and TLS certificates are updated automatically.",
	},
	{
		number: "05",
		title: "Application",
		description:
			"The new version serves traffic. Databases, volumes and configuration are updated in place, with instant rollback available.",
	},
	{
		number: "06",
		title: "Monitoring & operations",
		description:
			"Logs, metrics, schedules, backups and rollbacks stay available from the dashboard, CLI or API.",
	},
];

export function HowItWorks() {
	return (
		<section
			aria-labelledby="how-notploy-works"
			className="py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						How Notploy works
					</p>
					<h2
						id="how-notploy-works"
						className="font-display text-3xl tracking-tight sm:text-4xl"
					>
						From a commit to production, on your own infrastructure
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Notploy is the operational layer between your development workflow
						and the machines that run your applications. Nothing runs on
						infrastructure you cannot see.
					</p>
				</div>

				<ol className="mx-auto mt-14 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{steps.map((step) => (
						<li
							key={step.number}
							className="relative rounded-xl border border-border/50 bg-card p-6"
						>
							<div className="absolute right-5 top-5 font-display text-3xl font-bold text-primary/30">
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
	);
}
