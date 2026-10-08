"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/Container";
import NumberTicker from "@/components/ui/number-ticker";
import { Grid } from "@/components/stats";

const statsValues = {
	githubStars: 0,
	contributors: 0,
};

export function ComparisonStats() {
	const [githubStars, setGithubStars] = useState(statsValues.githubStars);
	const [contributors, setContributors] = useState(statsValues.contributors);

	useEffect(() => {
		const fetchStats = async () => {
			const [starsRes, contribRes] = await Promise.allSettled([
				fetch("/api/github-stars?owner=skygenesisenterprise&repo=notploy"),
				fetch("/api/github-contributors"),
			]);

			if (starsRes.status === "fulfilled" && starsRes.value.ok) {
				const data = await starsRes.value.json();
				setGithubStars(data.stargazers_count);
			}

			if (contribRes.status === "fulfilled" && contribRes.value.ok) {
				const data = await contribRes.value.json();
				setContributors(data.contributors_count);
			}
		};

		fetchStats();
	}, []);

	return (
		<section className="border-b border-border/30 py-20 sm:py-32">
			<Container>
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
						Built in the open
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						Notploy is developed publicly. Here is where you can see the
						project for yourself.
					</p>
				</div>

				<div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
					<div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card to-background p-6 text-center">
						<Grid size={20} />
						<p className="relative z-20 text-sm font-medium text-muted-foreground">
							GitHub Stars
						</p>
						<p className="relative z-20 mt-2 text-3xl font-bold">
							<NumberTicker value={githubStars} />+
						</p>
						<p className="relative z-20 mt-2 text-sm text-muted-foreground">
							Follow the repository
						</p>
					</div>
					<div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card to-background p-6 text-center">
						<Grid size={20} />
						<p className="relative z-20 text-sm font-medium text-muted-foreground">
							Community Contributors
						</p>
						<p className="relative z-20 mt-2 text-3xl font-bold">
							<NumberTicker value={contributors} />+
						</p>
						<p className="relative z-20 mt-2 text-sm text-muted-foreground">
							Code, docs and integrations
						</p>
					</div>
					<div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card to-background p-6 text-center">
						<Grid size={20} />
						<p className="relative z-20 text-sm font-medium text-muted-foreground">
							License
						</p>
						<p className="relative z-20 mt-2 text-3xl font-bold">
							Apache-2.0
						</p>
						<p className="relative z-20 mt-2 text-sm text-muted-foreground">
							Open source and auditable
						</p>
					</div>
					<div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card to-background p-6 text-center">
						<Grid size={20} />
						<p className="relative z-20 text-sm font-medium text-muted-foreground">
							Self-hosted
						</p>
						<p className="relative z-20 mt-2 text-3xl font-bold">
							Your servers
						</p>
						<p className="relative z-20 mt-2 text-sm text-muted-foreground">
							Or managed with Notploy Cloud
						</p>
					</div>
				</div>
			</Container>
		</section>
	);
}
