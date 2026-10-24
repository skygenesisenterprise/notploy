import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import {
	getWebServerSettings,
	IS_CLOUD,
	isAdminPresent,
} from "@notploy/server";
import { validateRequest } from "@notploy/server/lib/auth";
import {
	browserSupportsWebAuthn,
	startAuthentication,
} from "@simplewebauthn/browser";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Fingerprint, Loader2 } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import QRCode from "qrcode";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { SignInWithGithub } from "@/components/proprietary/auth/sign-in-with-github";
import { SignInWithGoogle } from "@/components/proprietary/auth/sign-in-with-google";
import { SignInWithSSO } from "@/components/proprietary/sso/sign-in-with-sso";
import { AlertBlock } from "@/components/shared/alert-block";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
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
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
	getSecurityKeyQrLoginStatus,
	getTwoFactorMethod,
	isCeremonyCancellation,
	requestWebAuthnTwoFactorOptions,
	type TwoFactorMethod,
	startSecurityKeyQrLogin,
	verifySecurityKeyBackupCode,
	verifyWebAuthnTwoFactor,
	type WebAuthnTwoFactorOptions,
} from "@/lib/webauthn-two-factor";
import { appRouter } from "@/server/api/root";
import { generateServerSideHelper } from "@/utils/create-server-helpers";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

const _TwoFactorSchema = z.object({
	code: z.string().min(6),
});

type LoginForm = z.infer<typeof LoginSchema>;

interface Props {
	IS_CLOUD: boolean;
	enforceSSO: boolean;
}
export default function Home({ IS_CLOUD, enforceSSO }: Props) {
	const router = useRouter();
	const { config: whitelabeling } = useWhitelabelingPublic();
	const [isLoginLoading, setIsLoginLoading] = useState(false);
	const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false);
	const [isBackupCodeLoading, setIsBackupCodeLoading] = useState(false);
	const [isTwoFactor, setIsTwoFactor] = useState(false);
	const [twoFactorMethod, setTwoFactorMethod] =
		useState<TwoFactorMethod | null>(null);
	const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(false);
	const [securityKeyOptions, setSecurityKeyOptions] =
		useState<WebAuthnTwoFactorOptions | null>(null);
	const [hasSecurityKey, setHasSecurityKey] = useState(false);
	const [hasNoSecurityKey, setHasNoSecurityKey] = useState(false);
	const [isSecurityKeyLoading, setIsSecurityKeyLoading] = useState(false);
	const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
	const [qrExpired, setQrExpired] = useState(false);
	const [qrNonce, setQrNonce] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [isBackupCodeModalOpen, setIsBackupCodeModalOpen] = useState(false);
	const [backupCode, setBackupCode] = useState("");
	const loginForm = useForm<LoginForm>({
		resolver: zodResolver(LoginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	useEffect(() => {
		const queryError = router.query.error;
		if (!queryError) return;

		const raw = Array.isArray(queryError) ? queryError[0] : queryError;
		if (!raw) return;
		const normalized = raw.replace(/[+_]/g, " ").toLowerCase();

		setError(
			normalized.includes("account not linked")
				? "This account already exists but isn't linked to that sign-in provider yet. Contact your administrator to link it."
				: normalized.includes("access denied")
					? "Access was denied by the identity provider."
					: "We couldn't complete sign-in. Please try again or contact your administrator.",
		);

		const { error: _removed, ...rest } = router.query;
		router.replace({ pathname: router.pathname, query: rest }, undefined, {
			shallow: true,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router.query.error]);

	useEffect(() => {
		setIsWebAuthnSupported(browserSupportsWebAuthn());
	}, []);

	const loadSecurityKeyOptions = useCallback(async () => {
		const { options, error } = await requestWebAuthnTwoFactorOptions();
		setSecurityKeyOptions(options);
		setHasSecurityKey(!!options);
		setHasNoSecurityKey(error?.code === "NO_SECURITY_KEY");
	}, []);

	// Reads the factor the account chose after its password. The panel shows
	// exactly that factor: codes, or the security key.
	const loadTwoFactorMethod = useCallback(async () => {
		const { summary } = await getTwoFactorMethod();
		setTwoFactorMethod(summary?.method ?? null);
	}, []);

	// The password step left a pending two-factor token, so a challenge can be
	// requested before the user chooses a factor. Accounts without a key keep
	// the code form only.
	useEffect(() => {
		if (!isTwoFactor || !isWebAuthnSupported) return;
		if (twoFactorMethod === "totp") {
			setSecurityKeyOptions(null);
			setHasSecurityKey(false);
			setHasNoSecurityKey(false);
			return;
		}
		loadSecurityKeyOptions().catch(() => setSecurityKeyOptions(null));
	}, [
		isTwoFactor,
		isWebAuthnSupported,
		twoFactorMethod,
		loadSecurityKeyOptions,
	]);

	// Security-key mode completes the password step by scanning a QR code with a
	// phone already signed in to the account. The waiting browser polls until
	// the phone approves, then receives its session cookie.
	useEffect(() => {
		if (!isTwoFactor || twoFactorMethod !== "securityKey") {
			setQrCodeUrl(null);
			setQrExpired(false);
			return;
		}

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let requestId: string | null = null;
		let failures = 0;

		const poll = async () => {
			if (cancelled || !requestId) return;
			const { status, token, error } = await getSecurityKeyQrLoginStatus(requestId);
			if (cancelled) return;

			if (status === "approved" && token) {
				toast.success("Logged in successfully");
				router.push("/dashboard/home");
				return;
			}
			if (status === "expired") {
				setQrExpired(true);
				return;
			}

			// A transient failure (network, dev server reload) must not remove the
			// QR while it is still valid on screen; only repeated failures give up.
			failures = error ? failures + 1 : 0;
			if (failures >= 5) {
				setQrExpired(true);
				return;
			}
			timer = setTimeout(poll, 2000);
		};

		(async () => {
			const { request, error } = await startSecurityKeyQrLogin();
			if (cancelled) return;
			if (error || !request) {
				setQrExpired(true);
				toast.error(error?.message ?? "Could not prepare the QR code");
				return;
			}

			requestId = request.requestId;
			const qr = await QRCode.toDataURL(request.url, { margin: 1, width: 240 });
			if (cancelled) return;
			setQrCodeUrl(qr);
			setQrExpired(false);
			timer = setTimeout(poll, 1500);
		})().catch(() => {
			if (!cancelled) setQrExpired(true);
		});

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [isTwoFactor, twoFactorMethod, qrNonce, router]);

	const onSecurityKeySubmit = async () => {
		if (!securityKeyOptions) return;

		setIsSecurityKeyLoading(true);
		try {
			const assertion = await startAuthentication({
				optionsJSON: securityKeyOptions,
			});
			const { token, error: verifyError } =
				await verifyWebAuthnTwoFactor(assertion);

			if (verifyError || !token) {
				const message =
					verifyError?.message ??
					"The security key could not be verified. Try again.";
				toast.error(message);
				setError(message);
				// The challenge is single use: fetch a fresh one for the retry.
				await loadSecurityKeyOptions();
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/home");
		} catch (caught) {
			if (!isCeremonyCancellation(caught)) {
				const message =
					caught instanceof Error
						? caught.message
						: "The security key could not be verified. Try again.";
				toast.error(message);
				setError(message);
				await loadSecurityKeyOptions();
			}
		} finally {
			setIsSecurityKeyLoading(false);
		}
	};

	const onSubmit = async (values: LoginForm) => {
		setIsLoginLoading(true);
		try {
			const { data, error } = await authClient.signIn.email({
				email: values.email,
				password: values.password,
			});

			if (error) {
				const isEmailNotVerified =
					error.code === "EMAIL_NOT_VERIFIED" ||
					error.message?.toLowerCase().includes("email not verified");
				if (isEmailNotVerified) {
					const msg =
						"Your email is not verified. We've sent a new verification link to your email.";
					toast.info(msg);
					setError(msg);
					return;
				}
				toast.error(error.message);
				setError(error.message || "An error occurred while logging in");
				return;
			}

			if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
				setTwoFactorCode("");
				setSecurityKeyOptions(null);
				setHasSecurityKey(false);
				setHasNoSecurityKey(false);
				setTwoFactorMethod(null);
				setIsTwoFactor(true);
				await loadTwoFactorMethod();
				toast.info("Please complete your second factor");
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/home");
		} catch {
			toast.error("An error occurred while logging in");
		} finally {
			setIsLoginLoading(false);
		}
	};
	const onTwoFactorSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		// Key-only accounts have no code input: Enter must not reach this path.
		if (twoFactorMethod === "securityKey") return;
		if (twoFactorCode.length !== 6) {
			toast.error("Please enter a valid 6-digit code");
			return;
		}

		setIsTwoFactorLoading(true);
		try {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: twoFactorCode.replace(/\s/g, ""),
			});

			if (error) {
				toast.error(error.message);
				setError(error.message || "An error occurred while verifying 2FA code");
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/home");
		} catch {
			toast.error("An error occurred while verifying 2FA code");
		} finally {
			setIsTwoFactorLoading(false);
		}
	};

	const onBackupCodeSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (backupCode.length < 8) {
			toast.error("Please enter a valid backup code");
			return;
		}

		setIsBackupCodeLoading(true);
		try {
			// A key-only account has its own single-use codes: better-auth's are
			// tied to an authenticator app it does not have.
			const { token, error: securityKeyError } =
				twoFactorMethod === "securityKey"
					? await verifySecurityKeyBackupCode(backupCode.trim())
					: { token: null, error: null };

			if (twoFactorMethod === "securityKey") {
				if (securityKeyError || !token) {
					const message =
						securityKeyError?.message ??
						"This backup code is invalid or was already used.";
					toast.error(message);
					setError(message);
					return;
				}

				toast.success("Logged in successfully");
				router.push("/dashboard/home");
				return;
			}

			const { error } = await authClient.twoFactor.verifyBackupCode({
				code: backupCode.trim(),
			});

			if (error) {
				toast.error(error.message);
				setError(
					error.message || "An error occurred while verifying backup code",
				);
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/home");
		} catch {
			toast.error("An error occurred while verifying backup code");
		} finally {
			setIsBackupCodeLoading(false);
		}
	};

	const loginContent = (
		<>
			{IS_CLOUD && <SignInWithGithub />}
			{IS_CLOUD && <SignInWithGoogle />}
			<Form {...loginForm}>
				<form
					method="post"
					onSubmit={loginForm.handleSubmit(onSubmit)}
					className="space-y-4"
					id="login-form"
				>
					<FormField
						control={loginForm.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input placeholder="john@example.com" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={loginForm.control}
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
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button className="w-full" type="submit" isLoading={isLoginLoading}>
						Login
					</Button>
				</form>
			</Form>
		</>
	);

	return (
		<>
			<div className="flex flex-col space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">
					<div className="flex flex-row items-center justify-center gap-2">
						<Logo
							className="size-12"
							logoUrl={
								whitelabeling?.loginLogoUrl ||
								whitelabeling?.logoUrl ||
								undefined
							}
						/>
						Sign in
					</div>
				</h1>
				<p className="text-sm text-muted-foreground">
					Enter your email and password to sign in
				</p>
			</div>
			{error && (
				<AlertBlock type="error" className="my-2">
					<span>{error}</span>
				</AlertBlock>
			)}
			<CardContent className="p-0">
				{!isTwoFactor ? (
					<>
						{/* Managed cloud keeps the SSO button (an organization may not have a
						    source); self-hosted shows the source directly once configured and
						    otherwise keeps the local form. */}
						{IS_CLOUD ? (
							<SignInWithSSO>{loginContent}</SignInWithSSO>
						) : enforceSSO ? (
							<SignInWithSSO enforce />
						) : (
							loginContent
						)}
					</>
				) : (
					<>
						<form
							method="post"
							onSubmit={onTwoFactorSubmit}
							className="space-y-4"
							id="two-factor-form"
							autoComplete="on"
						>
							<div className="flex flex-col gap-2">
								{twoFactorMethod === "securityKey" ? (
									<>
										<Label>Scan to approve</Label>
										{qrExpired ? (
											<div className="flex flex-col items-center gap-2 rounded-lg border p-4">
												<CardDescription>
													This QR code expired.
												</CardDescription>
												<Button
													type="button"
													variant="outline"
													onClick={() => setQrNonce((nonce) => nonce + 1)}
												>
													Show a new QR code
												</Button>
											</div>
										) : qrCodeUrl ? (
											<div className="flex flex-col items-center gap-2 rounded-lg border p-4">
												{/** biome-ignore lint/performance/noImgElement: generated data URL */}
												<img
													src={qrCodeUrl}
													alt="QR code to approve this sign-in"
													className="size-44 rounded bg-white p-2"
												/>
												<CardDescription className="text-center">
													Scan with your phone while signed in to this account to
													approve the sign-in.
												</CardDescription>
											</div>
										) : (
											<div className="flex items-center justify-center rounded-lg border p-6">
												<Loader2 className="size-5 animate-spin text-muted-foreground" />
											</div>
										)}
										<div className="my-1 flex items-center gap-3">
											<span className="h-px flex-1 bg-border" />
											<span className="text-xs uppercase text-muted-foreground">
												or
											</span>
											<span className="h-px flex-1 bg-border" />
										</div>
										<Button
											variant="outline"
											className="w-full"
											type="button"
											disabled={!securityKeyOptions}
											isLoading={isSecurityKeyLoading}
											onClick={onSecurityKeySubmit}
										>
											<Fingerprint className="size-4" />
											Use a security key on this device
										</Button>
										{hasNoSecurityKey && (
											<CardDescription>
												No security key could be used for this sign-in. Use one
												of your backup codes instead.
											</CardDescription>
										)}
									</>
								) : (
									<>
										<Label htmlFor="totp-code">2FA Code</Label>
										<InputOTP
											id="totp-code"
											name="totp"
											value={twoFactorCode}
											onChange={setTwoFactorCode}
											maxLength={6}
											pattern={REGEXP_ONLY_DIGITS}
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
										<CardDescription>
											Enter the 6-digit code from your authenticator app
										</CardDescription>{" "}
										<button
											type="button"
											onClick={() => setIsBackupCodeModalOpen(true)}
											className="text-sm text-muted-foreground hover:underline self-start mt-2"
										>
											Lost access to your authenticator app?
										</button>
										{isWebAuthnSupported && hasSecurityKey && (
											<>
												<div className="flex items-center gap-3 my-1">
													<span className="h-px flex-1 bg-border" />
													<span className="text-xs uppercase text-muted-foreground">
														or
													</span>
													<span className="h-px flex-1 bg-border" />
												</div>
												<Button
													variant="outline"
													className="w-full"
													type="button"
													disabled={!securityKeyOptions}
													isLoading={isSecurityKeyLoading}
													onClick={onSecurityKeySubmit}
												>
													<Fingerprint className="size-4" />
													Use a security key
												</Button>{" "}
												<CardDescription>
													Use a hardware key or a security key stored in your
													browser or password manager (Bitwarden, 1Password,
													iCloud Keychain).
												</CardDescription>
											</>
										)}
										{isWebAuthnSupported && hasNoSecurityKey && (
											<CardDescription>
												No security key is registered on this account. After
												signing in, add one from Profile → Security to use it
												next time.
											</CardDescription>
										)}
									</>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<Button
									variant="outline"
									className="w-full"
									type="button"
									onClick={() => {
										setIsTwoFactor(false);
										setTwoFactorCode("");
										setTwoFactorMethod(null);
										setQrCodeUrl(null);
										setQrExpired(false);
										setSecurityKeyOptions(null);
										setHasSecurityKey(false);
										setHasNoSecurityKey(false);
										setError(null);
									}}
								>
									Back
								</Button>
								{twoFactorMethod === "securityKey" ? (
									<Button
										className="w-full"
										type="button"
										onClick={() => setIsBackupCodeModalOpen(true)}
									>
										Use a backup code
									</Button>
								) : (
									<Button
										className="w-full"
										type="submit"
										isLoading={isTwoFactorLoading}
									>
										Verify
									</Button>
								)}
							</div>
						</form>

						<Dialog
							open={isBackupCodeModalOpen}
							onOpenChange={setIsBackupCodeModalOpen}
						>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Enter Backup Code</DialogTitle>
									<DialogDescription>
										Enter one of your backup codes to access your account
									</DialogDescription>
								</DialogHeader>

								<form
									method="post"
									onSubmit={onBackupCodeSubmit}
									className="space-y-4"
								>
									<div className="flex flex-col gap-2">
										<Label>Backup Code</Label>
										<Input
											value={backupCode}
											onChange={(e) => setBackupCode(e.target.value)}
											placeholder="Enter your backup code"
											className="font-mono"
										/>
										<CardDescription>
											Enter one of the backup codes you received when setting up
											2FA
										</CardDescription>
									</div>

									<div className="flex gap-4">
										<Button
											variant="outline"
											className="w-full"
											type="button"
											onClick={() => {
												setIsBackupCodeModalOpen(false);
												setBackupCode("");
											}}
										>
											Cancel
										</Button>
										<Button
											className="w-full"
											type="submit"
											isLoading={isBackupCodeLoading}
										>
											Verify
										</Button>
									</div>
								</form>
							</DialogContent>
						</Dialog>
					</>
				)}

				<div className="flex flex-row justify-between flex-wrap">
					<div className="mt-4 text-center text-sm flex flex-row justify-center gap-2">
						{IS_CLOUD && (
							<Link
								className="hover:underline text-muted-foreground"
								href="/register"
							>
								Create an account
							</Link>
						)}
					</div>

					<div className="mt-4 text-sm flex flex-row justify-center gap-2">
						{IS_CLOUD ? (
							<Link
								className="hover:underline text-muted-foreground"
								href="/send-reset-password"
							>
								Lost your password?
							</Link>
						) : (
							<Link
								className="hover:underline text-muted-foreground"
								href="https://docs.notploy.com/docs/core/reset-password"
								target="_blank"
							>
								Lost your password?
							</Link>
						)}
					</div>
				</div>
				<div className="p-2" />
			</CardContent>
		</>
	);
}

Home.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};
export async function getServerSideProps(context: GetServerSidePropsContext) {
	const helpers = generateServerSideHelper(appRouter, context);
	// Prefetch the public branding so the login/onboarding logo and app name
	// render correctly on the server (no flash of default branding).
	await helpers.whitelabeling.getPublic.prefetch();

	if (IS_CLOUD) {
		try {
			const { user } = await validateRequest(context.req);
			if (user) {
				return {
					redirect: {
						permanent: false,
						destination: "/dashboard/home",
					},
				};
			}
		} catch {}

		return {
			props: {
				trpcState: helpers.dehydrate(),
				IS_CLOUD: IS_CLOUD,
				enforceSSO: false,
			},
		};
	}
	const hasAdmin = await isAdminPresent();

	if (!hasAdmin) {
		return {
			redirect: {
				permanent: false,
				destination: "/register",
			},
		};
	}

	const { user } = await validateRequest(context.req);

	if (user) {
		return {
			redirect: {
				permanent: false,
				destination: "/dashboard/home",
			},
		};
	}

	const webServerSettings = await getWebServerSettings();

	return {
		props: {
			trpcState: helpers.dehydrate(),
			hasAdmin,
			enforceSSO: webServerSettings?.enforceSSO ?? false,
		},
	};
}
