import { Container } from "./Container";
import { Button } from "./ui/button";
import Link from "next/link";

const steps = [
	{
		number: "01",
		title: "GitHub",
		description:
			"A push or pull request notifies Notploy through a webhook — GitHub, GitLab, Gitea or Bitbucket.",
	},
	{
		number: "02",
		title: "Notploy",
		description:
			"The platform builds the application with Nixpacks, Buildpacks or your Dockerfile, resolves secrets and prepares the release.",
	},
	{
		number: "03",
		title: "Infrastructure",
		description:
			"Containers are scheduled on your servers or Swarm cluster. Routing, DNS and TLS certificates are updated automatically.",
	},
	{
		number: "04",
		title: "Applications",
		description:
			"The new version serves traffic. Logs, metrics, rollbacks and backups stay available from the dashboard, CLI or API.",
	},
];

export function HowItWorks() {
	return (
		<section
			aria-labelledby="how-notploy-works"
			className="border-b border-border/30 py-20 sm:py-32"
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
						One workflow connects your code, the platform and the machines that
						run it. Nothing runs on infrastructure you cannot see.
					</p>
				</div>

				<ol className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
