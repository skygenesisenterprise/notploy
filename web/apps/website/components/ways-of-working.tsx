import { Container } from "./Container";
import { Button } from "./ui/button";
import {
	IconApi,
	IconBrandVscode,
	IconDeviceDesktop,
	IconRobot,
	IconTerminal2,
	IconWorldWww,
} from "@tabler/icons-react";
import Link from "next/link";

const ways = [
	{
		icon: IconWorldWww,
		title: "Web",
		description:
			"The full control plane in your browser: projects, deployments, databases, domains and monitoring.",
	},
	{
		icon: IconDeviceDesktop,
		title: "Desktop",
		description:
			"A dedicated desktop surface for day-to-day operations, quick actions and notifications.",
	},
	{
		icon: IconTerminal2,
		title: "CLI",
		description:
			"Deploy, inspect and script from your terminal — locally, in CI or over SSH.",
	},
	{
		icon: IconApi,
		title: "API & SDK",
		description:
			"Every dashboard operation is exposed through a REST API and a TypeScript SDK.",
	},
	{
		icon: IconRobot,
		title: "MCP",
		description:
			"AI agents operate your infrastructure through a controlled, permission-aware interface.",
	},
	{
		icon: IconBrandVscode,
		title: "VS Code",
		description:
			"Drive deployments from the editor where your team already spends its day.",
	},
];

export function WaysOfWorking() {
	return (
		<section
			aria-labelledby="ways-of-working"
			className="border-b border-border/30 py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						Ways of working
					</p>
					<h2
						id="ways-of-working"
						className="font-display text-3xl tracking-tight sm:text-4xl"
					>
						Use Notploy from wherever you work
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Notploy is not only a web dashboard. Pick the surface that fits the
						moment — they all talk to the same platform.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{ways.map((way) => (
						<div
							key={way.title}
							className="rounded-xl border border-border/50 bg-card p-6"
						>
							<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20 text-primary">
								<way.icon className="h-5 w-5" />
							</div>
							<h3 className="text-lg font-semibold">{way.title}</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								{way.description}
							</p>
						</div>
					))}
				</div>

				<div className="mx-auto mt-12 max-w-2xl text-center">
					<Button className="rounded-full" asChild>
						<Link href="/integrations">Explore all integrations</Link>
					</Button>
				</div>
			</Container>
		</section>
	);
}
