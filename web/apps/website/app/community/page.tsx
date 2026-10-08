import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
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

export default function CommunityPage() {
	return (
		<div className="min-h-screen bg-background">
			<section className="relative overflow-hidden border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-4xl text-center">
						<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
							Built with the community, in the open
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Notploy is open-source infrastructure software, Apache-2.0
							licensed. Whether you deploy with it, report issues, write docs or
							ship code — there is a clear way to participate.
						</p>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link
									href="https://github.com/skygenesisenterprise/notploy"
									target="_blank"
								>
									Open GitHub
								</Link>
							</Button>
							<Button variant="outline" className="rounded-full" asChild>
								<Link
									href="https://github.com/skygenesisenterprise/notploy/discussions"
									target="_blank"
								>
									Join the discussions
								</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Ways to participate
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Not every contribution is code. These are the paths that keep the
							project moving.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{contributionPaths.map((path) => (
							<div
								key={path.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<path.icon className="h-6 w-6" />
								</div>
								<h3 className="text-lg font-semibold">{path.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{path.description}
								</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
							Open source, plainly stated
						</h2>
					</div>
					<div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
						{principles.map((principle) => (
							<div
								key={principle.title}
								className="rounded-xl border border-border/50 bg-card p-6 text-center"
							>
								<h3 className="text-lg font-semibold">{principle.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{principle.description}
								</p>
							</div>
						))}
					</div>
					<div className="mx-auto mt-12 max-w-2xl text-center">
						<p className="text-sm text-muted-foreground">
							Enterprise features are available under a commercial license
							maintained by Sky Genesis Enterprise — the core platform stays
							open.
						</p>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Where to start
						</h2>
					</div>
					<div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-3">
						<div className="rounded-xl border border-border/50 bg-card p-6">
							<h3 className="text-lg font-semibold">New to Notploy</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								Read the documentation, deploy a first application, then tell
								how it went. Feedback from new users is the most valuable there
								is.
							</p>
							<div className="mt-5">
								<Button variant="outline" size="sm" className="rounded-full" asChild>
									<Link href="https://docs.notploy.com/docs/core" target="_blank">
										Read the docs
									</Link>
								</Button>
							</div>
						</div>
						<div className="rounded-xl border border-border/50 bg-card p-6">
							<h3 className="text-lg font-semibold">Want to contribute</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								Look for good-first-issue labels on GitHub, or bring a problem
								you actually have — both are valid entry points.
							</p>
							<div className="mt-5">
								<Button variant="outline" size="sm" className="rounded-full" asChild>
									<Link
										href="https://github.com/skygenesisenterprise/notploy"
										target="_blank"
									>
										Browse issues
									</Link>
								</Button>
							</div>
						</div>
						<div className="rounded-xl border border-border/50 bg-card p-6">
							<h3 className="text-lg font-semibold">Just have a question</h3>
							<p className="mt-3 text-sm text-muted-foreground">
								Ask in Discussions or Discord. Chances are someone already hit
								what you are hitting.
							</p>
							<div className="mt-5">
								<Button variant="outline" size="sm" className="rounded-full" asChild>
									<Link href="https://discord.gg/2tBnJ3jDJc" target="_blank">
										Join Discord
									</Link>
								</Button>
							</div>
						</div>
					</div>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
