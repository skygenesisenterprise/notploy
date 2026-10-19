import { ChoicePanels, ProductFrame } from "@/components/pages/PagePrimitives";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	Cpu,
	MemoryStick,
	HardDrive,
	Network,
	Bell,
	Settings,
	Server,
	Shield,
	Database,
	LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Server & Container Monitoring | Network, CPU, Memory Monitoring Tool",
	description:
		"Keep systems running with server and container monitoring: real-time network monitoring, memory monitoring, and CPU monitoring, as well as alerts.",
};

const monitoringFeatures = [
	{
		icon: Cpu,
		title: "CPU monitoring",
		description:
			"Spot CPU saturation early so you can scale, tune, or fix hot paths before performance drops.",
	},
	{
		icon: MemoryStick,
		title: "Memory monitoring",
		description:
			"Prevent out-of-memory crashes by watching RAM pressure and acting before the system starts killing processes.",
	},
	{
		icon: HardDrive,
		title: "Disk space monitoring",
		description:
			"Avoid failed writes and broken deployments by recognizing low disk space before your used storage space hits 100%.",
	},
	{
		icon: Network,
		title: "Network monitoring",
		description:
			"Detect bandwidth congestion or unexpected traffic spikes early to prevent slowdowns and outages before they impact your services.",
	},
];

const alertFeatures = [
	{
		icon: Bell,
		title: "Threshold-based alerts",
		description:
			"Set the CPU or memory usage percentage limit that you want to trigger an alert.",
	},
	{
		icon: LayoutDashboard,
		title: "Notifications on your platforms",
		description:
			"Receive notifications on the communication platforms you use.",
	},
	{
		icon: Settings,
		title: "Easy alert management",
		description:
			"Disable alerts by just setting your limits to zero.",
	},
];

const configFeatures = [
	{
		icon: Settings,
		title: "Set your refresh rates",
		description:
			"Determine how frequently server and container metrics are collected—the default is every 20 seconds.",
	},
	{
		icon: Database,
		title: "Manage how long data is stored",
		description:
			"Decide on your retention period and an automated cron job will clean old metrics. Choose which port the Notploy metrics server listens on—the default is 4500.",
	},
	{
		icon: Server,
		title: "Include or exclude specific services",
		description:
			"Choose the services you want to monitor, whether that's all services, specific compose services, applications, or something else.",
	},
	{
		icon: Shield,
		title: "Secure your data with a token",
		description:
			"Secure metrics access with an authentication token. Use the auto-generated metrics token or generate a new one.",
	},
];

const relatedFeatures = [
	{
		icon: Server,
		title: "Application Deployment",
		description:
			"Deploy applications with zero downtime to any server you control.",
		href: "/features/application-deployment-platform",
	},
	{
		icon: Database,
		title: "Database Management",
		description:
			"Provision, manage, and back up databases without leaving Notploy.",
		href: "/features/database-management-tool",
	},
	{
		icon: Shield,
		title: "RBAC",
		description:
			"Control who can access monitoring dashboards and alerts with fine-grained role-based access control.",
		href: "/features/role-based-access-control",
	},
];

const faqs = [
	{
		question: "What are the benefits of container monitoring?",
		answer:
			"Effective container monitoring gives you end-to-end visibility across multiple containers and containerized applications—something that's hard to achieve with conventional monitoring built for static hosts. It helps you correlate logs and metrics to spot abnormal container behavior, reduce error rates, and pinpoint root causes when container issues like restarts or a container shutdown event occur. Container monitoring also supports cost optimization by showing real resource consumption, improving resource allocation, and right-sizing resource limits to control monitoring costs and infrastructure spend.",
	},
	{
		question: "What is container monitoring software?",
		answer:
			"Container monitoring software automatically discovers running containers, collects container data from the container runtime and other data sources, and turns it into dashboards, alerts, and observability data. In cloud-native environments, it typically unifies collected metrics, log data, and sometimes traces into a single-pane view so you can monitor Docker containers and Kubernetes workloads side-by-side.",
	},
	{
		question: "How does container monitoring work?",
		answer:
			"Most container monitoring tools run an agent or exporter that can collect data from individual containers and nodes, capturing performance metrics like CPU usage, memory usage, network, and events such as container restarts. They ingest container logs and other telemetry, store it as historical data, and let you view data in charts and alerts while you correlate metrics and events across services.",
	},
	{
		question: "What is the best server monitoring software?",
		answer:
			"The best server monitoring software depends on what you need to monitor and whether you want open-source control or a managed SaaS. If you're using Notploy, you get real-time server monitoring as part of your solution on all plans—with no additional setup required once your server is deployed.",
	},
];

export default function ContainerServerMonitoringPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Observability"
			title="Real-time monitoring"
			highlight="and alerts"
			description="Monitor your server, CPU, memory, and network usage in real time across all your deployments — with the dashboard and alerts already built into the platform."
			actions={
				<>
					<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
						<Link href="/contact">Contact sales</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full rounded-full px-6 sm:w-auto"
						asChild
					>
						<Link href="https://docs.notploy.com/docs/core" target="_blank">
							View documentation
						</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/platform", label: "Platform overview" },
				{ href: "/features/application-management-software", label: "Application management" },
				{ href: "/pricing", label: "Pricing" },
			]}
			sections={[
				{
					id: "continuous-operation",
					title: "Ensure continuous operation with monitoring",
					description:
						"Prevent disruption by setting up a monitoring dashboard and custom alerts.",
					items: monitoringFeatures,
					columns: 2,
					layout: "split",
				},
				{
					id: "configure-alerts",
					title: "Configure alerts so you never miss an issue",
					description:
						"Set thresholds, receive notifications where you work, and stay in control of your infrastructure at all times.",
					items: alertFeatures,
					columns: 3,
				},
				{
					id: "configuration-options",
					title: "Multiple configuration options",
					description:
						"Set up your Notploy dashboard to suit your needs with different configuration options.",
					items: configFeatures,
					columns: 2,
					layout: "split",
				},
			]}
			related={{
				id: "monitoring-tool",
				title: "Container and server monitoring tool",
				description:
					"Take advantage of Notploy's comprehensive container and server monitoring software alongside the rest of the platform.",
				items: relatedFeatures,
				columns: 3,
			}}
			faqs={{
				id: "monitoring-faqs",
				title: "Container and server monitoring FAQs",
				description: "The questions teams ask before switching on alerts.",
				items: faqs,
			}}
			finalCta={{
				title: "Ready to keep your systems running?",
				description:
					"Get real-time visibility into your servers and containers with Notploy's built-in monitoring.",
				cta: "Contact sales",
				href: "/contact",
			}}
		>
			<Container className="py-20 sm:py-28">
				<div className="mx-auto max-w-3xl rounded-2xl border border-border/50 bg-card p-8 text-center">
					<h2 className="font-display text-2xl tracking-tight text-foreground">
						Monitoring is already on
					</h2>
					<p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
						Use Notploy's container monitoring dashboard as soon as you have
						completed the server deployment setup.
					</p>
					<p className="mt-6 rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
						Remote servers → Select your server → Setup Server
					</p>
					<p className="mt-3 text-sm text-muted-foreground">
						If all your checkmarks are green, you're good to go.
					</p>
				</div>
			</Container>

			<Container className="pb-20 sm:pb-28">
				<ProductFrame
					src="/primary/monitoring.png"
					alt="Notploy monitoring dashboard with CPU, memory and network metrics"
					path="app.notploy.com/monitoring"
					caption="Metrics update as you watch them — no separate monitoring stack to install."
				/>
			</Container>

			<ChoicePanels
				id="host-where-needed"
				title="Host Notploy where your business needs it"
				description="Choose a deployment option that suits your business — on your infrastructure or ours."
				panels={[
					{
						name: "On-Premise Deployment",
						tagline: "Your infrastructure",
						description:
							"Keep monitoring data and application telemetry inside your own network.",
						bullets: [
							"Complete data sovereignty",
							"Maximum security control",
							"Compliance with strict regulations",
							"No external dependencies",
						],
						cta: "Explore Self",
						href: "/self",
					},
					{
						name: "Cloud Deployment",
						tagline: "Managed control plane",
						description:
							"Let Notploy operate the dashboard while your workloads run on your servers.",
						bullets: [
							"Rapid scaling capabilities",
							"Reduced infrastructure overhead",
							"Global availability",
							"Managed infrastructure",
						],
						cta: "Explore Cloud",
						href: "/cloud",
						highlighted: true,
					},
				]}
			/>
		</FeaturePageTemplate>
	);
}
