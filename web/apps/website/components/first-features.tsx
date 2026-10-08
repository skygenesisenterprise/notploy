"use client";
import { cn } from "@/lib/utils";
import {
	IconActivity,
	IconCloud,
	IconDatabase,
	IconEaseInOut,
	IconRocket,
	IconTemplate,
	IconTerminal,
	IconTerminal2,
	IconUsers,
} from "@tabler/icons-react";
import { Layers, Lock, UnlockIcon } from "lucide-react";

export function FirstFeaturesSection() {
	const features = [
		{
			title: "Flexible Application Deployment",
			description:
				"Deploy any application using Nixpacks, Heroku Buildpacks, or your custom Dockerfile, tailored to your stack.",
			icon: <IconRocket />,
		},
		{
			title: "Native Docker Compose Support",
			description:
				"Deploy complex applications natively with full Docker Compose integration for seamless orchestration.",
			icon: <Layers />,
		},
		{
			title: "Multi-server Support",
			description:
				"Effortlessly deploy your applications on remote servers, with zero configuration hassle.",
			icon: <IconCloud />,
		},
		{
			title: "Advanced User Management",
			description:
				"Control user access with detailed roles and permissions, keeping your deployments secure and organized.",
			icon: <IconUsers />,
		},
		{
			title: "Databases with Scheduled Backups",
			description:
				"Provision and operate PostgreSQL, MySQL, MariaDB, MongoDB and Redis with scheduled backups, directly from Notploy.",
			icon: <IconDatabase />,
		},
		{
			title: "API, CLI & TypeScript SDK",
			description:
				"Automate operations with the Notploy API, CLI and TypeScript SDK. Everything the dashboard does is scriptable.",
			icon: <IconTerminal />,
		},
		{
			title: "Docker Swarm Clusters",
			description:
				"Scale your deployments seamlessly with built-in Docker Swarm support for robust, multi-node applications.",
			icon: <IconUsers />,
		},
		{
			title: "Open Source Templates",
			description:
				"Get started quickly with pre-configured templates for popular tools like Supabase, Cal.com, and PocketBase.",
			icon: <IconTemplate />,
		},
		{
			title: "No Vendor Lock-In",
			description:
				"Experience complete freedom to modify, scale, and customize Notploy to suit your specific needs.",
			icon: <UnlockIcon />,
		},
		{
			title: "Real-time Monitoring & Alerts",
			description:
				"Monitor CPU, memory, and network usage in real-time across your deployments for full visibility.",
			icon: <IconActivity />,
		},
		{
			title: "MCP for AI & Agents",
			description:
				"Drive Notploy from the MCP server so AI tools and agents can operate your infrastructure through a controlled interface.",
			icon: <IconTerminal2 />,
		},
		{
			title: "Self-hosted & Open Source",
			description:
				"Apache-2.0 licensed and self-hostable, designed around reusable provider adapters and one-click blueprints.",
			icon: <IconEaseInOut />,
		},
	];
	return (
		<div className="mt-20 flex flex-col items-center  justify-center px-4">
			<h2 className="text-center font-display text-3xl tracking-tight text-primary sm:text-4xl">
				Powerful Deployment Tailored to You
			</h2>
			<p className="mt-4 text-center text-lg  tracking-tight text-muted-foreground">
				Deploy applications, run Docker Compose projects, operate databases and
				scale across servers and clusters—all on infrastructure you own, with
				the flexibility of open source.
			</p>
			<div className="relative z-10 mx-auto mt-10 grid  max-w-7xl grid-cols-1 py-10 max-sm:mx-0 max-sm:w-full max-sm:p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{features.map((feature, index) => (
					<Feature key={feature.title} {...feature} index={index} />
				))}
			</div>
		</div>
	);
}

const Feature = ({
	title,
	description,
	icon,
	index,
}: {
	title: string;
	description: string;
	icon: React.ReactNode;
	index: number;
}) => {
	return (
		<div
			className={cn(
				"group/feature relative flex  flex-col border-border py-10 lg:border-r",
				(index === 0 || index === 4 || index === 8) &&
					"dark:border-border lg:border-l",
				(index < 4 || index < 8) && "dark:border-border lg:border-b",
			)}
		>
			{index < 4 && (
				<div className="pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-t from-card to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100" />
			)}
			{index >= 4 && (
				<div className="pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-b from-card to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100" />
			)}
			<div className="relative z-10 mb-4 px-10 text-muted-foreground">{icon}</div>
			<div className="relative z-10 mb-2 px-10 text-lg font-bold">
				<div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-br-full rounded-tr-full bg-muted transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-card" />
				<span className="inline-block text-foreground transition duration-200 group-hover/feature:translate-x-2">
					{title}
				</span>
			</div>
			<p className="relative z-10 px-10 text-sm text-muted-foreground lg:max-w-xs">
				{description}
			</p>
		</div>
	);
};
