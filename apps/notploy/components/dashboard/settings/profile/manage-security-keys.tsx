import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	isCeremonyCancellation,
	listSecurityKeys,
	registerSecurityKey,
	removeSecurityKey,
	requestSecurityKeyRegistrationOptions,
	type SecurityKey,
} from "@/lib/webauthn-two-factor";

const friendlyError = (code: string | undefined, message: string | undefined) => {
	if (code === "SESSION_NOT_FRESH") {
		return "Please sign out and sign in again before managing security keys.";
	}
	return message || "The security key request failed. Try again.";
};

/**
 * Registers a WebAuthn credential used as the second factor after the password
 * step, alongside the authenticator (TOTP) codes.
 *
 * The credential lives in the authenticator: a hardware key, the platform
 * authenticator, or a security key stored in a password manager such as
 * Bitwarden or 1Password. It never signs the account in on its own — the
 * password is always required first.
 */
export const ManageSecurityKeys = () => {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const { securityKeys, error } = await listSecurityKeys();
			if (error) {
				toast.error(friendlyError(error.code, error.message));
				return;
			}
			setSecurityKeys(securityKeys);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!isDialogOpen) return;
		refresh().catch(() => setIsLoading(false));
	}, [isDialogOpen, refresh]);

	const handleAddSecurityKey = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAdding(true);
		try {
			const { options, error } = await requestSecurityKeyRegistrationOptions();
			if (error || !options) {
				toast.error(friendlyError(error?.code, error?.message));
				return;
			}

			const response = await startRegistration({ optionsJSON: options });
			const { error: registerError } = await registerSecurityKey(
				response,
				name.trim() || undefined,
			);
			if (registerError) {
				toast.error(friendlyError(registerError.code, registerError.message));
				return;
			}

			toast.success("Security key registered");
			setName("");
			await refresh();
		} catch (caught) {
			if (!isCeremonyCancellation(caught)) {
				toast.error(
					caught instanceof Error
						? caught.message
						: "Failed to register the security key",
				);
			}
		} finally {
			setIsAdding(false);
		}
	};

	const handleDeleteSecurityKey = async (id: string) => {
		setDeletingId(id);
		try {
			const { success, error } = await removeSecurityKey(id);
			if (error || !success) {
				toast.error(friendlyError(error?.code, error?.message));
				return;
			}

			toast.success("Security key removed");
			await refresh();
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<Fingerprint className="size-4 text-muted-foreground" />
					Security key
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Security key</DialogTitle>
					<DialogDescription>
						Verify your sign-in with a device instead of typing a 6-digit code.
						The key is created and stored by your browser or password manager
						(Bitwarden, 1Password, iCloud Keychain) or by a hardware key such as
						a YubiKey or Windows Hello. Your password is still required at every
						sign-in.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{isLoading ? (
						<div className="flex min-h-[10vh] flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
							<span>Loading...</span>
							<Loader2 className="size-4 animate-spin" />
						</div>
					) : securityKeys.length > 0 ? (
						<div className="grid gap-3">
							{securityKeys.map((securityKey) => (
								<div
									key={securityKey.id}
									className="flex items-center justify-between gap-2 rounded-lg border p-4"
								>
									<div className="flex min-w-0 flex-col gap-1">
										<span className="flex items-center gap-2 font-medium">
											<Fingerprint className="size-4 shrink-0 text-muted-foreground" />
											<span className="truncate">
												{securityKey.name || "Unnamed security key"}
											</span>
											<Badge variant="outline">
												{securityKey.deviceType === "singleDevice"
													? "Device"
													: "Synced"}
											</Badge>
										</span>
										{securityKey.createdAt && (
											<DateTooltip
												date={securityKey.createdAt}
												className="text-sm"
											>
												Added
											</DateTooltip>
										)}
									</div>
									<DialogAction
										title="Remove this security key?"
										description="It will no longer work as a second factor. Keep at least one other way to sign in."
										onClick={() => handleDeleteSecurityKey(securityKey.id)}
									>
										<Button
											variant="ghost"
											size="icon"
											isLoading={deletingId === securityKey.id}
											className="text-muted-foreground hover:text-destructive"
										>
											<Trash2 className="size-4" />
										</Button>
									</DialogAction>
								</div>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center gap-2 rounded-lg border py-6 text-sm text-muted-foreground">
							<Fingerprint className="size-6" />
							<span>No security key registered yet</span>
							<span className="text-center text-xs">
								Until you add one, signing in keeps asking for an authenticator
								code.
							</span>
						</div>
					)}

					<form onSubmit={handleAddSecurityKey} className="flex flex-col gap-2">
						<Label htmlFor="security-key-name">Key name</Label>
						<div className="flex gap-2">
							<Input
								id="security-key-name"
								placeholder="e.g. Bitwarden vault"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<Button type="submit" isLoading={isAdding}>
								<Plus className="size-4" />
								Register key
							</Button>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
};
