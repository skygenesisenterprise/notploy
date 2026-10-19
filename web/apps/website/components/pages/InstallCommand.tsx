"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function InstallCommand({
	command,
	note,
	className,
}: {
	command: string;
	note?: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className={cn("mx-auto w-full max-w-xl", className)}>
			<div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 pl-4">
				<span className="text-sm text-primary" aria-hidden="true">
					$
				</span>
				<code className="min-w-0 flex-1 truncate text-left font-mono text-[13px] text-foreground">
					{command}
				</code>
				<button
					type="button"
					onClick={copyCommand}
					aria-label={copied ? "Install command copied" : "Copy install command"}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					{copied ? (
						<Check className="h-4 w-4" aria-hidden="true" />
					) : (
						<Copy className="h-4 w-4" aria-hidden="true" />
					)}
				</button>
			</div>
			{note && (
				<p className="mt-2 text-sm text-muted-foreground">{note}</p>
			)}
		</div>
	);
}
