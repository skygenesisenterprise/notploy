import { Container } from "./Container";

const problems = [
	{
		title: "Fragmented tooling",
		description:
			"Deployment here, DNS there, certificates somewhere else, backups in a fourth console. Teams assemble a stack of half-integrated tools and maintain the glue themselves.",
	},
	{
		title: "Ownership traded for convenience",
		description:
			"Managed platforms are easy to start but quietly take over your data, your runtimes and your pricing. Migrating away later is expensive — or impossible.",
	},
	{
		title: "Infrastructure too complex to touch",
		description:
			"Orchestration, proxies and load balancers are powerful, but they demand specialists. Simple workloads end up trapped behind a wall of YAML and tribal knowledge.",
	},
];

const principles = [
	{
		title: "Easy by default",
		description:
			"Deploy an application without first learning Docker, Traefik and Swarm end to end.",
	},
	{
		title: "Transparent by design",
		description:
			"Open source, standard technologies, no black boxes — the machinery stays visible and inspectable.",
	},
	{
		title: "Ownership stays yours",
		description:
			"The infrastructure, the data and the decisions remain under your control, on Self or with Cloud.",
	},
];

export function ProblemSection() {
	return (
		<section
			aria-labelledby="why-notploy"
			className="border-b border-border/30 bg-background py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						Why Notploy exists
					</p>
					<h2
						id="why-notploy"
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						Running applications should not require a stack of disconnected tools
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Infrastructure is fragmented: deployment, networking, certificates,
						secrets and observability live in different places, owned by
						different people. Notploy brings them into one platform — without
						taking the infrastructure away from you.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-3">
					{problems.map((problem) => (
						<div
							key={problem.title}
							className="rounded-xl border border-border/50 bg-card p-6"
						>
							<h3 className="text-lg font-semibold">{problem.title}</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								{problem.description}
							</p>
						</div>
					))}
				</div>

				<div className="mx-auto mt-16 grid max-w-5xl gap-8 border-t border-border/40 pt-10 sm:grid-cols-3">
					{principles.map((principle) => (
						<div key={principle.title}>
							<h3 className="font-display text-lg text-primary">
								{principle.title}
							</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								{principle.description}
							</p>
						</div>
					))}
				</div>
			</Container>
		</section>
	);
}
