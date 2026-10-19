import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "../Container";
import { editions } from "./content";
import { Reveal } from "./Reveal";

export function EditionsCompact() {
	return (
		<section aria-labelledby="self-vs-cloud" className="py-20 sm:py-32">
			<Container>
				<Reveal>
					<div className="mx-auto max-w-2xl text-center">
						<h2
							id="self-vs-cloud"
							className="font-display text-3xl tracking-tight text-foreground sm:text-4xl"
						>
							Same platform, two operating models
						</h2>
						<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
							Both editions share the same capabilities. Self is for teams that
							operate the control plane; Cloud is for teams that would rather
							Notploy Enterprise run it.
						</p>
					</div>
				</Reveal>

				<div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
					{editions.map((edition, index) => {
						const isCloud = index === 1;
						const muted = isCloud
							? "text-primary-foreground/75"
							: "text-muted-foreground";

						return (
							<Reveal key={edition.name} delay={index * 0.08}>
								<div
									className={cn(
										"flex h-full flex-col rounded-2xl border p-8",
										isCloud
											? "border-primary bg-primary text-primary-foreground"
											: "border-border/50 bg-card text-foreground",
									)}
								>
									<h3 className="font-display text-2xl tracking-tight">
										{edition.name}
									</h3>
									<p
										className={cn(
											"mt-2 text-base font-medium",
											isCloud ? "text-primary-foreground" : "text-primary",
										)}
									>
										{edition.tagline}
									</p>
									<p className={cn("mt-4 text-base leading-relaxed", muted)}>
										{edition.description}
									</p>

									<ul className="mt-6 flex-1 space-y-3">
										{edition.bullets.map((bullet) => (
											<li key={bullet} className="flex gap-3 text-base">
												<span
													className={cn(
														"mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
														isCloud ? "bg-primary-foreground" : "bg-primary",
													)}
												/>
												<span className={muted}>{bullet}</span>
											</li>
										))}
									</ul>

									<div className="mt-8">
										<Link
											href={edition.href}
											target={edition.external ? "_blank" : undefined}
											rel={edition.external ? "noreferrer" : undefined}
											className={cn(
												"inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
												isCloud
													? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
													: "bg-primary text-primary-foreground hover:bg-primary/90",
											)}
										>
											{edition.cta}
											<ArrowRight className="h-4 w-4" aria-hidden="true" />
										</Link>
									</div>
								</div>
							</Reveal>
						);
					})}
				</div>

				<p className="mt-6 text-center text-base text-muted-foreground">
					Built for solo developers, platform teams, SMBs and regulated
					organizations.{" "}
					<Link
						href="/pricing"
						className="text-foreground underline underline-offset-4 hover:text-primary"
					>
						Compare plans and pricing
					</Link>
					.
				</p>
			</Container>
		</section>
	);
}
