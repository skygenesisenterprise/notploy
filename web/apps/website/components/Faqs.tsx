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
			"Notploy is an open-source, self-hostable platform for deploying and operating applications. It provides a web control plane for application and database deployments, Docker Compose projects, servers and clusters.",
	},
	{
		question: "Is Notploy free?",
		answer:
			"Yes. The core platform is open source under the Apache-2.0 license and the self-hosted edition is free to run. A commercial edition with additional features and premium support is maintained by Sky Genesis Enterprise.",
	},
	{
		question: "Do I have to host it myself?",
		answer:
			"No. You can self-host Notploy with Docker Compose or the installer, or use the hosted Notploy Cloud at app.notploy.com if you would rather not manage the control plane.",
	},
	{
		question: "What do I need to run Notploy?",
		answer:
			"Node.js 24.4+ and pnpm 10.22+ for development, or just Docker Engine with the Compose plugin for the containerized stack. The application needs a PostgreSQL database and a configured .env file.",
	},
	{
		question: "What can I deploy with Notploy?",
		answer:
			"Deploy applications from Git providers or container images using Docker, Nixpacks, Railpack or buildpacks, and run Docker Compose projects with their services, configuration, logs and deployments.",
	},
	{
		question: "Does Notploy manage databases?",
		answer:
			"Yes. Notploy provisions and operates PostgreSQL, MySQL, MariaDB, MongoDB and Redis databases with scheduled backups, without wiring up separate tooling.",
	},
	{
		question: "Where can I deploy?",
		answer:
			"Deploy to the local server, independent remote servers over SSH, or a Docker Swarm cluster. Notploy routes traffic through Traefik with managed domains and certificates.",
	},
	{
		question: "How do I automate deployments?",
		answer:
			"Automate operations with the Notploy API, CLI, TypeScript SDK or MCP server, so deployments fit into existing pipelines instead of replacing them.",
	},
	{
		question: "Where are the templates?",
		answer:
			"Browse one-click application blueprints in the Notploy Templates gallery at templates.notploy.com, and deploy them directly from your instance.",
	},
	{
		question: "How do I get help or report a bug?",
		answer:
			"Join the Notploy Discord for questions, or open a GitHub issue for bugs and feature requests. Never report a security vulnerability in a public issue — follow the instructions in SECURITY.md instead.",
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
