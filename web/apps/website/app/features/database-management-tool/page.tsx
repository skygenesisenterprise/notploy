import { ProductFrame } from "@/components/pages/PagePrimitives";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import { CallToAction } from "@/components/CallToAction";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
	Database,
	Activity,
	Shield,
	Archive,
	FileText,
	RotateCcw,
	Link2,
	Container as ContainerIcon,
	Terminal,
	HardDrive,
	Cpu,
	Keyboard,
	AlertTriangle,
	Lock,
	KeyRound,
	ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Database Management Tool & Deployment Software",
	description:
		"Create, manage, and back up databases easily with Notploy's database management tool, and customize the process to suit your project needs.",
};

const databaseSystems = [
	{
		icon: Database,
		title: "PostgreSQL",
		description:
			"A robust, SQL-compliant relational database with high reliability\u2014a solid choice for production workloads that handle structured and transactional data and demand consistency and standards compliance.",
	},
	{
		icon: Database,
		title: "MySQL",
		description:
			"A widely used open source relational database known for its high performance and flexibility, with broad ecosystem support across frameworks and hosting environments.",
	},
	{
		icon: Database,
		title: "MariaDB",
		description:
			"A free and open source fork of MySQL with additional features and improved performance, maintained by an active community and great for MySQL applications.",
	},
	{
		icon: Database,
		title: "MongoDB",
		description:
			"A NoSQL database built for high scalability and flexibility, well-suited to applications with unstructured or semi-structured data and evolving data sources.",
	},
	{
		icon: Database,
		title: "Redis",
		description:
			"An in-memory key-value store often used as a database, cache, and message broker\u2014fast by design and easy to integrate for high-performance operations.",
	},
];

const protectionFeatures = [
	{
		icon: Archive,
		title: "Backups",
		description:
			"Schedule automated backups for any database and route them directly to an S3 bucket of your choice. Set a cron schedule, define a prefix, and test your configuration before relying on it so you know your stored data is secure before you ever need to recover it.",
	},
	{
		icon: FileText,
		title: "Logs",
		description:
			"View real-time logs from any running database directly in your Notploy dashboard. Spot errors as they happen, trace unexpected behavior back to its source, and keep a clear record of what\u2019s happening inside your containers.",
	},
	{
		icon: RotateCcw,
		title: "Restore",
		description:
			"Restore any database from a backup stored in your S3 bucket in a few clicks\u2014critical for disaster recovery when you need to act fast. Select the source bucket, search for your backup file with autocomplete, and kick off the restoration process\u2014Notploy handles the correct restore commands automatically.",
	},
	{
		icon: Link2,
		title: "Connections",
		description:
			"Connect to databases internally within your network or expose them externally via a generated connection URL. Use internal credentials for applications running in the same environment, and configure external access only when needed, with security controls in place to protect sensitive data.",
	},
];

const advancedOptions = [
	{
		icon: ContainerIcon,
		title: "Custom Docker Image",
		description:
			"Swap out the default Docker image for any database with one that fits your exact requirements and database development workflow.",
	},
	{
		icon: Terminal,
		title: "Run Command",
		description:
			"Execute custom commands directly inside the container for advanced management, complex queries, or troubleshooting.",
	},
	{
		icon: HardDrive,
		title: "Volumes",
		description:
			"Configure persistent storage volumes to make sure your data survives deployments and restarts.",
	},
	{
		icon: Cpu,
		title: "Resources",
		description:
			"Adjust CPU and memory allocation per database to optimize database performance and keep resource usage predictable as your infrastructure grows.",
	},
	{
		icon: Keyboard,
		title: "Keyboard Shortcuts",
		description:
			"Navigate between database tabs instantly with built-in keyboard shortcuts, keeping your workflow fast.",
	},
	{
		icon: AlertTriangle,
		title: "Danger Zone",
		description:
			"When you need a clean slate, the Danger Zone lets you wipe all data, tables, and configuration in one controlled action.",
	},
];

const securityFeatures = [
	{
		icon: Lock,
		title: "Your server, your data",
		description:
			"Notploy creates Docker containers on your own server. Your database data never leaves your infrastructure\u2014you have full ownership and control over where it lives.",
	},
	{
		icon: KeyRound,
		title: "Isolated containers",
		description:
			"Each database runs in its own Docker container, isolated from other services. You control networking, access, and exposure\u2014nothing is shared unless you configure it.",
	},
	{
		icon: ShieldCheck,
		title: "No third-party access",
		description:
			"Notploy doesn\u2019t store or proxy your data. Everything runs on your machine, so there\u2019s no middleman between your applications and your databases.",
	},
];

const faqs = [
	{
		question: "What are the key features of database management tools?",
		answer:
			"The best database management tools let you deploy, monitor, and optimize performance across multiple database systems from a single interface. Core capabilities typically include automated backups, connection management, resource controls, and the ability to track database changes over time. Support for custom functions, environment variables, and data privacy controls are also important\u2014especially for teams managing sensitive workloads in production.",
	},
	{
		question: "What is the best database management tool?",
		answer:
			"There\u2019s no single best tool. The right choice depends on your specific use cases, team size, and infrastructure. Some tools require expertise to configure and come with a steeper learning curve, which can slow teams down. Notploy is designed to remove that friction and improve database performance, offering a secure, scalable solution that covers deployment, monitoring, backups, and data privacy without requiring specialist knowledge. It won\u2019t replace dedicated analysis or AI assistant tooling, but it gives developers a reliable foundation for managing databases in production.",
	},
	{
		question: "What database systems does Notploy support?",
		answer:
			"Notploy supports five widely used database tools: PostgreSQL, MySQL, MariaDB, MongoDB, and Redis. That covers the most common SQL server databases and NoSQL use cases, from relational workloads that rely on structured query language to flexible document and key-value stores. All five\u2014both SQL databases and noSQL systems\u2014can be deployed, backed up, and monitored using the same tools and workflows inside Notploy.",
	},
];

export default function DatabaseManagementToolPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Databases & backups"
			title="Database management,"
			highlight="done right"
			description="Create, manage, and back up databases easily with Notploy's database tool, and customize the process to suit your project needs. Deploy in minutes, maintain full control over your stored data, and recover fast when it matters."
			actions={
				<>
					<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
						<Link href="https://app.notploy.com/register" target="_blank">
							Get Started
						</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full rounded-full px-6 sm:w-auto"
						asChild
					>
						<Link href="/contact">Contact Us</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/platform", label: "Platform overview" },
				{ href: "/features/container-server-monitoring", label: "Monitoring" },
				{ href: "/pricing", label: "Pricing" },
			]}
			sections={[
				{
					id: "deploy-your-database",
					title: "Deploy the database you already use",
					description:
						"Notploy's database management tool supports five widely used database systems out of the box, so you're not locked into a single technology. You pick what fits your stack and your data management needs.",
					items: databaseSystems,
					columns: 3,
				},
				{
					id: "protect-recover-connect",
					title: "Protect, recover, and connect with confidence",
					description:
						"Automated backups, transparent logs, straightforward restores, and flexible connection options. Everything you need to manage a database reliably, all in one place.",
					items: protectionFeatures,
					columns: 2,
					layout: "split",
				},
				{
					id: "advanced-options",
					title: "Advanced options, your way",
					description:
						"Notploy goes beyond the basics, giving you granular control over how each database runs, from the image it uses to the resources it consumes and everything in between.",
					items: advancedOptions,
					columns: 3,
				},
				{
					id: "data-stays-secure",
					title: "Your data stays secure",
					description:
						"Your database data is stored on your own server. Notploy creates Docker containers on your infrastructure, so you have full control over your data — no third parties, no external dependencies.",
					items: securityFeatures,
					columns: 3,
				},
			]}
			faqs={{
				id: "database-faqs",
				title: "Database management tool FAQs",
				description: "Answers before you start managing databases with Notploy.",
				items: faqs,
			}}
			finalCta={{
				title: "Start managing databases smarter",
				description:
					"Notploy gives you everything you need to deploy, monitor, and protect your databases — without the complexity.",
				cta: "Create your account",
				href: "https://app.notploy.com",
				external: true,
			}}
		>
			<Container className="pb-20 sm:pb-28">
				<ProductFrame
					src="/backups.png"
					alt="Notploy backup configuration for a managed database"
					path="app.notploy.com/databases/backups"
					caption="Provision, monitor and back up databases from the same control plane."
				/>
			</Container>

			<section className="pb-20 sm:pb-28">
				<Container>
					<div className="mx-auto max-w-5xl rounded-2xl border border-border/50 bg-card p-8 sm:p-10">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="font-display text-2xl tracking-tight text-foreground">
									Watch your databases in real time
								</h2>
								<p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
									Notploy surfaces live monitoring graphs for memory, CPU,
									disk, and network directly in the dashboard. The data
									updates as you view it, so you can see exactly what your
									database is doing and catch problems before they become
									incidents.
								</p>
							</div>
							<Button variant="outline" className="shrink-0 rounded-full" asChild>
								<Link href="/features/container-server-monitoring">
									See monitoring
								</Link>
							</Button>
						</div>
					</div>
				</Container>
			</section>
		</FeaturePageTemplate>
	);
}
