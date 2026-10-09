import { Container } from "@/components/Container";
import Link from "next/link";
import { Button } from "./ui/button";

const paths = [
	{
		href: "/self",
		label: "Get started with Notploy Self",
		description: "Free, open source, on your servers",
	},
	{
		href: "https://app.notploy.com/register",
		label: "Explore Notploy Cloud",
		description: "Managed by Notploy, ready in minutes",
		external: true,
	},
	{
		href: "https://docs.notploy.com/docs/core",
		label: "Read the documentation",
		description: "Guides, installation, architecture and reference",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy",
		label: "View GitHub",
		description: "Source code, issues and releases",
		external: true,
	},
];

export function CallToAction() {
	return (
		<section
			id="get-started-today"
			className="relative mt-20 overflow-hidden bg-background py-16 sm:py-20"
		>
			<svg
				viewBox="0 0 2000 1000"
				xmlns="http://www.w3.org/2000/svg"
				className="absolute"
				aria-hidden="true"
			>
				<mask id="cta-grid-mask" x="0" y="0" width="2000" height="1000">
					<path fill="url(#cta-grid-fade)" d="M0 0h2000v1000H0z" />
				</mask>
				<g stroke="#22222233" strokeWidth=".4" fill="none" mask="url(#cta-grid-mask)">
					{Array.from({ length: 40 }, (_, row) => (
						<path
							key={`row-${row}`}
							d={`M0 ${row * 50}h2000`}
						/>
					))}
					{Array.from({ length: 40 }, (_, col) => (
						<path
							key={`col-${col}`}
							d={`M${col * 50} 0v1000`}
						/>
					))}
				</g>
				<defs>
					<radialGradient id="cta-grid-fade">
						<stop offset="50%" stopColor="#fff" stopOpacity="0" />
						<stop offset="1" stopColor="#fff" stopOpacity="1" />
					</radialGradient>
				</defs>
			</svg>
			<Container className="relative z-30">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
						Start with Notploy today
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Deploy your first application on infrastructure you own — self-hosted
						with Notploy Self, or managed with Notploy Cloud.
					</p>

					<div className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
						{paths.map((path) => (
							<Button
								key={path.href}
								variant="outline"
								className="h-auto flex-col rounded-xl px-6 py-4"
								asChild
							>
								<Link
									href={path.href}
									target={path.external ? "_blank" : undefined}
									aria-label={path.label}
								>
									<span className="text-base font-semibold">{path.label}</span>
									<span className="text-xs font-normal text-muted-foreground">
										{path.description}
									</span>
								</Link>
							</Button>
						))}
					</div>
				</div>
			</Container>
		</section>
	);
}
