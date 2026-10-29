import { startRegistration } from "@simplewebauthn/browser";
import copy from "copy-to-clipboard";
import {
	CopyIcon,
	Fingerprint,
	KeyRound,
	Loader2,
	Plus,
	RefreshCw,
	ShieldOff,
	Trash2,
} from "lucide-react";
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
import { authClient } from "@/lib/auth-client";
import {
	countSecurityKeyBackupCodes,
	generateSecurityKeyBackupCodes,
	getTwoFactorMethod,
	isCeremonyCancellation,
	listSecurityKeys,
	registerSecurityKey,
	removeSecurityKey,
	requestSecurityKeyRegistrationOptions,
	type SecurityKey,
	setTwoFactorMethod,
	type TwoFactorMethodSummary,
} from "@/lib/webauthn-two-factor";
import { api } from "@/utils/api";

const friendlyError = (
	code: string | undefined,
	message: string | undefined,
) => {
	if (code === "SESSION_NOT_FRESH") {
		return "Please sign out and sign in again before managing security keys.";
	}
	if (code === "LAST_SECURITY_KEY") {
		return "Register another security key before removing this one.";
	}
	if (code === "TOTP_SETUP_REQUIRED") {
		return "Set up an authenticator app first, then switch back to codes.";
	}
	return message || "The security key request failed. Try again.";
};

/**
 * Registers a WebAuthn credential used as the second factor after the password
 * step.
 *
 * The account can either require a key or authenticator (TOTP) codes, never
 * both: the first key registered here makes the key the required factor and
 * issues one-time backup codes, so a lost key does not lock the account out.
 * The credential lives in the authenticator: a hardware key, the platform
 * authenticator, or a security key stored in a password manager such as
 * Bitwarden or 1Password. It never signs the account in on its own — the
 * password is always required first.
 */
export const ManageSecurityKeys = ({
	onChanged,
}: {
	/** Lets the settings card refresh the mode/lock state it displays. */
	onChanged?: () => void;
} = {}) => {
	const utils = api.useUtils();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
	const [summary, setSummary] = useState<TwoFactorMethodSummary | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [remaining, setRemaining] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [isSwitching, setIsSwitching] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [showDisable, setShowDisable] = useState(false);
	const [disablePassword, setDisablePassword] = useState("");
	const [isDisabling, setIsDisabling] = useState(false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const [keys, method, codes] = await Promise.all([
				listSecurityKeys(),
				getTwoFactorMethod(),
				countSecurityKeyBackupCodes(),
			]);
			if (keys.error) {
				toast.error(friendlyError(keys.error.code, keys.error.message));
				return;
			}
			setSecurityKeys(keys.securityKeys);
			setSummary(method.summary);
			setRemaining(codes.remaining);
			onChanged?.();
		} finally {
			setIsLoading(false);
		}
	}, [onChanged]);

	useEffect(() => {
		if (!isDialogOpen) return;
		refresh().catch(() => setIsLoading(false));
	}, [isDialogOpen, refresh]);

	const isSecurityKeyMethod = summary?.method === "securityKey";

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
			const { backupCodes: issuedBackupCodes, error: registerError } =
				await registerSecurityKey(response, name.trim() || undefined);
			if (registerError) {
				toast.error(friendlyError(registerError.code, registerError.message));
				return;
			}

			toast.success("Security key registered");
			setName("");
			// The first key turns two-factor on: the codes are shown once here.
			if (issuedBackupCodes.length > 0) {
				setBackupCodes(issuedBackupCodes);
			}
			utils.user.get.invalidate();
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

	const handleUseSecurityKey = async () => {
		setIsSwitching(true);
		try {
			const result = await setTwoFactorMethod("securityKey");
			if (result.error) {
				toast.error(friendlyError(result.error.code, result.error.message));
				return;
			}

			toast.success("Security key required after your password");
			if (result.backupCodes.length > 0) setBackupCodes(result.backupCodes);
			utils.user.get.invalidate();
			await refresh();
		} finally {
			setIsSwitching(false);
		}
	};

	const handleRegenerateBackupCodes = async () => {
		setIsRegenerating(true);
		try {
			const { backupCodes: regenerated, error } =
				await generateSecurityKeyBackupCodes();
			if (error) {
				toast.error(friendlyError(error.code, error.message));
				return;
			}

			setBackupCodes(regenerated);
			toast.success("New backup codes generated");
			await refresh();
		} finally {
			setIsRegenerating(false);
		}
	};

	const handleDisable = async () => {
		setIsDisabling(true);
		try {
			const result = await authClient.twoFactor.disable({
				password: disablePassword,
			});
			if (result.error) {
				toast.error(result.error.message || "Could not disable two-factor");
				return;
			}

			toast.success("Two-factor authentication disabled");
			setShowDisable(false);
			setDisablePassword("");
			utils.user.get.invalidate();
			await refresh();
		} finally {
			setIsDisabling(false);
		}
	};

	const handleCopyBackupCodes = () => {
		copy(backupCodes.join("\n"));
		toast.success("Backup codes copied to clipboard");
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
							Verify your sign-in with a device instead of typing a 6-digit
							code. The key is created and stored by your browser or password
							manager (Bitwarden, 1Password, iCloud Keychain) or by a hardware
							key such as a YubiKey or Windows Hello. Your password is still
							required at every sign-in.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{isSecurityKeyMethod ? (
							<div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
								<span className="flex items-center gap-2 font-medium">
									<KeyRound className="size-4" />
									Security key is your second factor
								</span>
								<p className="mt-1 text-muted-foreground">
									After your password, Notploy asks for one of your keys.
									Authenticator codes no longer complete the sign-in.
								</p>
							</div>
						) : summary && securityKeys.length > 0 ? (
							<div className="space-y-2 rounded-lg border p-3 text-sm">
								<span className="font-medium">
									{summary.method === "totp"
										? "Authenticator codes are your second factor"
										: "Your keys are not required yet"}
								</span>
								<p className="text-muted-foreground">
									{summary.method === "totp"
										? "Your keys are registered but not required. Make a key the required factor to sign in with it instead of codes."
										: "Make a key the required factor and Notploy asks for it after your password."}
								</p>
								<Button
									variant="outline"
									size="sm"
									isLoading={isSwitching}
									onClick={handleUseSecurityKey}
								>
									<Fingerprint className="size-4" />
									Use a security key instead
								</Button>
							</div>
						) : (
							<div className="rounded-lg border p-3 text-sm text-muted-foreground">
								{summary?.method === "totp"
									? "Registering a key adds it to your account. You can then make it the required factor."
									: "Registering a key turns on two-factor authentication and makes the key the factor required after your password. Backup codes are issued at the same time."}
							</div>
						)}

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
									Register one to require a device after your password.
								</span>
							</div>
						)}

						<form
							onSubmit={handleAddSecurityKey}
							className="flex flex-col gap-2"
						>
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

						{backupCodes.length > 0 && (
							<div className="space-y-3 rounded-lg border p-4">
								<div className="flex items-center justify-between">
									<h4 className="font-medium">Backup codes</h4>
									<Button
										variant="outline"
										size="icon"
										type="button"
										onClick={handleCopyBackupCodes}
									>
										<CopyIcon className="size-4" />
									</Button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									{backupCodes.map((code) => (
										<code
											key={code}
											className="rounded bg-muted p-2 text-center font-mono text-sm"
										>
											{code}
										</code>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Store these codes now: they are shown only once. Each one
									works a single time and replaces the key after your password.
								</p>
							</div>
						)}

						{isSecurityKeyMethod && (
							<div className="space-y-3 rounded-lg border p-4">
								<div className="flex items-center justify-between gap-2">
									<div>
										<h4 className="font-medium">Recovery codes</h4>
										<p className="text-sm text-muted-foreground">
											{remaining === null
												? "Loading…"
												: `${remaining} left. They are the way back in if you lose every key.`}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										isLoading={isRegenerating}
										onClick={handleRegenerateBackupCodes}
									>
										<RefreshCw className="size-4" />
										Regenerate
									</Button>
								</div>
							</div>
						)}

						{isSecurityKeyMethod && (
							<div className="flex flex-col gap-2 rounded-lg border border-destructive/50 p-4">
								<span className="flex items-center gap-2 font-medium text-destructive">
									<ShieldOff className="size-4" />
									Disable two-factor authentication
								</span>
								<p className="text-sm text-muted-foreground">
									Your keys stay registered but stop being required. You can
									turn two-factor back on at any time.
								</p>
								{showDisable ? (
									<div className="flex flex-col gap-2">
										<Input
											type="password"
											placeholder="Confirm your password"
											value={disablePassword}
											onChange={(e) => setDisablePassword(e.target.value)}
										/>
										<div className="flex gap-2">
											<Button
												variant="outline"
												className="flex-1"
												onClick={() => {
													setShowDisable(false);
													setDisablePassword("");
												}}
											>
												Cancel
											</Button>
											<Button
												variant="destructive"
												className="flex-1"
												isLoading={isDisabling}
												disabled={disablePassword.length < 8}
												onClick={handleDisable}
											>
												Disable 2FA
											</Button>
										</div>
									</div>
								) : (
									<Button
										variant="destructive"
										onClick={() => setShowDisable(true)}
									>
										<ShieldOff className="size-4" />
										Disable 2FA
									</Button>
								)}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
	);
};
