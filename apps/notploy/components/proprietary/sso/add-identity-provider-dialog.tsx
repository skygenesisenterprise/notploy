"use client";

import type { LucideIcon } from "lucide-react";
import { KeyRound, Landmark, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { RegisterOidcDialog } from "./register-oidc-dialog";
import { RegisterSamlDialog } from "./register-saml-dialog";

type Protocol = "oidc" | "saml";

const OPTIONS: Array<{
	protocol: Protocol;
	label: string;
	description: string;
	icon: LucideIcon;
}> = [
	{
		protocol: "oidc",
		label: "OpenID Connect",
		description: "Any OIDC-compliant provider, discovered from its issuer URL.",
		icon: KeyRound,
	},
	{
		protocol: "saml",
		label: "SAML 2.0",
		description: "Federated sign-in through a SAML 2.0 identity provider.",
		icon: Landmark,
	},
];

export const AddIdentityProviderDialog = () => {
	const [chooserOpen, setChooserOpen] = useState(false);
	const [protocol, setProtocol] = useState<Protocol | null>(null);

	const selectProtocol = (next: Protocol) => {
		setChooserOpen(false);
		setProtocol(next);
	};

	return (
		<>
			<Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
				<DialogTrigger asChild>
					<Button>
						<Plus className="mr-2 size-4" />
						Add provider
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldCheck className="size-5" />
							Add an identity provider
						</DialogTitle>
						<DialogDescription>
							Pick the protocol your identity infrastructure speaks. Notploy
							integrates with the provider you already run.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3 py-2">
						{OPTIONS.map((option) => {
							const Icon = option.icon;
							return (
								<button
									key={option.protocol}
									type="button"
									onClick={() => selectProtocol(option.protocol)}
									className="flex items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50"
								>
									<Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
									<div className="flex flex-col gap-0.5">
										<span className="text-sm font-medium">{option.label}</span>
										<span className="text-xs text-muted-foreground">
											{option.description}
										</span>
									</div>
								</button>
							);
						})}
					</div>
				</DialogContent>
			</Dialog>

			<RegisterOidcDialog
				open={protocol === "oidc"}
				onOpenChange={(open) => {
					if (!open) setProtocol(null);
				}}
			/>
			<RegisterSamlDialog
				open={protocol === "saml"}
				onOpenChange={(open) => {
					if (!open) setProtocol(null);
				}}
			/>
		</>
	);
};
