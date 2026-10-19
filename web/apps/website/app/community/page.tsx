import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import { OpenStats } from "@/components/home/OpenStats";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import {
	CellGrid,
	SectionHeading,
	SplitFeatureList,
} from "@/components/pages/PagePrimitives";
import { Button } from "@/components/ui/button";
import {
	IconBug,
	IconCode,
	IconFileText,
	IconGitPullRequest,
	IconLanguage,
	IconMessages,
	IconRoad,
	IconTemplate,
} from "@tabler/icons-react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Community",
	description:
		"Notploy is open source under Apache-2.0. Report bugs, join discussions, contribute code, write documentation, translate, publish templates and help shape the roadmap.",
	alternates: {
		canonical: "https://notploy.com/community",
	},
};

const contributionPaths = [
	{
		icon: IconBug,
		title: "Report bugs",
		description:
			"Found something broken? Open a GitHub issue with reproduction steps. Security vulnerabilities follow a private disclosure process instead.",
	},
	{
		icon: IconMessages,
		title: "Ask and discuss",
		description:
			"GitHub Discussions and Discord are where questions, ideas and deployment stories are shared — with maintainers and other operators.",
	},
	{
		icon: IconCode,
		title: "Contribute code",
		description:
			"Pick up an issue, fix a bug or ship a feature. The codebase is Apache-2.0 and contributions are reviewed in the open.",
	},
	{
		icon: IconFileText,
		title: "Write documentation",
		description:
			"Docs are a contribution surface too: clearer guides, missing examples and corrected steps help every new user.",
	},
	{
		icon: IconTemplate,
		title: "Publish templates",
		description:
			"Add blueprints to the templates gallery so others can deploy complex applications in one click.",
	},
	{
		icon: IconLanguage,
		title: "Translate",
		description:
			"Help present Notploy to non-English speaking communities and make the project accessible worldwide.",
	},
	{
		icon: IconGitPullRequest,
		title: "Propose an RFC",
		description:
			"Larger changes start as a discussion: describe the problem, the proposal and the trade-offs before code is written.",
	},
	{
		icon: IconRoad,
		title: "Shape the roadmap",
		description:
			"Vote on priorities, comment on proposals and help decide what the project builds next.",
	},
];

const principles = [
	{
		title: "Open by default",
		description:
			"Source code, issues, discussions and roadmap decisions happen in public repositories — anyone can follow along.",
	},
	{
		title: "Apache-2.0 licensed",
		description:
			"The core platform is free to use, modify and redistribute, for individuals and organizations alike.",
	},
	{
		title: "Built in the open",
		description:
			"Reviews, design discussions and trade-offs are visible, so the project's direction is never a black box.",
	},
];

const startingPoints = [
	{
		title: "New to Notploy",
		description:
			"Read the documentation, deploy a first application, then tell how it went. Feedback from new users is the most valuable there is.",
		cta: "Read the docs",
		href: "https://docs.notploy.com/docs/core",
		external: true,
	},
	{
		title: "Want to contribute",
		description:
			"Look for good-first-issue labels on GitHub, or bring a problem you actually have — both are valid entry points.",
		cta: "Browse issues",
		href: "https://github.com/skygenesisenterprise/notploy",
		external: true,
	},
	{
		title: "Just have a question",
		description:
			"Ask in Discussions or Discord. Chances are someone already hit what you are hitting.",
		cta: "Join Discord",
		href: "https://discord.gg/GUkDugVh34",
		external: true,
	},
];

export default function CommunityPage() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="Community"
				badgeDetail="Apache-2.0 · Built in the open"
				badgeHref="https://github.com/skygenesisenterprise/notploy"
				title="Built with the community,"
				highlight="in the open"
				description="Notploy is open-source infrastructure software, Apache-2.0 licensed. Whether you deploy with it, report issues, write docs or ship code — there is a clear way to participate."
				actions={
					<>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link
								href="https://github.com/skygenesisenterprise/notploy"
								target="_blank"
							>
								Open GitHub
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link
								href="https://github.com/skygenesisenterprise/notploy/discussions"
								target="_blank"
							>
								Join the discussions
								<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/templates", label: "Publish a template" },
					{
						href: "https://discord.gg/GUkDugVh34",
						label: "Discord",
						external: true,
					},
					{
						href: "https://github.com/skygenesisenterprise/notploy/issues",
						label: "Roadmap",
						external: true,
					},
				]}
			/>

			<OpenStats
				id="project-stats"
				title="The project, in public"
				description="Stars, contributors and license are visible to anyone. Here is where you can check the project for yourself."
			/>

			<CellGrid
				id="ways-to-participate"
				title="Ways to participate"
				description="Not every contribution is code. These are the paths that keep the project moving."
				items={contributionPaths}
				columns={4}
			/>

			<SplitFeatureList
				id="open-source-plainly-stated"
				title="Open source, plainly stated"
				description="The license and the development process are part of the product. Both are meant to be read."
				items={principles}
				aside={
					<p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
						Enterprise features are available under a commercial license
						maintained by Sky Genesis Enterprise — the core platform stays
						open.
					</p>
				}
			/>

			<section aria-labelledby="where-to-start" className="py-20 sm:py-28">
				<Container>
					<SectionHeading
						id="where-to-start"
						title="Where to start"
						description="Three honest entry points, whether you are deploying for the first time or writing your first patch."
					/>

					<Reveal className="mx-auto mt-12 max-w-6xl">
						<div className="grid divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/50 bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
							{startingPoints.map((point) => (
								<div key={point.title} className="flex flex-col p-6 sm:p-8">
									<h3 className="font-display text-xl tracking-tight text-foreground">
										{point.title}
									</h3>
									<p className="mt-3 text-base leading-relaxed text-muted-foreground">
										{point.description}
									</p>
									<div className="mt-6 pt-2">
										<Button
											variant="outline"
											className="rounded-full"
											asChild
										>
											<Link
												href={point.href}
												target={point.external ? "_blank" : undefined}
												rel={point.external ? "noreferrer" : undefined}
											>
												{point.cta}
												<ArrowRight
													className="ml-2 h-4 w-4"
													aria-hidden="true"
												/>
											</Link>
										</Button>
									</div>
								</div>
							))}
						</div>
					</Reveal>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
