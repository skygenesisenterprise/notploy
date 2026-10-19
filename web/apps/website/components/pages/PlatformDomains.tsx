"use client";

import {
	IconEye,
	IconNetwork,
	IconRocket,
	IconServer2,
	IconShieldLock,
} from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const domains = [
	{
		id: "deploy",
		icon: IconRocket,
		title: "Deploy",
		description:
			"From a Git repository or a container image to a running application, with build pipelines, environment variables and repeatable deployments.",
		items: [
			"Application deployment with Nixpacks, Buildpacks or a Dockerfile",
			"Native Docker Compose projects",
			"Databases: PostgreSQL, MySQL, MariaDB, MongoDB, Redis",
			"One-click templates for popular tools",
		],
	},
	{
		id: "infrastructure",
		icon: IconServer2,
		title: "Infrastructure",
		description:
			"Manage the machines that run your workloads — a single server or a whole fleet — without leaving the platform.",
		items: [
			"Server management, local and remote",
			"Docker as the container runtime",
			"Docker Swarm clusters for multi-node deployments",
			"Storage, volumes and S3-compatible object storage",
		],
	},
	{
		id: "networking",
		icon: IconNetwork,
		title: "Networking",
		description:
			"Traffic, naming and encryption are handled by the platform so services reach each other and the outside world safely.",
		items: [
			"Internal networking between services",
			"DNS and custom domains per application",
			"Automatic TLS certificates and renewal",
			"Load balancing across nodes",
		],
	},
	{
		id: "security",
		icon: IconShieldLock,
		title: "Security",
		description:
			"Access to infrastructure is explicit, auditable and revocable — for humans, applications and machines alike.",
		items: [
			"Secrets and encrypted environment variables",
			"Container registry credentials",
			"Role-based access control and SSO",
			"Audit logs and SSH key management",
		],
	},
	{
		id: "operations",
		icon: IconEye,
		title: "Operations",
		description:
			"Everything needed to keep applications healthy after the first deploy, from observability to automation.",
		items: [
			"Real-time monitoring: CPU, memory, network",
			"Backups and scheduled jobs",
			"REST API, CLI and TypeScript SDK",
			"Webhooks and notifications",
		],
	},
];

export function PlatformDomains() {
	const [active, setActive] = useState(0);
	const reduceMotion = useReducedMotion();
	const current = domains[active];

	return (
		<div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-2xl border border-border/50 bg-card">
			<div className="grid lg:grid-cols-[280px_1fr]">
				<div
					className="flex gap-2 overflow-x-auto border-b border-border/50 p-3 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r"
					role="tablist"
					aria-label="Platform domains"
				>
					{domains.map((domain, index) => (
						<button
							key={domain.id}
							type="button"
							role="tab"
							aria-selected={active === index}
							aria-controls={`domain-panel-${domain.id}`}
							onClick={() => setActive(index)}
							className={cn(
								"flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors lg:w-full",
								active === index
									? "bg-secondary text-foreground"
									: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
							)}
						>
							<domain.icon
								className={cn(
									"h-5 w-5 shrink-0",
									active === index ? "text-primary" : "text-muted-foreground",
								)}
								stroke={1.5}
								aria-hidden="true"
							/>
							<span className="font-medium">{domain.title}</span>
						</button>
					))}
				</div>

				<div className="relative min-h-[360px] p-6 sm:p-10">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={current.id}
							id={`domain-panel-${current.id}`}
							role="tabpanel"
							initial={reduceMotion ? false : { opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
							transition={{ duration: 0.22, ease: "easeOut" }}
						>
							<div className="flex items-center gap-3">
								<current.icon
									className="h-7 w-7 text-primary"
									stroke={1.5}
									aria-hidden="true"
								/>
								<h3 className="font-display text-2xl tracking-tight text-foreground">
									{current.title}
								</h3>
							</div>
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
								{current.description}
							</p>

							<ul className="mt-8 grid gap-3 border-t border-border/40 pt-6 sm:grid-cols-2">
								{current.items.map((item) => (
									<li
										key={item}
										className="flex gap-3 text-base leading-relaxed text-foreground"
									>
										<Check
											className="mt-1 h-4 w-4 shrink-0 text-primary"
											aria-hidden="true"
										/>
										<span>{item}</span>
									</li>
								))}
							</ul>

							<p className="mt-8 text-sm text-muted-foreground">
								Part of the same control plane as every other domain — no
								separate console, no separate credential store.
							</p>
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
