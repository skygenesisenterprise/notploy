"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Container } from "../Container";
import AnimatedGridPattern from "../ui/animated-grid-pattern";
import { Button } from "../ui/button";

const INSTALL_TARGETS = [
	{
		id: "linux",
		label: "Linux",
		command: "curl -sSL https://notploy.com/install.sh | sh",
		note: "Any Linux server, VPS or homelab with Docker.",
		docs: "https://docs.notploy.com/docs/core/installation",
	},
	{
		id: "windows",
		label: "Windows Server",
		command: "irm https://notploy.com/install.ps1 | iex",
		note: "Windows Server 2022+ in an elevated PowerShell, running Linux containers on WSL2.",
		docs: "https://docs.notploy.com/docs/core/installation",
	},
] as const;

type InstallTarget = (typeof INSTALL_TARGETS)[number];

export function HeroBoard() {
	const reduceMotion = useReducedMotion();
	const [copied, setCopied] = useState(false);
	const [target, setTarget] = useState<InstallTarget>(INSTALL_TARGETS[0]);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	async function copyInstallCommand() {
		try {
			await navigator.clipboard.writeText(target.command);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	function selectTarget(next: InstallTarget) {
		setTarget(next);
		setCopied(false);
	}

	const fadeIn = reduceMotion
		? {}
		: {
				initial: { opacity: 0, y: 16 },
				animate: { opacity: 1, y: 0 },
			};

	return (
		<section className="relative overflow-hidden">
			<div className="relative flex min-h-[calc(100svh_-_4.5rem)] items-center justify-center overflow-hidden py-16 sm:min-h-[calc(100svh_-_5rem)] sm:py-20">
				<div className="pointer-events-none absolute inset-0" aria-hidden="true">
					{!reduceMotion && (
						<AnimatedGridPattern
							numSquares={24}
							maxOpacity={0.08}
							height={40}
							width={40}
							duration={4}
							repeatDelay={1}
							className="absolute inset-0 h-full w-full"
						/>
					)}
				</div>

				<Container className="relative z-10">
					<div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
					<motion.div
						{...fadeIn}
						transition={{ duration: 0.5, ease: "easeOut" }}
					>
						<a
							href="https://github.com/skygenesisenterprise/notploy"
							target="_blank"
							rel="noreferrer"
							className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-primary" />
							<span>Open source · Apache-2.0</span>
							<span className="text-border">/</span>
							<span>Self-hosted or managed</span>
						</a>
					</motion.div>

					<motion.h1
						{...fadeIn}
						transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
						className="mx-auto mt-8 w-full max-w-4xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
					>
						<span className="text-muted-foreground">Deploy and operate </span>
						<span className="relative whitespace-nowrap text-primary">
							applications
							<svg
								aria-hidden="true"
								viewBox="0 0 418 42"
								className="absolute left-0 top-2/3 h-[0.58em] w-full fill-primary/40"
								preserveAspectRatio="none"
							>
								<path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
							</svg>
						</span>{" "}
						<span className="text-foreground">
							on infrastructure you control
						</span>
					</motion.h1>

					<motion.p
						{...fadeIn}
						transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
						className="mx-auto mt-6 w-full max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
					>
						One control plane for applications, databases and Compose
						projects — with routing, certificates, backups and monitoring in
						the same place.
					</motion.p>

					<motion.div
						{...fadeIn}
						transition={{ duration: 0.55, delay: 0.18, ease: "easeOut" }}
						className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row"
					>
						<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
							<Link href="/self">
								Get started with Self
								<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
						<Button
							variant="outline"
							className="w-full rounded-full px-6 sm:w-auto"
							asChild
						>
							<Link
								href="https://app.notploy.com/register"
								target="_blank"
								rel="noreferrer"
							>
								Try Notploy Cloud
								<ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Link>
						</Button>
					</motion.div>

					<motion.div
						{...fadeIn}
						transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
						className="mx-auto mt-8 flex w-full flex-col items-center"
					>
						<div
							role="tablist"
							aria-label="Install on"
							className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card p-1 text-sm"
						>
							{INSTALL_TARGETS.map((option) => (
								<button
									key={option.id}
									type="button"
									role="tab"
									aria-selected={option.id === target.id}
									onClick={() => selectTarget(option)}
									className={cn(
										"rounded-full px-3 py-1 transition-colors",
										option.id === target.id
											? "bg-secondary text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{option.label}
								</button>
							))}
						</div>

						<div className="mt-3 inline-flex w-fit max-w-[calc(100vw-2.5rem)] items-center gap-2 self-center rounded-xl border border-border/60 bg-card p-2 pl-4">
							<span className="shrink-0 text-sm text-primary" aria-hidden="true">
								{target.id === "windows" ? "PS>" : "$"}
							</span>
							<code className="min-w-0 overflow-x-auto whitespace-nowrap text-left font-mono text-[13px] text-foreground">
								{target.command}
							</code>
							<button
								type="button"
								onClick={copyInstallCommand}
								aria-label={
									copied ? "Install command copied" : "Copy install command"
								}
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
							>
								{copied ? (
									<Check className="h-4 w-4" aria-hidden="true" />
								) : (
									<Copy className="h-4 w-4" aria-hidden="true" />
								)}
							</button>
						</div>
						<p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
							{target.note}{" "}
							<a
								href={target.docs}
								target="_blank"
								rel="noreferrer"
								className="underline underline-offset-4 transition-colors hover:text-foreground"
							>
								Installation guide
							</a>
						</p>
					</motion.div>

					<div className="mt-6 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
						<a
							href="https://github.com/skygenesisenterprise/notploy"
							target="_blank"
							rel="noreferrer"
							className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							GitHub
						</a>
						<span className="text-border" aria-hidden="true">
							·
						</span>
						<a
							href="https://docs.notploy.com/docs/core"
							target="_blank"
							rel="noreferrer"
							className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							Documentation
						</a>
						<span className="text-border" aria-hidden="true">
							·
						</span>
						<Link
							href="/templates"
							className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							Templates
						</Link>
					</div>
					</div>
				</Container>
			</div>
		</section>
	);
}
