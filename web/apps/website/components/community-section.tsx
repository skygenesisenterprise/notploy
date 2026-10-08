import Link from "next/link";
import { Container } from "./Container";

const waysToContribute = [
	{
		title: "Code",
		description: "Fix bugs, ship features, review pull requests.",
	},
	{
		title: "Documentation",
		description: "Clearer guides, missing examples, corrected steps.",
	},
	{
		title: "Templates",
		description: "Publish blueprints to the templates gallery.",
	},
	{
		title: "Bug reports",
		description: "Issues with reproduction steps that make fixes faster.",
	},
	{
		title: "Testing",
		description: "Try releases, report regressions, verify fixes.",
	},
	{
		title: "UX feedback",
		description: "Tell us where the workflow confuses or slows you down.",
	},
	{
		title: "Translations",
		description: "Make Notploy accessible beyond English.",
	},
	{
		title: "Support",
		description: "Answer questions from new users in Discussions or Discord.",
	},
	{
		title: "Discussions",
		description: "Share deployment stories, ideas and trade-offs.",
	},
	{
		title: "RFCs",
		description: "Propose larger changes before code is written.",
	},
];

const centerLinks = [
	{
		href: "https://github.com/skygenesisenterprise/notploy",
		label: "Code & releases",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy/issues",
		label: "Issues & roadmap",
		external: true,
	},
	{
		href: "https://github.com/skygenesisenterprise/notploy/discussions",
		label: "Discussions",
		external: true,
	},
	{
		href: "/community",
		label: "Contributing guide",
		external: false,
	},
];

export function CommunitySection() {
	return (
		<section
			aria-labelledby="open-source-community"
			className="border-b border-border/30 py-20 sm:py-32"
		>
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
						Open source & community
					</p>
					<h2
						id="open-source-community"
						className="font-display text-3xl tracking-tight sm:text-4xl"
					>
						Built in the open — many ways to take part
					</h2>
					<p className="mt-4 text-lg tracking-tight text-muted-foreground">
						Notploy is developed publicly under Apache-2.0. The GitHub
						repository is where the code, issues, releases and roadmap live —
						but contributing code is only one of the ways to participate.
					</p>
				</div>

				<div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{waysToContribute.map((way) => (
						<div
							key={way.title}
							className="rounded-xl border border-border/50 bg-card p-4"
						>
							<h3 className="text-sm font-semibold">{way.title}</h3>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								{way.description}
							</p>
						</div>
					))}
				</div>

				<div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm">
					{centerLinks.map((link) => (
						<Link
							key={link.label}
							href={link.href}
							target={link.external ? "_blank" : undefined}
							className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
						>
							{link.label}
						</Link>
					))}
				</div>
			</Container>
		</section>
	);
}
