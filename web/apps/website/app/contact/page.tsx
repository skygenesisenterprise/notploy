"use client";

import { Container } from "@/components/Container";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/home/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare } from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
	const [isSubmitted, setIsSubmitted] = useState(false);

	return (
		<div className="min-h-screen bg-background">
			<PageHero
				compact
				badge="Contact"
				badgeDetail="Sales & support"
				title="Let's talk about"
				highlight="your stack"
				description="Tell us what you are deploying and how you want to run it. Our team will point you to the right edition and help you get started."
				links={[
					{ href: "mailto:sales@notploy.com", label: "sales@notploy.com" },
					{ href: "https://docs.notploy.com", label: "Documentation" },
				]}
			/>

			<section aria-labelledby="contact-form" className="pb-20 sm:pb-28">
				<Container>
					<div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
						<Reveal className="lg:pt-4">
							<h2
								id="contact-form"
								className="font-display text-2xl tracking-tight text-foreground"
							>
								{isSubmitted ? "Message received" : "Send us a message"}
							</h2>
							<p className="mt-3 text-base leading-relaxed text-muted-foreground">
								{isSubmitted
									? "Thanks for reaching out. We will get back to you as soon as possible."
									: "Questions about self-hosting, Cloud, Enterprise or a migration? We usually reply within one business day."}
							</p>

							<div className="mt-8 space-y-4 border-t border-border/40 pt-6">
								<a
									href="mailto:sales@notploy.com"
									className="flex items-start gap-3 text-base text-muted-foreground transition-colors hover:text-foreground"
								>
									<Mail
										className="mt-1 h-4 w-4 shrink-0 text-primary"
										aria-hidden="true"
									/>
									<span>
										<span className="block text-foreground">Sales</span>
										sales@notploy.com
									</span>
								</a>
								<a
									href="https://discord.gg/notploy"
									target="_blank"
									rel="noreferrer"
									className="flex items-start gap-3 text-base text-muted-foreground transition-colors hover:text-foreground"
								>
									<MessageSquare
										className="mt-1 h-4 w-4 shrink-0 text-primary"
										aria-hidden="true"
									/>
									<span>
										<span className="block text-foreground">Community</span>
										Join the Discord
									</span>
								</a>
							</div>
						</Reveal>

						<Reveal className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8">
							{isSubmitted ? (
								<div className="py-8 text-center">
									<p className="text-lg text-muted-foreground">
										We&apos;ve received your message.
									</p>
									<Button
										className="mt-6 rounded-full"
										variant="outline"
										onClick={() => setIsSubmitted(false)}
									>
										Send another message
									</Button>
								</div>
							) : (
								<ContactForm onSuccess={() => setIsSubmitted(true)} />
							)}
						</Reveal>
					</div>
				</Container>
			</section>
		</div>
	);
}
