import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { CellGrid, SectionHeading } from "@/components/pages/PagePrimitives";
import { Button } from "@/components/ui/button";
import {
	IconFileAnalytics,
	IconServer2,
	IconShieldLock,
} from "@tabler/icons-react";
import {
	ArrowUpRight,
	Briefcase,
	Building2,
	Factory,
	FlaskConical,
	GraduationCap,
	HeartPulse,
	Landmark,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Industries: Deployment Solutions by Sector",
	description:
		"See how teams in finance, healthcare, government, manufacturing, pharmaceuticals, higher education, and agencies use Notploy to deploy applications in environments they control.",
	alternates: {
		canonical: "https://notploy.com/industries",
	},
};

const industries = [
	{
		icon: Landmark,
		title: "Finance & Banking",
		description:
			"Deploy internal banking tools, fintech services, and customer-facing apps with governed access, audit logs, and private infrastructure.",
		href: "/industries/finance-banking",
	},
	{
		icon: Briefcase,
		title: "Agencies",
		description:
			"Launch client websites, SaaS products, and campaign apps from one repeatable platform with previews, domains, and whitelabeling.",
		href: "/industries/agencies",
	},
	{
		icon: HeartPulse,
		title: "Healthcare",
		description:
			"Release patient portals, clinical tools, and internal apps in private environments your IT teams can govern and monitor.",
		href: "/industries/healthcare",
	},
	{
		icon: Building2,
		title: "Government",
		description:
			"Deploy citizen services, case management systems, and department tools in self-hosted, audit-ready environments your agency controls.",
		href: "/industries/government",
	},
	{
		icon: Factory,
		title: "Manufacturing",
		description:
			"Ship plant-floor apps, integrations, and dashboards through controlled environments mapped to sites, lines, and regions.",
		href: "/industries/manufacturing",
	},
	{
		icon: FlaskConical,
		title: "Pharmaceuticals",
		description:
			"Deploy research tools, lab applications, and quality systems with review workflows, rollback options, and enterprise governance.",
		href: "/industries/pharmaceuticals",
	},
	{
		icon: GraduationCap,
		title: "Higher Education",
		description:
			"Give students a safe sandbox to deploy coursework apps, course projects, and teaching tools that IT teams can manage centrally.",
		href: "/industries/higher-education",
	},
];

const commonFoundation = [
	{
		icon: IconShieldLock,
		title: "Access you can govern",
		description:
			"Organizations, projects, roles, sessions, API keys and single sign-on keep the platform aligned with your internal access model.",
	},
	{
		icon: IconServer2,
		title: "Data inside your boundary",
		description:
			"Notploy Self keeps the control plane, application data and backups on infrastructure you own, including restricted and air-gapped networks.",
	},
	{
		icon: IconFileAnalytics,
		title: "Operations you can audit",
		description:
			"Audit logs record who changed what and when, so incidents and compliance reviews can be answered from the same control plane.",
	},
];

export default function IndustriesPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Industries"
				badgeDetail="Regulated · Fast-moving teams"
				title="Deployment for"
				highlight="your industry"
				description="Notploy gives teams in regulated and fast-moving industries a governed platform to deploy, review, and operate applications on infrastructure they control."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link
								href="https://app.notploy.com/register"
								target="_blank"
								rel="noopener noreferrer"
							>
								Get Started
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link href="/contact">Contact Sales</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/self", label: "Self-host Notploy" },
					{ href: "/platform", label: "Platform capabilities" },
					{ href: "/comparison", label: "Comparisons" },
				]}
			/>

			<section
				aria-labelledby="explore-notploy-by-industry"
				className="pb-20 sm:pb-28"
			>
				<Container>
					<SectionHeading
						id="explore-notploy-by-industry"
						title="Explore Notploy by industry"
						description="The same deployment platform, adapted to the workflows, governance, and infrastructure requirements of your sector."
					/>

					<div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 border-l border-t border-border/40 sm:grid-cols-2">
						{industries.map((industry, index) => (
							<Reveal key={industry.title} delay={index * 0.04}>
								<Link
									href={industry.href}
									className="group flex h-full flex-col border-b border-r border-border/40 p-7 transition-colors hover:bg-card sm:p-8"
								>
									<div className="flex items-center justify-between gap-4">
										<industry.icon
											className="h-7 w-7 text-primary"
											strokeWidth={1.5}
											aria-hidden="true"
										/>
										<ArrowUpRight
											className="h-5 w-5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
											aria-hidden="true"
										/>
									</div>
									<h3 className="mt-6 font-display text-2xl tracking-tight text-foreground">
										{industry.title}
									</h3>
									<p className="mt-3 text-base leading-relaxed text-muted-foreground">
										{industry.description}
									</p>
								</Link>
							</Reveal>
						))}
					</div>
				</Container>
			</section>

			<CellGrid
				id="the-same-foundation"
				title="The same foundation, adapted to your sector"
				description="Sector pages change the examples and the operational constraints. The platform underneath stays the same."
				items={commonFoundation}
				columns={3}
			/>

			<CallToAction />
		</div>
	);
}
