import { Container } from "./Container";
import { Button } from "./ui/button";
import { IconCheck } from "@tabler/icons-react";
import Link from "next/link";

const models = [
	{
		name: "Notploy Self",
		tagline: "Open-source infrastructure you run",
		description:
			"Install Notploy on the servers you already own. You operate the control plane — upgrades, backups and network boundaries are your decisions.",
		bullets: [
			"Free and open source (Apache-2.0)",
			"Runs on any Linux server, VPS, bare metal or homelab",
			"Works in air-gapped and restricted environments",
			"Full API, CLI and SSH access",
		],
		href: "/self",
		cta: "Explore Self",
		variant: "outline" as const,
		external: false,
	},
	{
		name: "Notploy Cloud",
		tagline: "The managed service operated by Notploy",
		description:
			"Notploy runs and upgrades the control plane for you. Your applications keep running on infrastructure you control, with support when you need it.",
		bullets: [
			"Control plane hosted, monitored and upgraded by Notploy",
			"Always on a supported release",
			"Support and availability commitments",
			"Same platform capabilities as Self",
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
			className="border-b border-border/30 bg-background py-20 sm:py-32"
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
						One platform, two operating models
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Both editions share the same capabilities. What changes is who
						operates the control plane — you, or Notploy.
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
