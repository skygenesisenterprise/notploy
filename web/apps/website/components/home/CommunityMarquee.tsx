import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Container } from "../Container";
import { Marquee } from "../ui/marquee";
import { contributionWays } from "./content";
import { Reveal } from "./Reveal";

const firstRow = contributionWays.slice(0, 5);
const secondRow = contributionWays.slice(5);

function ContributionCard({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<figure className="w-64 shrink-0 rounded-xl border border-border/50 bg-card p-4">
			<p className="text-sm font-medium text-primary">Contribute</p>
			<figcaption className="mt-2 text-base font-semibold text-foreground">
				{title}
			</figcaption>
			<blockquote className="mt-2 text-base leading-relaxed text-muted-foreground">
				{description}
			</blockquote>
		</figure>
	);
}

export function CommunityMarquee() {
	return (
		<section
			id="community"
			aria-labelledby="community-title"
			className="py-20 sm:py-32"
		>
			<Container>
				<Reveal>
					<div className="mx-auto max-w-2xl text-center">
						<h2
							id="community-title"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							Built in the open, with the community
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
							Notploy is developed publicly under Apache-2.0. Code is only one
							of the ways to take part.
						</p>
					</div>
				</Reveal>
			</Container>

			<div className="relative mt-10 flex h-[420px] w-full flex-col items-center justify-center overflow-hidden">
				<Marquee pauseOnHover className="[--duration:36s]">
					{firstRow.map((way) => (
						<ContributionCard key={way.title} {...way} />
					))}
				</Marquee>
				<Marquee reverse pauseOnHover className="[--duration:36s]">
					{secondRow.map((way) => (
						<ContributionCard key={way.title} {...way} />
					))}
				</Marquee>
			</div>

			<Container>
				<div className="mt-2 text-center">
					<Link
						href="/community"
						className="inline-flex items-center gap-2 text-base font-medium text-foreground underline underline-offset-4 hover:text-primary"
					>
						Read the contributing guide
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</div>
			</Container>
		</section>
	);
}
