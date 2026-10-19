import { ChoicePanels, ProcessRail, SectionHeading } from "@/components/pages/PagePrimitives";
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
	Activity,
	FileText,
	RotateCcw,
	Clock,
	Eye,
	Settings2,
	Server,
	Cloud,
	Cpu,
	Network,
	Terminal,
	HardDrive,
	Lock,
	CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Application Management Software and Solutions",
	description:
		"Monitor, control, and maintain your business applications from a single dashboard with Notploy's application management software.",
};

const coreFeatures = [
	{
		icon: Activity,
		title: "Real-time monitoring",
		description:
			"Track CPU, memory, disk, and network usage for every application in your portfolio. Catch performance issues before they affect users and make informed decisions based on live data, not guesswork.",
	},
	{
		icon: FileText,
		title: "Centralized logs",
		description:
			"Access real-time logs from any running application directly in the dashboard. When something breaks, you know exactly where to look.",
	},
	{
		icon: RotateCcw,
		title: "Rollback in seconds",
		description:
			"Recover fast when a release goes wrong. Notploy supports Docker Swarm automatic rollback when health checks fail, as well as registry-based rollback to any previous deployment version when a Docker registry is configured.",
	},
	{
		icon: Clock,
		title: "Full deployment history",
		description:
			"View the last ten deployments for any application. Connect incidents to specific releases and resolve them faster, without sifting through unrelated logs.",
	},
	{
		icon: Eye,
		title: "Preview deployments",
		description:
			"Test application changes in isolated environments before they reach production. When configured, pull requests to your target branch trigger isolated preview builds automatically, so your team can validate functionality before merging.",
	},
	{
		icon: Settings2,
		title: "Environment variable management",
		description:
			"Manage shared and service-level environment variables across every application. Reduce configuration drift and keep sensitive data out of your codebase.",
	},
];

const standardizationChecks = [
	"Consistent deployment workflows across all applications",
	"Shared and service-level environment variable management",
	"Rollback capabilities built into every release",
	"Deployment history tied to specific releases",
];

const applicationStatuses = [
	{ name: "App-api", status: "Running" },
	{ name: "App-frontend", status: "Running" },
	{ name: "App-worker", status: "Deploying" },
	{ name: "App-scheduler", status: "Running" },
	{ name: "App-admin", status: "Rolled back" },
];

const controlFeatures = [
	{
		icon: Cpu,
		title: "Resource controls",
		description:
			"Set CPU and memory limits per application to optimize performance and keep resource usage predictable as your application landscape grows.",
	},
	{
		icon: Network,
		title: "Cluster and scaling settings",
		description:
			"Configure replica counts and Docker Swarm settings to scale business applications across nodes without reworking your infrastructure.",
	},
	{
		icon: Terminal,
		title: "Custom run commands",
		description:
			"Execute shell commands directly inside any container for advanced management, debugging, or operational tasks that fall outside standard workflows.",
	},
	{
		icon: HardDrive,
		title: "Volume and storage management",
		description:
			"Set up persistent storage volumes so application data survives restarts and redeployments. Support for bind mounts, volume mounts, and file mounts is built in.",
	},
	{
		icon: Lock,
		title: "Access and security controls",
		description:
			"Add basic authentication to any application and configure port exposure with precision. Keep internal systems locked down while making the right surfaces accessible.",
	},
	{
		icon: Clock,
		title: "Scheduled jobs",
		description:
			"Run cron jobs to automate recurring tasks across your application portfolio, from data workflows to maintenance scripts, without adding external tooling.",
	},
];

const selfHostedItems = [
	"Full data sovereignty over sensitive data",
	"No third-party dependencies",
	"Fits hybrid environments and on-premise infrastructure",
	"Supports digital transformation at your pace",
];

const cloudItems = [
	"Managed infrastructure, zero maintenance overhead",
	"Rapid setup for new business units and teams",
	"Scale application usage without provisioning servers",
	"Ideal for cloud migration and modernization initiatives",
];

const faqs = [
	{
		question: "What is application performance management software?",
		answer:
			"Application performance management software helps IT teams monitor application health, track resource usage, and identify performance issues before they affect users. Key features typically include real-time monitoring of CPU, memory, disk, and network usage, alongside log access and alerting. Notploy covers the operational side of application performance management: giving teams live usage data, deployment history, and rollback capabilities from a single dashboard, without requiring specialist expertise or separate tooling.",
	},
	{
		question: "What is the best application management software?",
		answer:
			"The best application management software depends on your business needs, team size, and technical expertise. Enterprise platforms often come with deep integration capabilities and reporting features, but they can require significant investment and a steeper learning curve. Notploy is built for teams that want operational efficiency without that overhead. It covers the key processes of application management, including monitoring, rollbacks, environment configuration, and scheduled jobs, in a platform you can self-host or run in the cloud so that your IT team can run on your own infrastructure if they want. It\u2019s a strong fit for organizations that want to manage business applications with full control and without vendor lock-in.",
	},
	{
		question: "What is application lifecycle management software?",
		answer:
			"Application lifecycle management (ALM) software supports the full lifecycle of a software application, from requirements and development through deployment, ongoing maintenance, and eventual retirement. It connects strategic planning and business objectives with day-to-day operational execution. Notploy focuses on the operational slice of that lifecycle\u2014standardizing how applications are deployed, monitored, rolled back, and maintained\u2014which is where most teams experience the most friction. For organizations going through digital transformation or modernization initiatives, having that operational foundation in place is what makes broader lifecycle management sustainable.",
	},
];

export default function ApplicationManagementSoftwarePage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Operations & visibility"
			title="Application management"
			highlight="that works"
			description="Monitor, control, and maintain your business applications from a single dashboard. Notploy gives your IT team the visibility and tools to keep every application running at peak performance — without the complexity."
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
					id: "everything-in-one-platform",
					title: "Everything your team needs in one platform",
					description:
						"Improving visibility into your application portfolio is the first step toward better application management. Notploy surfaces the signals your IT team needs, in real time, in one place.",
					items: coreFeatures,
					columns: 3,
				},
				{
					id: "full-portfolio-control",
					title: "Full control over your application portfolio",
					description:
						"Manage business applications at the level your business goals require, from resource allocation and scaling to security controls and workflow automation.",
					items: controlFeatures,
					columns: 3,
				},
			]}
			faqs={{
				id: "management-software-faqs",
				title: "Application management software FAQs",
				description: "Answers before you bring your portfolio into one place.",
				items: faqs,
			}}
			finalCta={{
				title: "Take control of your application landscape",
				description:
					"Notploy gives your IT team the application management software it needs to monitor, maintain, and scale business applications with confidence.",
				cta: "Create your account",
				href: "https://app.notploy.com",
				external: true,
			}}
		>
			<Container className="pb-20 sm:pb-28">
				<SectionHeading
					id="standardize-your-process"
					title="Standardize your management process"
					description="Maintain consistent environments and standardized release processes to keep operational efficiency at peak levels. When every application is managed together, your IT team maintains shared standards instead of tribal knowledge."
				/>
				<div className="mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-2">
					<ul className="space-y-4 border-t border-border/40 pt-6">
						{standardizationChecks.map((item) => (
							<li key={item} className="flex items-start gap-3">
								<CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
								<span className="text-base leading-relaxed text-muted-foreground">
									{item}
								</span>
							</li>
						))}
					</ul>
					<div className="rounded-2xl border border-border/50 bg-card p-6">
						<p className="text-sm text-muted-foreground">
							A portfolio view, at a glance
						</p>
						<div className="mt-4 space-y-3">
							{applicationStatuses.map((app) => (
								<div
									key={app.name}
									className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3"
								>
									<span className="text-sm font-medium text-foreground">
										{app.name}
									</span>
									<span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
										{app.status}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</Container>

			<ChoicePanels
				id="run-where-needed"
				title="Run Notploy where your business needs it"
				description="Deploy Notploy on your own infrastructure or ours. Both options give you the same application management capabilities, and you choose what fits your operational model and regulatory compliance requirements."
				panels={[
					{
						name: "Self-hosted",
						tagline: "Your infrastructure, your rules",
						description:
							"Run the platform on servers you control, with data, secrets and backups kept inside your boundary.",
						bullets: selfHostedItems,
						cta: "Explore Self",
						href: "/self",
					},
					{
						name: "Notploy Cloud",
						tagline: "Managed for you",
						description:
							"Let Notploy run the control plane while your applications keep running on your own servers.",
						bullets: cloudItems,
						cta: "Explore Cloud",
						href: "/cloud",
						highlighted: true,
					},
				]}
			/>

			<ProcessRail
				id="deploy-ai-safely"
				title="Deploy AI in a controlled environment"
				description="Use Notploy to create sandbox environments separated from production infrastructure, where technical and non-technical employees can launch AI-coded apps safely."
				steps={[
					{
						title: "Set up in minutes",
						description:
							"Create a sandboxed environment on your own infrastructure with a single command. Configure access controls, connect your Git repo, and your team is ready to deploy.",
						label: "Sandbox",
					},
					{
						title: "Deploy from any source",
						description:
							"Once Notploy is set up, team members can take AI-coded apps from a Git repo, Docker image, or Compose file to a running environment without engineering support.",
						label: "Deploy",
					},
					{
						title: "Monitor and recover fast",
						description:
							"Real-time metrics, centralized logs, RBAC, and quick rollback give your team full visibility and control over every AI-built app.",
						label: "Operate",
					},
				]}
			/>
		</FeaturePageTemplate>
	);
}
