"use client";

import { Scale, Server, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "../Container";
import { Grid } from "../stats";
import NumberTicker from "../ui/number-ticker";
import { statsContent } from "./content";
import { Reveal } from "./Reveal";

const defaultStats = {
	githubStars: 0,
	contributors: 0,
};

function GithubIcon() {
	return (
		<svg aria-hidden="true" className="h-6 w-6 fill-foreground">
			<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
		</svg>
	);
}

export function OpenStats({
	id = "open-stats",
	title = "Built in the open",
	description = "Notploy is developed publicly and licensed for self-hosting. Here is where you can see the project for yourself.",
}: {
	id?: string;
	title?: string;
	description?: string;
} = {}) {
	const [githubStars, setGithubStars] = useState(defaultStats.githubStars);
	const [contributors, setContributors] = useState(defaultStats.contributors);

	useEffect(() => {
		let cancelled = false;

		async function loadStats() {
			const [starsResult, contributorsResult] = await Promise.allSettled([
				fetch("/api/github-stars?owner=skygenesisenterprise&repo=notploy"),
				fetch("/api/github-contributors"),
			]);

			if (
				!cancelled &&
				starsResult.status === "fulfilled" &&
				starsResult.value.ok
			) {
				try {
					const data = await starsResult.value.json();
					if (!cancelled) {
						setGithubStars(Number(data.stargazers_count) || 0);
					}
				} catch {
					// Keep the default value when the endpoint returns invalid JSON.
				}
			}

			if (
				!cancelled &&
				contributorsResult.status === "fulfilled" &&
				contributorsResult.value.ok
			) {
				try {
					const data = await contributorsResult.value.json();
					if (!cancelled) {
						setContributors(Number(data.contributors_count) || 0);
					}
				} catch {
					// Keep the default value when the endpoint returns invalid JSON.
				}
			}
		}

		loadStats();
		return () => {
			cancelled = true;
		};
	}, []);

	const icons = {
		stars: <GithubIcon />,
		contributors: <Users className="h-6 w-6 stroke-foreground" />,
		license: <Scale className="h-6 w-6 stroke-foreground" />,
		hosting: <Server className="h-6 w-6 stroke-foreground" />,
	};

	return (
		<section aria-labelledby={id} className="py-20 sm:py-32">
			<Container>
				<Reveal>
					<div className="mx-auto max-w-2xl text-center">
						<h2
							id={id}
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							{title}
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
							{description}
						</p>
					</div>
				</Reveal>

				<div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{statsContent.map((stat, index) => (
						<Reveal key={stat.key} className="h-full" delay={index * 0.05}>
							<div className="relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-b from-card to-background p-6">
								<Grid size={20} seed={index + 1} />

								<p className="relative z-20 flex flex-row items-center gap-3 text-base font-bold text-foreground">
									{stat.label}
									{icons[stat.key]}
								</p>
								<p className="relative z-20 mt-4 text-base leading-relaxed text-muted-foreground">
									{stat.description}
								</p>

								<div className="relative z-20 mt-auto pt-6">
									<p className="whitespace-pre-wrap text-2xl font-semibold tracking-tighter text-foreground">
										{stat.key === "stars" && (
											<>
												<NumberTicker
													value={githubStars}
													className="tracking-tighter text-inherit"
												/>
												+
											</>
										)}
										{stat.key === "contributors" && (
											<>
												<NumberTicker
													value={contributors}
													className="tracking-tighter text-inherit"
												/>
												+
											</>
										)}
										{stat.key === "license" && "Apache-2.0"}
										{stat.key === "hosting" && "Your servers"}
									</p>
								</div>
							</div>
						</Reveal>
					))}
				</div>

				<div className="mt-8 text-center">
					<Link
						href="https://github.com/skygenesisenterprise/notploy"
						target="_blank"
						rel="noreferrer"
						className="text-base font-medium text-foreground underline underline-offset-4 hover:text-primary"
					>
						Follow the repository
					</Link>
				</div>
			</Container>
		</section>
	);
}
