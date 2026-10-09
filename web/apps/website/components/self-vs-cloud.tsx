import { Container } from "./Container";
import { Button } from "./ui/button";
import { IconCheck } from "@tabler/icons-react";
import Link from "next/link";

const models = [
	{
		name: "Notploy Self",
		tagline: "You operate the platform",
		description:
			"Install Notploy on the servers you already own. You are responsible for the environment — and you keep every lever that comes with it.",
		bullets: [
			"You own the infrastructure and the data, end to end",
			"You install, administer and upgrade Notploy itself",
			"You decide backups, network boundaries and security policy",
			"You can modify and extend the installation (Apache-2.0)",
		],
		href: "/self",
		cta: "Explore Self",
		variant: "outline" as const,
		external: false,
	},
	{
		name: "Notploy Cloud",
		tagline: "Notploy Enterprise operates it for you",
		description:
			"Notploy Enterprise provides the service, runs the control plane and owns its availability — while your workloads keep running on infrastructure you control.",
		bullets: [
			"Notploy provides and operates the hosted service",
			"Availability, upgrades and monitoring are handled for you",
			"Always on a supported release, with support commitments",
			"Same platform capabilities as Self — not a reduced edition",
		],
		href: "https://app.notploy.com/register",
		cta: "Get started",
		variant: "default" as const,
		external: true,
	},
];

export function SelfVsCloud() {
	return (
		<section
			aria-labelledby="self-vs-cloud"
			className="bg-background py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						Self or Cloud
					</p>
					<h2
						id="self-vs-cloud"
						className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
					>
						Same platform, different operating model
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Both editions share the same capabilities. What changes is who
						operates the control plane and carries the operational
						responsibilities — you, or Notploy Enterprise. Cloud is not a
						reduced version of Self.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2">
					{models.map((model) => (
						<div
							key={model.name}
							className="flex flex-col rounded-xl border border-border/50 bg-card p-8"
						>
							<h3 className="font-display text-2xl text-foreground">
								{model.name}
							</h3>
							<p className="mt-1 text-sm font-medium text-primary">
								{model.tagline}
							</p>
							<p className="mt-4 text-sm text-muted-foreground">
								{model.description}
							</p>
							<ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
								{model.bullets.map((bullet) => (
									<li key={bullet} className="flex gap-3">
										<IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
										<span>{bullet}</span>
									</li>
								))}
							</ul>
							<div className="mt-8">
								<Button
									variant={model.variant}
									className="w-full rounded-full"
									asChild
								>
									<Link
										href={model.href}
										target={model.external ? "_blank" : undefined}
									>
										{model.cta}
									</Link>
								</Button>
							</div>
						</div>
					))}
				</div>

				<div className="mx-auto mt-10 max-w-2xl text-center">
					<p className="text-sm text-muted-foreground">
						Compare plans and pricing on the{" "}
						<Link
							href="/pricing"
							className="text-primary underline underline-offset-4 hover:text-primary/80"
						>
							pricing page
						</Link>
						, or read{" "}
						<Link
							href="https://docs.notploy.com/docs/core/differences"
							target="_blank"
							className="text-primary underline underline-offset-4 hover:text-primary/80"
						>
							Cloud vs Self in the documentation
						</Link>
						.
					</p>
				</div>
			</Container>
		</section>
	);
}
