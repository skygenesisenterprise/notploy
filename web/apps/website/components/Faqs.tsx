import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "./Container";

const faqs = [
	{
		question: "What is Notploy?",
		answer:
			"Notploy is an open-source infrastructure platform. It gives you one control plane to deploy applications, databases and Docker Compose projects, manage servers and clusters, and handle routing, certificates, backups and monitoring — on infrastructure you own.",
	},
	{
		question: "What is the difference between Notploy Self and Notploy Cloud?",
		answer:
			"Notploy Self is the free, Apache-2.0 licensed edition you install and operate yourself. Notploy Cloud is the managed service operated by Notploy: the control plane is hosted, upgraded and supported for you. Both run the same platform capabilities.",
	},
	{
		question: "Is Notploy free?",
		answer:
			"Yes. Notploy Self is free and open source under Apache-2.0 — no platform fees and no per-seat charges, you pay only for your infrastructure. Notploy Cloud is a paid managed service, and a commercial Enterprise edition adds premium features and support.",
	},
	{
		question: "Do I need Kubernetes?",
		answer:
			"No. Notploy is built on Docker with Docker Swarm for clustering and Traefik for routing and certificates. You get multi-node deployments and load balancing without operating a Kubernetes stack.",
	},
	{
		question: "What do I need to run Notploy?",
		answer:
			"Any Linux server with Docker — a small VPS, bare metal, a homelab machine or a server from your existing provider. The installer sets up the rest, and remote servers are added later over SSH.",
	},
	{
		question: "What can I deploy with Notploy?",
		answer:
			"Applications built with Nixpacks, Buildpacks, Railpack or your own Dockerfile — sourced from GitHub, GitLab, Gitea or Bitbucket — Docker Compose stacks, databases (PostgreSQL, MySQL, MariaDB, MongoDB, Redis) and ready-made templates.",
	},
	{
		question: "Will I get locked in?",
		answer:
			"No. The platform is open source, uses standard technologies (Docker, Compose, Traefik) and exposes a full API and CLI. Your data lives on your infrastructure, and your workloads can be migrated away at any time.",
	},
	{
		question: "Who is Notploy for?",
		answer:
			"Individual developers and self-hosters, small teams, infrastructure and platform teams, companies, public-sector organizations and hosting providers — anyone who wants a simple deployment workflow without giving up control of the infrastructure.",
	},
	{
		question: "How do I automate deployments?",
		answer:
			"Everything the dashboard does is available through the REST API, CLI, TypeScript SDK and MCP server, plus webhooks and CI/CD triggers — so Notploy fits into your pipelines instead of replacing them.",
	},
	{
		question: "How do I get started?",
		answer:
			"Install Notploy Self with one command from the Self page, or create a Notploy Cloud account to start without provisioning anything. The documentation walks you through your first deployment step by step.",
	},
];

export function Faqs() {
	return (
		<section
			id="faqs"
			aria-labelledby="faq-title"
			className="relative overflow-hidden bg-background py-20 sm:py-32"
		>
			<Container className="relative flex flex-col gap-10">
				<div className="mx-auto w-full justify-center lg:mx-0">
					<h2
						id="faq-title"
						className="text-center font-display text-3xl tracking-tight text-primary sm:text-4xl"
					>
						Frequently asked questions
					</h2>
					<p className="mt-4 text-center text-lg tracking-tight text-muted-foreground">
						If you can't find what you're looking for, please submit an issue
						through our GitHub repository or ask questions on our Discord.
					</p>
				</div>

				<Accordion
					type="single"
					collapsible
					className="mx-auto  w-full max-w-3xl"
				>
					{faqs.map((faq, columnIndex) => (
						<AccordionItem value={`${columnIndex}`} key={columnIndex}>
							<AccordionTrigger className="text-left">
								{faq.question}
							</AccordionTrigger>
							<AccordionContent>{faq.answer}</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</Container>
		</section>
	);
}
