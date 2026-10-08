"use client";

import { footerSections, EXTERNAL_LINKS } from "@/lib/site-navigation";
import Link from "next/link";
import { Container } from "./Container";
import { NavLink } from "./NavLink";
import { Logo } from "./shared/Logo";

export function Footer() {
	return (
		<footer className="bg-background" role="contentinfo">
			<Container>
				<div className="py-12 md:py-16">
					{/* Logo + name + tagline */}
					<div className="flex flex-col items-center gap-2 text-center md:items-start">
						<Link
							href="/"
							aria-label="Notploy - Home"
							className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded"
						>
							<Logo className="h-10 w-auto" />
							<span className="text-xl font-semibold text-primary">
								Notploy
							</span>
						</Link>
					<span className="text-sm font-medium text-muted-foreground">
						The open-source infrastructure platform — self-hosted or managed
					</span>
					</div>

					{/* Link columns - SEO-friendly grouping */}
					<div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
						{footerSections.map((section) => (
							<nav
								key={section.title}
								aria-label={section.ariaLabel}
								className="flex flex-col"
							>
								<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									{section.title}
								</h3>
								<ul className="mt-4 space-y-3">
									{section.links.map((item) => (
										<li key={item.href + item.label}>
											{"external" in item && item.external ? (
												<NavLink href={item.href} target="_blank">
													{item.label}
												</NavLink>
											) : (
												<NavLink href={item.href}>{item.label}</NavLink>
											)}
										</li>
									))}
								</ul>
							</nav>
						))}
					</div>
				</div>

				{/* Bottom bar: social + copyright */}
				<div className="flex flex-col items-center border-t border-border py-8 sm:flex-row sm:justify-between sm:items-center gap-6">
					<p className="text-sm text-muted-foreground order-2 sm:order-1">
						© {new Date().getFullYear()} Notploy. Open-source, Apache-2.0.
					</p>
					<div
						className="flex items-center gap-6 order-1 sm:order-2"
						aria-label="Social links"
					>
						<Link
							href={EXTERNAL_LINKS.discord}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted-foreground hover:text-muted-foreground/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded"
							aria-label="Notploy on Discord"
						>
							<svg
								stroke="currentColor"
								fill="currentColor"
								strokeWidth="0"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
							>
								<path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
							</svg>
						</Link>
						<Link
							href={EXTERNAL_LINKS.github}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted-foreground hover:text-muted-foreground/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black rounded"
							aria-label="Notploy on GitHub"
						>
							<svg
								aria-hidden="true"
								className="h-6 w-6 fill-current"
								viewBox="0 0 24 24"
							>
								<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
							</svg>
						</Link>
					</div>
				</div>
			</Container>
		</footer>
	);
}
