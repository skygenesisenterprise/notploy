"use client";

import {
	AlertTriangle,
	Check,
	Copy,
	ExternalLink,
	Globe2,
	Loader2,
	LockKeyhole,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/utils/api";

const STATUS_LABEL: Record<string, string> = {
	active: "Live",
	pending: "Provisioning",
	error: "Provisioning failed",
	released: "Released",
	unavailable: "Unavailable",
};

const STATUS_VARIANT: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	active: "secondary",
	pending: "outline",
	error: "destructive",
	released: "outline",
	unavailable: "outline",
};

/**
 * Notploy Cloud generated hostname (issue #113).
 *
 * Rendered above the custom-domain list: the generated hostname is allocated
 * and provisioned automatically, and its lifecycle is managed here (retry,
 * release) rather than through the editable domain table.
 */
export const CloudDomainCard = ({
	applicationId,
}: {
	applicationId: string;
}) => {
	const utils = api.useUtils();
	const [copied, setCopied] = useState(false);
	const { data, isPending } = api.cloudDomain.byApplicationId.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);
	const ensure = api.cloudDomain.ensure.useMutation();

	if (isPending || !data?.enabled) {
		return null;
	}

	const domain = data.domain;

	const refresh = async () => {
		try {
			await ensure.mutateAsync({ applicationId });
			await utils.cloudDomain.byApplicationId.invalidate({ applicationId });
			toast.success("Cloud domain refreshed");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not provision the cloud domain",
			);
		}
	};

	const copyUrl = async () => {
		if (!domain) {
			return;
		}
		try {
			await navigator.clipboard.writeText(domain.url);
			setCopied(true);
			toast.success("URL copied");
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Could not copy the URL");
		}
	};

	return (
		<Card className="border-primary/30">
			<CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<Globe2 className="size-4 text-muted-foreground" aria-hidden />
						<span className="text-sm font-medium">Notploy Cloud domain</span>
						<Badge variant={STATUS_VARIANT[domain?.status ?? "unavailable"]}>
							{STATUS_LABEL[domain?.status ?? "unavailable"]}
						</Badge>
						<Badge variant="outline" className="gap-1">
							<LockKeyhole className="size-3" aria-hidden />
							HTTPS
						</Badge>
					</div>
					{domain ? (
						<a
							href={domain.url}
							target="_blank"
							rel="noreferrer"
							className="block truncate font-mono text-sm hover:underline"
						>
							{domain.hostname}
						</a>
					) : (
						<p className="text-sm text-muted-foreground">
							This application will receive a public URL on its next successful
							deployment.
						</p>
					)}
					{domain?.errorMessage && (
						<p className="flex items-start gap-1.5 text-xs text-destructive">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
							<span className="break-words">{domain.errorMessage}</span>
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Assigned automatically and kept across redeployments. Target port{" "}
						{domain?.port ?? "—"}. Custom domains remain managed below.
						{domain?.status === "error"
							? " Retry to repair routing or TLS."
							: ""}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{domain && (
						<Button variant="outline" size="sm" onClick={copyUrl}>
							{copied ? (
								<Check className="size-4" aria-hidden />
							) : (
								<Copy className="size-4" aria-hidden />
							)}
							Copy URL
						</Button>
					)}
					{domain && (
						<Button asChild size="sm">
							<a href={domain.url} target="_blank" rel="noreferrer">
								<ExternalLink className="size-4" aria-hidden />
								Open
							</a>
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={refresh}
						disabled={ensure.isPending}
					>
						{ensure.isPending ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : (
							<RefreshCw className="size-4" aria-hidden />
						)}
						{domain?.status === "error"
							? "Retry"
							: domain
								? "Refresh"
								: "Assign now"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
