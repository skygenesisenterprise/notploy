"use client";

import { links } from "@/lib/content/links";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const TARGETS = [
	{
		id: "linux",
		label: "Linux",
		command: links.install.linux,
		note: "Any Linux server, VPS or homelab host with Docker.",
	},
	{
		id: "windows",
		label: "Windows Server",
		command: links.install.windows,
		note: "Windows Server 2022+ in an elevated PowerShell, running Linux containers on WSL2.",
	},
] as const;

type Target = (typeof TARGETS)[number];

export function InstallStrip() {
	const [target, setTarget] = useState<Target>(TARGETS[0]);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(target.command);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	function selectTarget(next: Target) {
		setTarget(next);
		setCopied(false);
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-2xl">
			<div className="flex flex-col items-center gap-2">
				<div className="flex items-center gap-1" role="group" aria-label="Install target">
					{TARGETS.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={option.id === target.id}
							onClick={() => selectTarget(option)}
							className={cn(
								"rounded-full px-3 py-1 text-sm transition-colors",
								option.id === target.id
									? "bg-secondary text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<div className="mx-auto mt-3 inline-flex w-fit max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-xl border border-border/60 bg-card p-2 pl-4 text-left">
				<span className="shrink-0 font-mono text-sm text-primary" aria-hidden="true">
					{target.id === "windows" ? "PS>" : "$"}
				</span>
				<code className="min-w-0 overflow-x-auto whitespace-nowrap text-left font-mono text-[13px] text-foreground">
					{target.command}
				</code>
				<button
					type="button"
					onClick={copyCommand}
					aria-label={copied ? "Command copied" : `Copy ${target.label} install command`}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					{copied ? (
						<Check className="h-4 w-4" aria-hidden="true" />
					) : (
						<Copy className="h-4 w-4" aria-hidden="true" />
					)}
				</button>
			</div>
			<span role="status" className="sr-only">
				{copied ? "Install command copied to clipboard" : ""}
			</span>

			<p className="mt-2 text-center text-sm text-muted-foreground">
				{target.note}{" "}
				<a
					href={links.docs.install}
					target="_blank"
					rel="noreferrer"
					className="underline underline-offset-4 transition-colors hover:text-foreground"
				>
					Installation guide
				</a>
			</p>
		</div>
	);
}
