import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import { CopyIcon, DownloadIcon, Fingerprint, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	type OtpProviderIconKey,
	otpProviderIcons,
} from "@/components/icons/otp-provider-icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";

const AUTHENTICATOR_APPS = [
	{ id: "googleauthenticator", label: "Google Authenticator" },
	{ id: "authy", label: "Authy" },
	{ id: "microsoftauthenticator", label: "Microsoft Authenticator" },
	{ id: "onepassword", label: "1Password" },
	{ id: "bitwarden", label: "Bitwarden" },
	{ id: "freeotp", label: "FreeOTP" },
] as const satisfies ReadonlyArray<{
	id: OtpProviderIconKey;
	label: string;
}>;

type AuthenticatorAppId = (typeof AUTHENTICATOR_APPS)[number]["id"];

const AUTHENTICATOR_APP_IDS = AUTHENTICATOR_APPS.map((app) => app.id) as [
	AuthenticatorAppId,
	...AuthenticatorAppId[],
];

const OTP_ISSUER = "Notploy";

const DEFAULT_AUTHENTICATOR_APP = AUTHENTICATOR_APPS[0].id;

const PasswordSchema = z.object({
	password: z.string().min(8, {
		message: "Password is required",
	}),
	authenticatorApp: z.enum(AUTHENTICATOR_APP_IDS),
});

const PinSchema = z.object({
	pin: z.string().min(6, {
		message: "Pin is required",
	}),
});

type TwoFactorSetupData = {
	qrCodeUrl: string;
	secret: string;
	totpURI: string;
};

type PasswordForm = z.infer<typeof PasswordSchema>;
type PinForm = z.infer<typeof PinSchema>;

export const USERNAME_PLACEHOLDER = "%username%";
export const DATE_PLACEHOLDER = "%date%";
export const BACKUP_CODES_PLACEHOLDER = "%backupCodes%";

export const backupCodeTemplate = `Notploy - BACKUP VERIFICATION CODES

Points to note
--------------
# Each code can be used only once.
# Do not share these codes with anyone.

Generated codes
---------------
Username: ${USERNAME_PLACEHOLDER}
Generated on: ${DATE_PLACEHOLDER}


${BACKUP_CODES_PLACEHOLDER}
`;

export const Enable2FA = () => {
	const utils = api.useUtils();
	const [data, setData] = useState<TwoFactorSetupData | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [step, setStep] = useState<"password" | "verify">("password");
	const [isPasswordLoading, setIsPasswordLoading] = useState(false);
	const [otpValue, setOtpValue] = useState("");
	const { data: currentUser } = api.user.get.useQuery();

	const handleVerifySubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const result = await authClient.twoFactor.verifyTotp({
				code: otpValue,
			});

			if (result.error) {
				if (result.error.code === "INVALID_CODE") {
					toast.error("Invalid verification code");
					return;
				}

				throw result.error;
			}

			if (!result.data) {
				throw new Error("No response received from server");
			}

			toast.success("2FA configured successfully");
			utils.user.get.invalidate();
			setIsDialogOpen(false);
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage =
					error.message === "Failed to fetch"
						? "Connection error. Please check your internet connection."
						: error.message;

				toast.error(errorMessage);
			} else {
				toast.error("Error verifying 2FA code", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	};

	const passwordForm = useForm<PasswordForm>({
		resolver: zodResolver(PasswordSchema),
		defaultValues: {
			password: "",
			authenticatorApp: DEFAULT_AUTHENTICATOR_APP,
		},
	});

	const pinForm = useForm<PinForm>({
		resolver: zodResolver(PinSchema),
		defaultValues: {
			pin: "",
		},
	});

	useEffect(() => {
		if (!isDialogOpen) {
			setStep("password");
			setData(null);
			setBackupCodes([]);
			setOtpValue("");
			passwordForm.reset({
				password: "",
				authenticatorApp: DEFAULT_AUTHENTICATOR_APP,
			});
		}
	}, [isDialogOpen, passwordForm]);

	useEffect(() => {
		if (step === "verify") {
			setOtpValue("");
		}
	}, [step]);

	const selectedAuthenticatorApp =
		AUTHENTICATOR_APPS.find(
			(app) => app.id === passwordForm.watch("authenticatorApp"),
		)?.label ?? "your authenticator app";

	const handlePasswordSubmit = async (formData: PasswordForm) => {
		setIsPasswordLoading(true);
		try {
			const { data: enableData, error } = await authClient.twoFactor.enable({
				password: formData.password,
				issuer: OTP_ISSUER,
			});

			if (!enableData) {
				throw new Error(error?.message || "Error enabling 2FA");
			}

			if (enableData.backupCodes) {
				setBackupCodes(enableData.backupCodes);
			}

			if (enableData.totpURI) {
				const qrCodeUrl = await QRCode.toDataURL(enableData.totpURI);

				setData({
					qrCodeUrl,
					secret: enableData.totpURI.split("secret=")[1]?.split("&")[0] || "",
					totpURI: enableData.totpURI,
				});

				setStep("verify");
				toast.success("Scan the QR code with your authenticator app");
			} else {
				throw new Error("No TOTP URI received from server");
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Error setting up 2FA",
			);
			passwordForm.setError("password", {
				message:
					error instanceof Error ? error.message : "Error setting up 2FA",
			});
		} finally {
			setIsPasswordLoading(false);
		}
	};

	const handleDownloadBackupCodes = () => {
		if (!backupCodes || backupCodes.length === 0) {
			toast.error("No backup codes to download.");
			return;
		}

		const backupCodesFormatted = backupCodes
			.map((code, index) => ` ${index + 1}. ${code}`)
			.join("\n");

		const date = new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const filename = `notploy-2fa-backup-codes-${year}${month}${day}.txt`;

		const backupCodesText = backupCodeTemplate
			.replace(USERNAME_PLACEHOLDER, currentUser?.user?.email || "unknown")
			.replace(DATE_PLACEHOLDER, date.toLocaleString())
			.replace(BACKUP_CODES_PLACEHOLDER, backupCodesFormatted);

		const blob = new Blob([backupCodesText], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleCopyBackupCodes = () => {
		const date = new Date();

		const backupCodesFormatted = backupCodes
			.map((code, index) => ` ${index + 1}. ${code}`)
			.join("\n");

		const backupCodesText = backupCodeTemplate
			.replace(USERNAME_PLACEHOLDER, currentUser?.user?.email || "unknown")
			.replace(DATE_PLACEHOLDER, date.toLocaleString())
			.replace(BACKUP_CODES_PLACEHOLDER, backupCodesFormatted);

		copy(backupCodesText);
		toast.success("Backup codes copied to clipboard");
	};

	return (
		<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost">
					<Fingerprint className="size-4 text-muted-foreground" />
					Enable 2FA
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>2FA Setup</DialogTitle>
					<DialogDescription>
						{step === "password"
							? "Enter your password to begin 2FA setup"
							: `Scan the QR code with ${selectedAuthenticatorApp} and verify the code`}
					</DialogDescription>
				</DialogHeader>

				{step === "password" ? (
					<Form {...passwordForm}>
						<form
							id="password-form"
							onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
							className="space-y-4"
						>
							<FormField
								control={passwordForm.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter your password"
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Enter your password to enable 2FA
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={passwordForm.control}
								name="authenticatorApp"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Authenticator app</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select an authenticator app" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{AUTHENTICATOR_APPS.map((app) => {
													const Icon = otpProviderIcons[app.id];
													return (
														<SelectItem key={app.id} value={app.id}>
															<div className="flex flex-row items-center gap-2">
																<Icon className="size-4 shrink-0" />
																{app.label}
															</div>
														</SelectItem>
													);
												})}
											</SelectContent>
										</Select>
										<FormDescription>
											Choose the authenticator app you use. Notploy is shown as
											the issuer for this account.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button
								type="submit"
								className="w-full"
								isLoading={isPasswordLoading}
							>
								Continue
							</Button>
						</form>
					</Form>
				) : (
					<Form {...pinForm}>
						<form onSubmit={handleVerifySubmit} className="space-y-6">
							<div className="flex flex-col gap-6 justify-center items-center">
								{data?.qrCodeUrl ? (
									<>
										<div className="flex flex-col items-center gap-4 p-6 border rounded-lg">
											<QrCode className="size-5 text-muted-foreground" />
											<span className="text-sm font-medium">
												Scan this QR code with your authenticator app
											</span>
											{/** biome-ignore lint/performance/noImgElement: This is a valid use case for an img element */}
											<img
												src={data.qrCodeUrl}
												alt="2FA QR Code"
												className="rounded-lg w-48 h-48"
											/>
											<div className="flex flex-col gap-2 text-center">
												<span className="text-sm text-muted-foreground">
													Can't scan the QR code?
												</span>
												<span className="text-xs font-mono bg-muted p-2 rounded">
													{data.secret}
												</span>
											</div>
										</div>

										{backupCodes && backupCodes.length > 0 && (
											<div className="w-full space-y-3 border rounded-lg p-4">
												<div className="flex items-center justify-between">
													<h4 className="font-medium">Backup Codes</h4>
													<div className="flex items-center gap-2">
														<TooltipProvider>
															<Tooltip delayDuration={0}>
																<TooltipTrigger asChild>
																	<Button
																		type="button"
																		variant="outline"
																		size="icon"
																		onClick={handleCopyBackupCodes}
																	>
																		<CopyIcon className="size-4" />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>
																	<p>Copy</p>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>

														<TooltipProvider>
															<Tooltip delayDuration={0}>
																<TooltipTrigger asChild>
																	<Button
																		type="button"
																		variant="outline"
																		size="icon"
																		onClick={handleDownloadBackupCodes}
																	>
																		<DownloadIcon className="size-4" />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>
																	<p>Download</p>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-2">
													{backupCodes.map((code, index) => (
														<code
															key={`${code}-${index}`}
															className="bg-muted p-2 rounded text-sm font-mono"
														>
															{code}
														</code>
													))}
												</div>
												<p className="text-sm text-muted-foreground">
													Save these backup codes in a secure place. You can use
													them to access your account if you lose access to your
													authenticator device.
												</p>
											</div>
										)}
									</>
								) : (
									<div className="flex items-center justify-center w-full h-48 bg-muted rounded-lg">
										<QrCode className="size-8 text-muted-foreground animate-pulse" />
									</div>
								)}
							</div>

							<div className="flex flex-col gap-2">
								<FormLabel>Verification Code</FormLabel>
								<InputOTP
									maxLength={6}
									value={otpValue}
									onChange={setOtpValue}
									autoFocus
								>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
									</InputOTPGroup>
									<InputOTPSeparator />
									<InputOTPGroup>
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
								<FormDescription>
									Enter the 6-digit code from your authenticator app
								</FormDescription>
							</div>

							<Button
								type="submit"
								className="w-full"
								isLoading={isPasswordLoading}
								disabled={otpValue.length !== 6}
							>
								Enable 2FA
							</Button>
						</form>
					</Form>
				)}
			</DialogContent>
		</Dialog>
	);
};
