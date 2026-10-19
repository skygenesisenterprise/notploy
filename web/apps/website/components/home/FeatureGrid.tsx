import {
	IconActivity,
	IconApi,
	IconArchive,
	IconCertificate,
	IconDatabase,
	IconKey,
	IconNetwork,
	IconRocket,
	IconServer2,
	IconShieldLock,
	IconStack2,
	IconTemplate,
} from "@tabler/icons-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "../Container";
import { capabilities } from "./content";
import { Reveal } from "./Reveal";

const selectedFeatures = [
	{ title: "Application deployment", icon: IconRocket },
	{ title: "Docker Compose projects", icon: IconStack2 },
	{ title: "Databases with backups", icon: IconDatabase },
	{ title: "Servers & clusters", icon: IconServer2 },
	{ title: "Storage & object storage", icon: IconArchive },
	{ title: "One-click templates", icon: IconTemplate },
	{ title: "Domains & TLS", icon: IconCertificate },
	{ title: "Networks & routing", icon: IconNetwork },
	{ title: "Secrets & environments", icon: IconKey },
	{ title: "Access control & SSO", icon: IconShieldLock },
	{ title: "Monitoring & logs", icon: IconActivity },
	{ title: "Schedules & automation", icon: IconApi },
];

const features = selectedFeatures.flatMap(({ title, icon }) => {
	const capability = capabilities.find((item) => item.title === title);
	return capability ? [{ ...capability, icon }] : [];
});

export function FeatureGrid() {
	return (
		<section aria-labelledby="capabilities" className="pt-24 sm:pt-32">
			<Container>
				<Reveal>
					<div className="mx-auto max-w-2xl text-center">
						<h2
							id="capabilities"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							Everything you need to operate
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
							Deployments, databases, servers, routing, secrets, backups and
							monitoring — one control plane, on infrastructure you control.
						</p>
					</div>
				</Reveal>

				<div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-l border-t border-border/40 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="group relative flex flex-col border-b border-r border-border/40 px-8 py-9 transition-colors hover:bg-card"
						>
							<feature.icon
								className="mb-5 h-7 w-7 text-primary"
								stroke={1.5}
								aria-hidden="true"
							/>
							<div className="mb-2 flex items-start gap-3">
								<span className="mt-1 h-5 w-0.5 shrink-0 rounded-full bg-primary/30 transition-all duration-200 group-hover:h-7 group-hover:bg-primary" />
								<h3 className="text-lg font-semibold leading-snug text-foreground transition-transform duration-200 group-hover:translate-x-1">
									{feature.title}
								</h3>
							</div>
							<p className="text-base leading-relaxed text-muted-foreground">
								{feature.description}
							</p>
						</div>
					))}
				</div>

				<Reveal className="mt-8">
					<p className="text-center text-base text-muted-foreground">
						Plus container registries, audit logs and instant rollbacks.{" "}
						<Link
							href="/platform"
							className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
						>
							Explore the full platform
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					</p>
				</Reveal>
			</Container>
		</section>
	);
}
