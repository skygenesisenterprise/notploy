"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AnimatedGradientText from "./ui/animated-gradient-text";
import AnimatedGridPattern from "./ui/animated-grid-pattern";
import { Button } from "./ui/button";

export function Hero() {
	const [isCopied, setIsCopied] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsCopied(false);
		}, 2000);
		return () => clearTimeout(timer);
	}, [isCopied]);
	return (
		<div className="bg-background py-16 sm:py-24 lg:py-28">
			<div className=" bottom-0 flex w-full items-center justify-center overflow-hidden rounded-lg  bg-background">
				<div className="relative px-4 py-10">
					<div className="text-center">
						<motion.div
							className="relative z-10 mb-4 inline-block"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3 }}
						>
							<a
								href="https://github.com/skygenesisenterprise/notploy"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="Notploy is open source and Apache-2.0 licensed"
							>
								<div className="z-10 flex items-center justify-center">
									<AnimatedGradientText>
										🚀 <hr className="mx-2 h-4 w-px shrink-0 bg-border" />{" "}
										<span
											className={cn(
												"inline animate-gradient bg-gradient-to-r from-primary via-primary/60 to-primary bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent",
											)}
										>
											Open source · Apache-2.0 · Self-hosted or managed
										</span>
										<ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
									</AnimatedGradientText>
								</div>
							</a>
						</motion.div>

						<motion.h1
							className="mx-auto max-w-4xl font-display text-5xl font-medium tracking-tight text-muted-foreground sm:text-7xl"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3 }}
						>
							Deploy and operate{" "}
							<span className="relative whitespace-normal lg:whitespace-nowrap text-primary">
								<svg
									aria-hidden="true"
									viewBox="0 0 418 42"
									className="absolute left-0 top-2/3 h-[0.58em] w-full fill-primary"
									preserveAspectRatio="none"
								>
									<path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
								</svg>
								<span className="relative">applications</span>
							</span>{" "}
							on infrastructure you control
						</motion.h1>
						<motion.div
							className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3, delay: 0.4 }}
						>
							<div className="flex flex-col gap-6">
								<div className="mx-auto mt-6 flex w-full max-w-sm flex-wrap items-center justify-center gap-3 md:flex-nowrap">
									<Button className="w-full rounded-full" asChild>
										<Link
											href="/self"
											aria-label="Get started with Notploy Self"
										>
											Get Started
										</Link>
									</Button>
									<Button
										className="w-full rounded-full bg-primary  hover:bg-primary/90"
										asChild
									>
										<Link
											href="https://app.notploy.com/register"
											aria-label="Create a Notploy Cloud account"
											target="_blank"
											className="text-foreground"
										>
											Try Notploy Cloud
										</Link>
									</Button>
								</div>
								<div className="flex flex-wrap items-center justify-center gap-6 md:flex-nowrap">
									<code className="flex flex-row items-center gap-4 rounded-xl border p-3 font-sans">
										curl -sSL https://notploy.com/install.sh | sh
										<button
											type="button"
											onClick={() =>
												navigator.clipboard
													.writeText(
														"curl -sSL https://notploy.com/install.sh | sh",
													)
													.then(() => setIsCopied(true))
													.catch(() => setIsCopied(false))
											}
										>
											{isCopied ? (
												<Check className="h-4 w-4 text-muted-foreground" />
											) : (
												<Copy className="h-4 w-4 text-muted-foreground" />
											)}
										</button>
									</code>
								</div>
								<div className="flex items-center justify-center gap-5 text-sm text-muted-foreground">
									<a
										href="https://github.com/skygenesisenterprise/notploy"
										target="_blank"
										rel="noopener noreferrer"
										className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
									>
										GitHub
									</a>
									<span aria-hidden="true">·</span>
									<a
										href="https://docs.notploy.com/docs/core"
										target="_blank"
										rel="noopener noreferrer"
										className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
									>
										Documentation
									</a>
									<span aria-hidden="true">·</span>
									<Link
										href="/integrations"
										className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
									>
										Ways to use Notploy
									</Link>
								</div>
							</div>
						</motion.div>
					</div>
				</div>
				<AnimatedGridPattern
					numSquares={30}
					maxOpacity={0.1}
					height={40}
					width={40}
					duration={3}
					repeatDelay={1}
					className={cn(
						"[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
						"absolute inset-x-0 inset-y-[-30%] h-[200%] skew-y-12",
					)}
				/>
			</div>
		</div>
	);
}
