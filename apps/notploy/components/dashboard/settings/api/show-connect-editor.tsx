"use client";
import copy from "copy-to-clipboard";
import { CheckIcon, CodeIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/utils/api";

const MARKETPLACE_URL =
	"https://marketplace.visualstudio.com/items?itemName=notploy.notploy";
const EXTENSION_ID = "notploy.notploy";

const STEPS = [
	{
		title: "Install the extension",
		description:
			"From a terminal, or search for “Notploy” in the Extensions view.",
		command: `code --install-extension ${EXTENSION_ID}`,
	},
	{
		title: "Add this instance",
		description:
			"Run “Notploy: Add Instance” in the Command Palette and paste the address below. Plain HTTP is accepted on localhost and private networks.",
		command: "", // resolved at render time from the current origin
	},
	{
		title: "Authenticate",
		description:
			"Run “Notploy: Login”, then paste one of the keys listed on this page. The extension stores it in VS Code secret storage, never in settings.json.",
		command: "", // resolved at render time from the current origin
	},
];

/**
 * The dashboard half of the VS Code connect flow.
 *
 * Notploy's public API has no OAuth or device-code procedure, so the extension
 * authenticates exactly like the CLI and the SDK: an API key sent as
 * `x-api-key`. This card is where that key comes from, which makes it the
 * counterpart of the extension's `notploy.instance.add` and `notploy.login`
 * commands.
 *
 * Everything here is derived from `document.location.origin`, so the page is
 * served by the very instance the user is looking at. That is what makes the
 * instructions correct for both deployments without branching: Notploy Cloud
 * hands out `https://app.notploy.com`, a self-hosted instance hands out its
 * own origin, and the extension is identical either way because it only ever
 * talks to the origin it is given.
 */
export const ShowConnectEditor = () => {
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const [origin, setOrigin] = useState("");

	useEffect(() => {
		setOrigin(document.location.origin);
	}, []);

	const copyValue = (value: string) => {
		copy(value);
		toast.success("Copied to clipboard");
	};

	return (
		<Card className="w-full">
			<CardHeader className="flex flex-row gap-2 flex-wrap justify-between items-start">
				<div>
					<CardTitle className="text-xl flex items-center gap-2">
						<CodeIcon className="size-5" />
						Connect the VS Code extension
					</CardTitle>
					<CardDescription>
						Manage projects, deployments, logs and servers from your editor
					</CardDescription>
				</div>
				<Button variant="outline" asChild>
					<a href={MARKETPLACE_URL} target="_blank" rel="noreferrer">
						View on Marketplace
						<ExternalLinkIcon className="size-4" />
					</a>
				</Button>
			</CardHeader>
			<CardContent className="space-y-4 border-t pt-5">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Badge variant="secondary">
						{isCloud ? "Notploy Cloud" : "Self-hosted"}
					</Badge>
					<span>
						The extension connects to this instance over the same API as the CLI
						and SDK, using an API key from the list below.
					</span>
				</div>

				<ol className="space-y-4">
					{STEPS.map((step, index) => {
						const value = step.command || origin;
						return (
							<li
								key={step.title}
								className="flex flex-col gap-2 border rounded-lg p-4"
							>
								<div className="flex flex-col gap-1">
									<span className="font-medium">
										{index + 1}. {step.title}
									</span>
									<span className="text-sm text-muted-foreground">
										{step.description}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<code className="flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-sm whitespace-nowrap">
										{value || "…"}
									</code>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={`Copy ${step.title.toLowerCase()}`}
										disabled={!value}
										onClick={() => copyValue(value)}
									>
										<CopyIcon className="size-4" />
									</Button>
								</div>
							</li>
						);
					})}
				</ol>

				<div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					<CheckIcon className="size-4 mt-0.5 shrink-0" />
					<span>
						Generate a dedicated key for the editor — for example{" "}
						<code className="font-mono">vscode-laptop</code> — so it can be
						revoked without affecting the CLI. Deleting the key on this page
						disconnects the extension immediately.
					</span>
				</div>
			</CardContent>
		</Card>
	);
};
