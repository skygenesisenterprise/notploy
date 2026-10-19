import { Container } from "@/components/Container";
import { PartnerForm } from "@/components/PartnerForm";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { SectionHeading } from "@/components/pages/PagePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Partners",
	description:
		"Join the Notploy partner program. Agency plan, referral program, and reseller options.",
};

const PROGRAMS = [
	{
		title: "Agency Plan",
		badge: "Available",
		badgeVariant: "default" as const,
		description:
			"Premium licensing tier designed for agencies managing multiple clients.",
		features: [
			"White-label capabilities",
			"Unlimited servers",
			"Unlimited projects",
			"Unlimited organizations",
		],
		cta: "Get started",
		href: "#get-started",
	},
	{
		title: "Referral Program",
		badge: "Available",
		badgeVariant: "default" as const,
		description:
			"Earn 20% commission on every customer you refer to Notploy.",
		features: [
			"Co-marketing opportunities",
			"Partner dashboard",
			"Unique referral links",
			"20% of first-year revenue",
		],
		cta: "Get started",
		href: "#get-started",
	},
	{
		title: "Reseller Program",
		badge: "Coming soon",
		badgeVariant: "secondary" as const,
		description:
			"Sell Notploy directly in your market with local presence and relationships.",
		features: [
			"Strategic market access",
			"Cultural advantage",
			"Leverage local expertise",
			"Market expansion opportunity",
		],
		cta: "Express interest",
		href: "#get-started",
	},
];

export default function PartnersPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Partners"
				badgeDetail="Agency, referral & reseller"
				title="Partner with"
				highlight="Notploy"
				description="Unlock premium features for your clients, earn revenue through referrals, and scale your agency on infrastructure you control."
				actions={
					<Button className="rounded-full" asChild>
						<Link href="#get-started">Become a partner</Link>
					</Button>
				}
				links={[
					{ href: "mailto:partners@notploy.com", label: "partners@notploy.com" },
					{ href: "/pricing", label: "Pricing" },
				]}
			/>

			<section aria-labelledby="partner-programs" className="pb-20 sm:pb-28">
				<Container>
					<SectionHeading
						id="partner-programs"
						title="Partner programs"
						description="Pick the model that fits how you work with clients."
					/>

					<div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-3">
						{PROGRAMS.map((program) => (
							<Reveal key={program.title}>
								<div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-8">
									<Badge variant={program.badgeVariant} className="mb-5 w-fit">
										{program.badge}
									</Badge>
									<h3 className="font-display text-2xl tracking-tight text-foreground">
										{program.title}
									</h3>
									<p className="mt-3 text-base leading-relaxed text-muted-foreground">
										{program.description}
									</p>
									<ul className="mt-6 flex-1 space-y-3">
										{program.features.map((feature) => (
											<li key={feature} className="flex gap-3 text-base">
												<Check
													className="mt-1 h-4 w-4 shrink-0 text-primary"
													aria-hidden="true"
												/>
												<span className="text-muted-foreground">{feature}</span>
											</li>
										))}
									</ul>
									<div className="mt-8">
										<Button asChild variant="outline" className="w-full rounded-full">
											<Link href={program.href}>{program.cta}</Link>
										</Button>
									</div>
								</div>
							</Reveal>
						))}
					</div>
				</Container>
			</section>

			<section id="get-started" aria-labelledby="get-started-heading" className="pb-20 sm:pb-28">
				<Container>
					<div className="mx-auto max-w-2xl">
						<SectionHeading
							id="get-started-heading"
							title="Get started"
							description="Tell us about your agency or referral audience and we will follow up with the next steps."
						/>
						<Reveal className="mt-10 rounded-2xl border border-border/50 bg-card p-6 sm:p-8">
							<PartnerForm />
						</Reveal>
					</div>
				</Container>
			</section>
		</div>
	);
}
