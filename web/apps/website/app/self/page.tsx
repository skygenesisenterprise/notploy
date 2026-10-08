import { CallToAction } from "@/components/CallToAction";
import { Container } from "@/components/Container";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	IconCloudComputing,
	IconArrowBackUp,
	IconCpu,
	IconKey,
	IconLock,
	IconRefresh,
	IconRocket,
	IconServer2,
	IconShieldCheck,
	IconTerminal2,
	IconWorld,
} from "@tabler/icons-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notploy Self — Open-source, self-hosted infrastructure platform",
	description:
		"Run Notploy on infrastructure you control: your own servers, VPS, bare metal or hosting provider. Free, open source (Apache-2.0), with full control over data, updates and network boundaries.",
	alternates: {
		canonical: "https://notploy.com/self",
	},
};

const INSTALL_COMMAND = "curl -sSL https://notploy.com/install.sh | sh";

const infrastructureTargets = [
	{
		icon: IconServer2,
		title: "Your own servers and VPS",
		description:
			"Any Linux machine — from a small VPS to a rack of bare metal — can run Notploy. Docker is the only prerequisite.",
	},
	{
		icon: IconCpu,
		title: "Homelabs",
		description:
			"Notploy runs comfortably on modest hardware, making it a natural fit for homelab and personal infrastructure.",
	},
	{
		icon: IconCloudComputing,
		title: "Any hosting provider",
		description:
			"No preferred cloud: use AWS, Hetzner, OVH, Scaleway or your regional provider. Nothing ties Notploy to one vendor.",
	},
	{
		icon: IconWorld,
		title: "Air-gapped and restricted environments",
		description:
			"Deploy inside private networks, regulated environments or systems with no outbound access to a vendor cloud.",
	},
];

const controlPrinciples = [
	{
		icon: IconLock,
		title: "Sovereignty over your data",
		description:
			"Code, databases, logs and secrets never leave your infrastructure. You decide where data lives and who can reach it.",
	},
	{
		icon: IconRefresh,
		title: "You choose when to upgrade",
		description:
			"Updates are applied on your schedule, not on a vendor's release cadence. Pin a version, test it, then roll forward.",
	},
	{
		icon: IconShieldCheck,
		title: "Security under your control",
		description:
			"Firewall rules, SSH access, certificate authorities and backup destinations are all yours to configure and audit.",
	},
	{
		icon: IconArrowBackUp,
		title: "Backups you own",
		description:
			"Database and volume backups go to storage you choose — local disks, S3 buckets or your own backup system.",
	},
	{
		icon: IconKey,
		title: "Open source, no lock-in",
		description:
			"Apache-2.0 licensed. Read the code, fork it, extend it, or migrate your workloads away — the exit door is always open.",
	},
	{
		icon: IconTerminal2,
		title: "Full API and CLI access",
		description:
			"Everything the dashboard does is available through the API, CLI and SDK, so your automation never hits a paywalled endpoint.",
	},
];

const selfFaqs = [
	{
		question: "What do I need to run Notploy Self?",
		answer:
			"A Linux server with Docker installed. The installer sets up the rest of the stack; afterwards you manage everything from the web interface. A single small VPS is enough to get started.",
	},
	{
		question: "Is Notploy Self really free?",
		answer:
			"Yes. Notploy Self is open source under the Apache-2.0 license: no platform fees, no per-seat charges, no usage-based billing. You pay only for the infrastructure you already run.",
	},
	{
		question: "How are updates delivered?",
		answer:
			"New versions are released on GitHub with release notes. You decide when to upgrade your instance — automatic updates are optional, never imposed.",
	},
	{
		question: "Can I move from Self to Cloud later?",
		answer:
			"Yes. Both editions run the same platform capabilities, so the way you model applications, environments and teams stays the same if you change operating model.",
	},
	{
		question: "What happens if the Notploy project disappears?",
		answer:
			"Your running instance does not depend on any Notploy-hosted service. The source code and your data remain fully under your control, which is the point of self-hosting.",
	},
];

export default function SelfPage() {
	return (
		<div className="min-h-screen bg-background">
			<section className="relative overflow-hidden border-b border-border/30 bg-background py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-4xl text-center">
						<p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
							Notploy Self
						</p>
						<h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
							The open-source platform you run yourself
						</h1>
						<p className="mt-6 text-lg text-muted-foreground">
							Notploy Self is the free, Apache-2.0 licensed edition of Notploy.
							Install it on infrastructure you control — your servers, your VPS,
							your hosting provider — and deploy applications and databases
							without handing ownership of your stack to anyone.
						</p>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Button className="rounded-full" asChild>
								<Link href="https://docs.notploy.com/docs/core/installation" target="_blank">
									Installation guide
								</Link>
							</Button>
							<Button
								variant="outline"
								className="rounded-full"
								asChild
							>
								<Link href="https://github.com/skygenesisenterprise/notploy" target="_blank">
									View on GitHub
								</Link>
							</Button>
						</div>
						<div className="mx-auto mt-12 max-w-2xl">
							<div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-left font-mono text-sm text-foreground">
								<span className="select-none text-primary">$</span>
								<code className="flex-1 overflow-x-auto whitespace-nowrap">
									{INSTALL_COMMAND}
								</code>
							</div>
						</div>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Runs on infrastructure you choose
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Notploy does not require a specific provider or data center. If it
							runs Linux and Docker, it can run Notploy.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2">
						{infrastructureTargets.map((target) => (
							<div
								key={target.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<target.icon className="h-6 w-6" />
								</div>
								<h3 className="text-xl font-semibold">{target.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{target.description}
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
							Control and sovereignty by default
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Self-hosting is not only about where binaries run. It is about
							keeping decisions — data location, upgrade cadence, security
							boundaries — where they belong: with you.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
						{controlPrinciples.map((principle) => (
							<div
								key={principle.title}
								className="rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<principle.icon className="h-6 w-6" />
								</div>
								<h3 className="text-lg font-semibold">{principle.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{principle.description}
								</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							From a blank server to your first deployment
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Notploy is designed to be operational in minutes, not in a
							sprint.
						</p>
					</div>
					<div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{[
							{
								number: "01",
								title: "Provision a server",
								description:
									"Any Linux VPS or machine you already own. Modest specs are enough.",
							},
							{
								number: "02",
								title: "Run the installer",
								description:
									"One command sets up Docker and the Notploy stack on the host.",
							},
							{
								number: "03",
								title: "Open the dashboard",
								description:
									"Create your admin account in the web UI and connect a server.",
							},
							{
								number: "04",
								title: "Deploy",
								description:
									"Connect a Git repository, add a domain, and ship your first application.",
							},
						].map((step) => (
							<div
								key={step.number}
								className="relative rounded-xl border border-border/50 bg-card p-6"
							>
								<div className="absolute right-6 top-6 font-display text-3xl font-bold text-primary/30">
									{step.number}
								</div>
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
									<IconRocket className="h-5 w-5" />
								</div>
								<h3 className="text-lg font-semibold">{step.title}</h3>
								<p className="mt-3 text-sm text-muted-foreground">
									{step.description}
								</p>
							</div>
						))}
					</div>
					<div className="mx-auto mt-12 max-w-2xl text-center">
						<Button variant="outline" className="rounded-full" asChild>
							<Link href="https://docs.notploy.com/docs/core" target="_blank">
								Read the documentation
							</Link>
						</Button>
					</div>
				</Container>
			</section>

			<section className="border-b border-border/30 py-20 sm:py-32">
				<Container>
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="font-display text-3xl tracking-tight sm:text-4xl">
							Notploy Self FAQs
						</h2>
					</div>
					<div className="mx-auto mt-12 w-full max-w-3xl">
						<Accordion type="single" collapsible>
							{selfFaqs.map((faq, index) => (
								<AccordionItem value={`faq-${index}`} key={faq.question}>
									<AccordionTrigger className="text-left">
										{faq.question}
									</AccordionTrigger>
									<AccordionContent>{faq.answer}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</Container>
			</section>

			<CallToAction />
		</div>
	);
}
