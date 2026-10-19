import { Button } from "@/components/ui/button";
import {
	Wallet,
	Unlock,
	Lock,
	Settings2,
	KeyRound,
	ScrollText,
	Shield,
	LifeBuoy,
	ServerCog,
	TerminalSquare,
	MonitorSmartphone,
	GitBranch,
	CheckCircle2,
	Cloud,
	Server,
	Bot,
	Cpu,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/Container";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { ChoicePanels } from "@/components/pages/PagePrimitives";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "The Self-Hosted PaaS Built for Developers",
	description:
		"Start using Notploy, the free, open source PaaS that enables developers to deploy apps and databases on their own infrastructure.",
	alternates: {
		canonical: "https://notploy.com/self-hosted-paas",
	},
};

const controlFeatures = [
	{
		icon: Wallet,
		title: "Save on infrastructure costs",
		description:
			"Run Notploy on any VPS or bare metal server you already own. No per-seat fees, no per-deployment charges—just your underlying infrastructure costs.",
	},
	{
		icon: Unlock,
		title: "Eliminate vendor lock-in",
		description:
			"Your apps, your servers, your data. A self-hosted PaaS gives you full control over where workloads run and makes it straightforward to migrate if your needs change.",
	},
	{
		icon: Lock,
		title: "Keep sensitive data on your own servers",
		description:
			"For teams with compliance requirements or strict data residency rules, self-hosting means your code and databases never leave your own infrastructure.",
	},
	{
		icon: Settings2,
		title: "Customize to your exact requirements",
		description:
			"SSH access, custom Docker images, environment variables, resource limits, and container orchestration settings—all configurable without waiting on a cloud provider.",
	},
	{
		icon: Bot,
		title: "Run your AI tools in-house",
		description:
			"Your AI tools run on your own server, so code, prompts, and outputs never leave your infrastructure. Create sandboxes where your team can deploy vibe-coded tools safely.",
	},
	{
		icon: Cpu,
		title: "Choose and switch your AI models",
		description:
			"You can run any open source model you want and swap it out without changing your stack, avoiding being tied to a single AI provider's pricing or availability.",
	},
];

const enterpriseFeatures = [
	{
		icon: KeyRound,
		title: "SSO / SAML",
		description:
			"Integrate with enterprise identity providers like Okta and Azure AD for centralized, secure access control across your organization.",
	},
	{
		icon: ScrollText,
		title: "Audit Logs",
		description:
			"Comprehensive tracking of all system activities—deployments, config changes, and access events—for compliance and accountability.",
	},
	{
		icon: Shield,
		title: "Fine-Grained RBAC",
		description:
			"Granular role-based access controls with custom roles, so the right people have the right permissions at every level.",
	},
	{
		icon: LifeBuoy,
		title: "Priority Support and SLAs",
		description:
			"Dedicated support with guaranteed response times and service level agreements, so mission-critical deployments stay running.",
	},
];

const setupSteps = [
	{
		number: "01",
		icon: ServerCog,
		title: "Provision a server",
		description:
			"Spin up any Linux VPS from a cloud provider of your choice, or use hardware you already own. Notploy has minimal overhead and runs comfortably on modest specs.",
	},
	{
		number: "02",
		icon: TerminalSquare,
		title: "Run one install command",
		description:
			"Install Notploy with a single command. Docker is the only prerequisite, the installer handles the rest in just a few commands.",
	},
	{
		number: "03",
		icon: MonitorSmartphone,
		title: "Open the web UI",
		description:
			"Once installed, open the Notploy web UI in your browser, create your admin account, and you're in. No complex cluster setup, no Kubernetes complexity.",
	},
	{
		number: "04",
		icon: GitBranch,
		title: "Connect your code and deploy",
		description:
			"Connect a Git repo or container registry, configure your environment variables, add a database, attach a domain, and deploy. The whole process takes minutes.",
	},
];

const selfHostedBullets = [
	"Free to install and run, with no platform fees",
	"Full control over the underlying infrastructure",
	"SSH access and unrestricted server management",
	"Fits air-gapped, on-premise, or hybrid environments",
	"Deploy on any cloud provider or your own hardware",
];

const cloudBullets = [
	"Managed uptime for the control plane",
	"Automatic updates—always on the latest version",
	"Direct email, chat, and priority support",
	"Rapid setup with no server provisioning required",
	"Plans from $4.50/mo per server",
];

const faqs = [
	{
		question: "What is a self-hosted PaaS?",
		answer: (
			<>
				<p>
					A self-hosted PaaS is a platform as a service that you run on your own
					infrastructure rather than using a managed cloud service. It gives
					developers the same deployment experience—Git-based deploys,
					environment variable management, built-in Docker support, load
					balancing, and database management—but without handing control to a
					third-party cloud provider.
				</p>
				<p className="mt-3">
					Notploy is an open source PaaS you can install on any server with a
					single command.
				</p>
			</>
		),
	},
	{
		question: "What is the best open source PaaS?",
		answer: (
			<>
				<p>
					The best open source PaaS depends on your team size, technical
					requirements, and how much infrastructure management you want to take
					on.
				</p>
				<p className="mt-3">
					Notploy is a strong open source PaaS alternative to Heroku and similar
					hosted platforms. It supports application deployment, Docker Compose,
					MySQL and other databases, Heroku Buildpacks, multi-server management,
					and enterprise features like SSO and audit logs.
				</p>
				<p className="mt-3">
					It&apos;s free to self-host, actively maintained, and designed to keep
					ops overhead minimal.
				</p>
			</>
		),
	},
	{
		question: "Is Notploy really free to self-host?",
		answer: (
			<p>
				Yes. The open source version of Notploy is free to install and run on
				your own servers. You pay only for the infrastructure you provision,
				meaning no per-seat or per-deployment fees. Notploy Cloud plans start at
				$4.50 per server per month if you prefer managed uptime.
			</p>
		),
	},
	{
		question: "What's the difference between Notploy Cloud and self-hosted?",
		answer: (
			<p>
				Both versions are functionally identical. Every feature available in
				self-hosted is also available in Cloud, and vice versa. The difference
				is purely operational: with self-hosted, you manage the Notploy instance
				itself, including updates and uptime. With Cloud, Notploy manages the
				control plane for you. Your applications always run on your own servers
				in both cases.
			</p>
		),
	},
	{
		question: "Does Notploy support multi-tenancy?",
		answer: (
			<p>
				Yes. Notploy includes multi-tenancy support via organizations and
				projects, with role-based access controls that let you manage
				permissions across teams. Enterprise plans include fine-grained RBAC and
				custom roles for more complex access requirements.
			</p>
		),
	},
	{
		question: "What infrastructure does Notploy support?",
		answer: (
			<p>
				Notploy runs on any Linux server—a VPS from any cloud provider, bare
				metal, or even a Raspberry Pi for testing. It uses Docker Swarm for
				container orchestration and Traefik as a reverse proxy, so you get load
				balancing, SSL, and routing out of the box without managing those layers
				yourself.
			</p>
		),
	},
];

export default function SelfHostedPaasPage() {
	return (
		<FeaturePageTemplate
			badge="Self-hosted PaaS"
			badgeDetail="Free & open source"
			title="Your own PaaS,"
			highlight="on your own servers"
			description="Install Notploy on any Linux server in minutes. Git-based deploys, databases and Docker, with full control and none of the Kubernetes complexity."
			actions={
				<>
					<Button className="rounded-full" asChild>
						<Link
							href="https://app.notploy.com/register"
							target="_blank"
							rel="noreferrer"
						>
							Get started
						</Link>
					</Button>
					<Button variant="outline" className="rounded-full" asChild>
						<Link href="/contact">Contact us</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/self", label: "Notploy Self" },
				{ href: "/cloud", label: "Notploy Cloud" },
				{ href: "/comparison", label: "Compare editions" },
			]}
			sections={[
				{
					id: "full-control",
					title: "Full control over your platform",
					description:
						"Self-hosting a PaaS means you decide where your infrastructure lives, how resources are allocated, and who has access.",
					items: controlFeatures,
					columns: 3,
				},
				{
					id: "enterprise",
					title: "Self-hosted for larger teams",
					description:
						"Notploy Enterprise adds the security, compliance and support features larger organisations require, on-premises or in your own cloud.",
					items: enterpriseFeatures,
					columns: 2,
					callout: {
						title: "Security and compliance, on your infrastructure",
						description:
							"SSO/SAML, audit logs, fine-grained RBAC and guaranteed response times.",
						cta: "Learn about Notploy Enterprise",
						href: "/enterprise",
					},
				},
				{
					id: "setup",
					title: "From blank server to running platform",
					description:
						"Notploy is designed for minimal overhead. Docker is the only prerequisite, and the installer handles the rest.",
					items: setupSteps,
					columns: 2,
				},
			]}
			faqs={{
				id: "self-hosted-faqs",
				title: "Self-hosted PaaS FAQs",
				description: "What to know before you install.",
				items: faqs,
			}}
			finalCta={{
				title: "Your own PaaS, up and running today",
				description:
					"Notploy is free to self-host and takes just a few commands to install. Follow the setup guide and deploy on your own infrastructure in minutes.",
				cta: "Create your account",
				href: "https://app.notploy.com/register",
				external: true,
			}}
		>
			<ChoicePanels
				id="cloud-or-self-hosted"
				title="Cloud or self-hosted?"
				description="Both run the same deployment engine. The choice comes down to how much you want to manage yourself."
				panels={[
					{
						name: "Self-hosted",
						tagline: "Free, on your servers",
						description:
							"Choose self-hosted for zero platform cost, full control, or air-gapped and private networks.",
						bullets: selfHostedBullets,
						cta: "Install Notploy",
						href: "https://docs.notploy.com/docs/core",
						external: true,
					},
					{
						name: "Notploy Cloud",
						tagline: "Managed control plane",
						description:
							"Choose Cloud if you would rather not maintain the Notploy instance itself. Your apps still run on your own servers.",
						bullets: cloudBullets,
						cta: "Explore Cloud",
						href: "/cloud",
						highlighted: true,
					},
				]}
			/>
		</FeaturePageTemplate>
	);
}
