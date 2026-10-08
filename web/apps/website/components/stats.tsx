"use client";

import { Scale, Server, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useId } from "react";
import NumberTicker from "./ui/number-ticker";

const defaultStats = {
	githubStars: 0,
	contributors: 0,
};

export function StatsSection() {
	const [githubStars, setGithubStars] = useState(defaultStats.githubStars);
	const [contributors, setContributors] = useState(defaultStats.contributors);

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
		<div className="flex flex-col gap-10 px-4 py-20 lg:py-40 ">
			<div className="mx-auto max-w-2xl md:text-center">
				<h2 className="text-center font-display text-3xl  tracking-tight sm:text-4xl">
					Built in the open
				</h2>
				<p className="mt-4 text-center text-lg tracking-tight text-muted-foreground">
					Notploy is developed publicly and licensed for self-hosting. Here is
					where you can see the project for yourself.
				</p>
			</div>
			<div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 md:gap-2 lg:grid-cols-4">
				{getGrid({ githubStars, contributors }).map((feature, index) => (
					<div
						key={feature.title}
						className="relative overflow-hidden rounded-3xl bg-gradient-to-b  from-card to-background p-6"
					>
						<Grid size={20} seed={index + 1} />

						<p className="relative z-20 flex flex-row items-center gap-4 text-base font-bold text-foreground">
							{feature.title}
							{feature.icon}
						</p>
						<p className="relative z-20 mt-4 text-base font-normal text-muted-foreground">
							{feature.description}
						</p>
						{feature.component}
					</div>
				))}
			</div>
		</div>
	);
}

function getGrid({
	githubStars,
	contributors,
}: {
	githubStars: number;
	contributors: number;
}) {
	return [
		{
			title: "GitHub Stars",
			description: `Notploy is developed in the open on GitHub. Follow the repository to track releases, issues and roadmap work.`,
			icon: (
				<svg aria-hidden="true" className="h-6 w-6 fill-foreground">
					<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
				</svg>
			),
			component: (
				<p className="mt-4 whitespace-pre-wrap text-2xl  !font-semibold  tracking-tighter">
					<NumberTicker value={githubStars} />+
				</p>
			),
		},
		{
			title: "Community Contributors",
			description: `Built with the community: more than ${contributors} contributors have helped with code, documentation, integrations and translations.`,
			icon: <Users className="h-6 w-6 stroke-foreground" />,
			component: (
				<p className="mt-4 whitespace-pre-wrap text-2xl !font-semibold  tracking-tighter">
					<NumberTicker value={contributors} />+
				</p>
			),
		},
		{
			title: "License",
			description:
				"Notploy is open source under the Apache-2.0 license. Audit it, self-host it and modify it.",
			icon: <Scale className="h-6 w-6 stroke-foreground" />,
			component: (
				<p className="mt-4 whitespace-pre-wrap text-2xl  !font-semibold tracking-tighter">
					Apache-2.0
				</p>
			),
		},
		{
			title: "Self-hosted",
			description:
				"Run Notploy on your servers, your network and your database — or use Notploy Cloud if you would rather not manage the control plane.",
			icon: <Server className="h-6 w-6 stroke-foreground" />,
			component: (
				<p className="mt-4 whitespace-pre-wrap text-2xl  !font-semibold tracking-tighter">
					Your servers
				</p>
			),
		},
	];
}

// Seeded PRNG so the server and client render identical squares (no hydration
// mismatch) and generated pairs never repeat (unique React keys).
function generatePattern(seed: number) {
	let state = seed * 747796405 + 2891336453;
	const random = () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
	const squares: number[][] = [];
	const used = new Set<string>();
	while (squares.length < 5) {
		const x = Math.floor(random() * 4) + 7;
		const y = Math.floor(random() * 6) + 1;
		if (!used.has(`${x}-${y}`)) {
			used.add(`${x}-${y}`);
			squares.push([x, y]);
		}
	}
	return squares;
}

export const Grid = ({
	pattern,
	size,
	seed = 1,
}: {
	pattern?: number[][];
	size?: number;
	seed?: number;
}) => {
	const p = pattern ?? generatePattern(seed);
	return (
		<div className="pointer-events-none absolute left-1/2 top-0  -ml-20 -mt-2 h-full w-full [mask-image:linear-gradient(white,transparent)]">
			<div className="absolute inset-0 bg-gradient-to-r  from-card/30 to-card/30 opacity-100 [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
				<GridPattern
					width={size ?? 20}
					height={size ?? 20}
					x="-12"
					y="4"
					squares={p}
					className="absolute inset-0 h-full w-full  fill-foreground/10 stroke-foreground/10 mix-blend-overlay  "
				/>
			</div>
		</div>
	);
};

export function GridPattern({ width, height, x, y, squares, ...props }: any) {
	const patternId = useId();

	return (
		<svg aria-hidden="true" {...props}>
			<defs>
				<pattern
					id={patternId}
					width={width}
					height={height}
					patternUnits="userSpaceOnUse"
					x={x}
					y={y}
				>
					<path d={`M.5 ${height}V.5H${width}`} fill="none" />
				</pattern>
			</defs>
			<rect
				width="100%"
				height="100%"
				strokeWidth={0}
				fill={`url(#${patternId})`}
			/>
			{squares && (
				<svg x={x} y={y} className="overflow-visible">
					{squares.map(([x, y]: any, index: number) => (
						<rect
							strokeWidth="0"
							key={`${x}-${y}-${index}`}
							width={width + 1}
							height={height + 1}
							x={x * width}
							y={y * height}
						/>
					))}
				</svg>
			)}
		</svg>
	);
}
