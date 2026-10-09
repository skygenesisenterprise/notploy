import { Container } from "./Container";

const depths = [
	{
		level: "First contact",
		audience: "Beginners and self-hosters",
		tool: "Guided web UI",
		description:
			"Deploy from templates and sensible defaults — no terminal required to get something running.",
	},
	{
		level: "Building",
		audience: "Developers and teams",
		tool: "CLI, API and SDK",
		description:
			"Script deployments, wire Notploy into CI/CD pipelines and manage everything programmatically.",
	},
	{
		level: "Operating",
		audience: "DevOps and administrators",
		tool: "Full infrastructure controls",
		description:
			"Manage servers, clusters, networking, security policies, access control and audits.",
	},
];

const audiences = [
	{
		title: "Solo developers",
		description: "Ship side projects and client work without a platform team.",
	},
	{
		title: "Development teams",
		description: "Preview, deploy and rollback together, with shared environments.",
	},
	{
		title: "DevOps & infrastructure teams",
		description: "Standardize how the whole organization deploys and operates.",
	},
	{
		title: "Small and medium businesses",
		description: "One platform instead of a stack of half-integrated tools.",
	},
	{
		title: "Enterprise & regulated organizations",
		description:
			"Self-host inside your own boundary, with SSO, roles and audit logs.",
	},
	{
		title: "Public-sector organizations",
		description: "Keep data and operations on infrastructure you control.",
	},
	{
		title: "Hosting providers",
		description: "Offer deployment platforms on top of your own infrastructure.",
	},
];

export function WhoIsItFor() {
	return (
		<section
			aria-labelledby="who-is-it-for"
			className="bg-background py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						Who is it for?
					</p>
					<h2
						id="who-is-it-for"
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						One platform, used at different depths
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Notploy is not only for infrastructure specialists. The same
						platform serves people who just want to deploy, teams that live in
						the terminal, and organizations that operate at scale — you choose
						how deep you go.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl gap-4">
					{depths.map((depth, index) => (
						<div
							key={depth.level}
							className="flex flex-col gap-1 rounded-xl border border-border/50 bg-card p-5 sm:flex-row sm:items-baseline sm:gap-6"
						>
							<p className="w-8 shrink-0 font-display text-lg font-bold text-primary/40">
								{`0${index + 1}`}
							</p>
							<p className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wider text-primary">
								{depth.tool}
							</p>
							<div>
								<h3 className="text-base font-semibold">{depth.audience}</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{depth.description}
								</p>
							</div>
						</div>
					))}
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{audiences.map((audience) => (
						<div
							key={audience.title}
							className="rounded-xl border border-border/50 bg-card p-4"
						>
							<h3 className="text-sm font-semibold">{audience.title}</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{audience.description}
							</p>
						</div>
					))}
				</div>
			</Container>
		</section>
	);
}
