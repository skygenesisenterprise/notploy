import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import {
	Building2,
	KeyRound,
	Loader2,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import superjson from "superjson";
import { ShowApiKeys } from "@/components/dashboard/settings/api/show-api-keys";
import { LinkingAccount } from "@/components/dashboard/settings/linking-account/linking-account";
import { Configure2FA } from "@/components/dashboard/settings/profile/configure-2fa";
import { Enable2FA } from "@/components/dashboard/settings/profile/enable-2fa";
import { ManageSecurityKeys } from "@/components/dashboard/settings/profile/manage-security-keys";
import { ProfileForm } from "@/components/dashboard/settings/profile/profile-form";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { AlertBlock } from "@/components/shared/alert-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, getFallbackAvatarInitials } from "@/lib/utils";
import {
	getTwoFactorMethod,
	setTwoFactorMethod,
	type TwoFactorMethod,
	type TwoFactorMethodSummary,
} from "@/lib/webauthn-two-factor";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

const Page = () => {
	const [activeSection, setActiveSection] = useState("identity");
	const {
		data: membership,
		isPending: userPending,
		isError: userIsError,
		error: userError,
	} = api.user.get.useQuery();
	const {
		data: organization,
		isPending: organizationPending,
		isError: organizationIsError,
	} = api.organization.active.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const utils = api.useUtils();
	const user = membership?.user;
	const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
	const canReadApiKeys = !!permissions?.api.read;

	// The factor the account must present after its password. `null` covers
	// accounts that never picked one (legacy TOTP accounts, 2FA disabled).
	const twoFactorMethod =
		user?.twoFactorMethod === "securityKey"
			? "securityKey"
			: user?.twoFactorMethod === "totp"
				? "totp"
				: null;
	const isSecurityKeyMethod = twoFactorMethod === "securityKey";
	const isTotpMethod = twoFactorMethod === "totp";
	const twoFactorDescription = !user?.twoFactorEnabled
		? "Two-factor authentication is not configured. Choose how you verify your sign-in."
		: isSecurityKeyMethod
			? "A security key is required after your password."
			: isTotpMethod
				? "An authenticator code is required after your password."
				: "Both factors are currently accepted after your password.";

	// What is actually enrolled (a key, an authenticator secret), so the card can
	// offer to switch to a factor that already exists instead of re-creating it.
	const [twoFactorSummary, setTwoFactorSummary] =
		useState<TwoFactorMethodSummary | null>(null);
	const [switchingMethod, setSwitchingMethod] =
		useState<TwoFactorMethod | null>(null);

	const refreshTwoFactorSummary = useCallback(async () => {
		try {
			const { summary } = await getTwoFactorMethod();
			setTwoFactorSummary(summary);
		} catch {
			setTwoFactorSummary(null);
		}
	}, []);

	useEffect(() => {
		void refreshTwoFactorSummary();
	}, [refreshTwoFactorSummary, user?.twoFactorEnabled, user?.twoFactorMethod]);

	const handleSwitchMethod = async (method: TwoFactorMethod) => {
		setSwitchingMethod(method);
		try {
			const result = await setTwoFactorMethod(method);
			if (result.error) {
				toast.error(
					result.error.message || "Could not change the two-factor method",
				);
				return;
			}

			toast.success(
				method === "securityKey"
					? "Security key required after your password"
					: "Authenticator codes required after your password",
			);
			await utils.user.get.invalidate();
		} finally {
			setSwitchingMethod(null);
		}
	};

	useEffect(() => {
		const syncSectionFromHash = () => {
			const section = window.location.hash.slice(1);
			if (section === "developer-access" && permissions === undefined) return;
			if (section === "developer-access" && !canReadApiKeys) {
				setActiveSection("identity");
				return;
			}
			setActiveSection(
				["security", "developer-access"].includes(section)
					? section
					: "identity",
			);
		};

		syncSectionFromHash();
		window.addEventListener("popstate", syncSectionFromHash);
		return () => window.removeEventListener("popstate", syncSectionFromHash);
	}, [canReadApiKeys, permissions]);

	const selectSection = (section: string) => {
		setActiveSection(section);
		const hash = section === "identity" ? "" : `#${section}`;
		window.history.pushState(
			null,
			"",
			`${window.location.pathname}${window.location.search}${hash}`,
		);
	};

	return (
		<Card className="h-[calc(100dvh-5rem)] w-full overflow-hidden rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden rounded-xl bg-background p-4 shadow-md sm:gap-5 sm:p-6">
				<header className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Manage your personal Notploy account and preferences.
						</p>
					</div>

					{userPending ? (
						<div className="flex min-h-14 items-center justify-center rounded-lg border px-4 sm:min-w-64">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : userIsError ? (
						<AlertBlock type="error">
							{userError instanceof Error
								? userError.message
								: "Unable to load your account."}
						</AlertBlock>
					) : user ? (
						<div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-3 sm:min-w-64">
							<Avatar className="size-11">
								<AvatarImage
									src={user.image ?? ""}
									alt={fullName || user.email}
								/>
								<AvatarFallback>
									{getFallbackAvatarInitials(fullName)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold">
									{fullName || user.email}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{user.email}
								</p>
							</div>
							<Building2 className="size-4 shrink-0 text-muted-foreground" />
							<div className="max-w-36 min-w-0">
								<p className="text-xs text-muted-foreground">Organization</p>
								<p className="truncate text-sm font-medium">
									{organizationPending
										? "Loading…"
										: (organization?.name ?? "No active organization")}
								</p>
							</div>
						</div>
					) : (
						<AlertBlock type="error">
							Your account information is unavailable.
						</AlertBlock>
					)}
				</header>

				{organizationIsError && (
					<AlertBlock type="error">
						Unable to load your active organization.
					</AlertBlock>
				)}

				{user && (
					<Tabs
						orientation="vertical"
						value={activeSection}
						onValueChange={selectSection}
						className="min-h-0 flex-1 flex-col gap-4 overflow-hidden max-md:flex-col md:flex-row md:gap-6"
					>
						<TabsList
							variant="line"
							className="grid w-full shrink-0 grid-cols-2 items-stretch justify-start gap-1 border-b bg-transparent p-0 pb-2 md:flex md:w-48 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-3"
						>
							<TabsTrigger
								value="identity"
								className="h-auto min-h-9 justify-start whitespace-normal px-2 text-left sm:px-3"
							>
								<UserRound aria-hidden />
								Personal information
							</TabsTrigger>
							<TabsTrigger
								value="security"
								className="h-auto min-h-9 justify-start whitespace-normal px-2 text-left sm:px-3"
							>
								<ShieldCheck aria-hidden />
								Security
							</TabsTrigger>
							{canReadApiKeys && (
								<TabsTrigger
									value="developer-access"
									className="h-auto min-h-9 justify-start whitespace-normal px-2 text-left sm:px-3"
								>
									<KeyRound aria-hidden />
									Developer access
								</TabsTrigger>
							)}
						</TabsList>

						<TabsContent
							value="identity"
							className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
						>
							<div className="space-y-4">
								<ProfileForm />
								{isCloud && <LinkingAccount />}
							</div>
						</TabsContent>

						<TabsContent
							value="security"
							className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
						>
							<div className="mb-4">
								<h2 className="text-xl font-semibold">Security</h2>
								<p className="text-sm text-muted-foreground">
									Review the security of your personal account.
								</p>
							</div>
							<div className="grid gap-4">
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-lg">
											<ShieldCheck className="size-5 text-muted-foreground" />
											Two-factor authentication
										</CardTitle>
										<CardDescription>{twoFactorDescription}</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3 border-t pt-5">
										{user.twoFactorEnabled && twoFactorMethod === null && (
											<p className="text-sm text-muted-foreground">
												Pick one of the two factors so every sign-in asks for
												the same thing.
											</p>
										)}
										<div className="grid gap-3 sm:grid-cols-2">
											<div
												className={cn(
													"flex flex-col gap-2 rounded-lg border p-3",
													isTotpMethod && "border-primary/60 bg-primary/5",
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<p className="font-medium">Authenticator app</p>
													{isTotpMethod && (
														<Badge variant="outline">Current</Badge>
													)}
												</div>
												<p className="text-sm text-muted-foreground">
													Approve each sign-in with a 6-digit code from an app
													such as 1Password, Authy or Google Authenticator.
												</p>
												<div className="mt-auto pt-2">
													{isTotpMethod ? (
														<Configure2FA />
													) : user.twoFactorEnabled &&
														twoFactorSummary?.hasTotp ? (
														<Button
															variant="outline"
															size="sm"
															isLoading={switchingMethod === "totp"}
															onClick={() => handleSwitchMethod("totp")}
														>
															Use codes
														</Button>
													) : (
														<Enable2FA
															label={
																user.twoFactorEnabled
																	? "Set up codes"
																	: "Choose codes"
															}
														/>
													)}
												</div>
											</div>
											<div
												className={cn(
													"flex flex-col gap-2 rounded-lg border p-3",
													isSecurityKeyMethod &&
														"border-primary/60 bg-primary/5",
												)}
											>
												<div className="flex items-center justify-between gap-2">
													<p className="font-medium">Security key</p>
													{isSecurityKeyMethod && (
														<Badge variant="outline">Current</Badge>
													)}
												</div>
												<p className="text-sm text-muted-foreground">
													Approve each sign-in with a hardware key or a passkey
													stored in your browser or password manager. Recovery
													codes are issued with it.
												</p>
												<div className="mt-auto pt-2">
													{isSecurityKeyMethod ? (
														<ManageSecurityKeys
															onChanged={refreshTwoFactorSummary}
														/>
													) : user.twoFactorEnabled &&
														twoFactorSummary?.hasSecurityKey ? (
														<Button
															variant="outline"
															size="sm"
															isLoading={switchingMethod === "securityKey"}
															onClick={() => handleSwitchMethod("securityKey")}
														>
															Use security key
														</Button>
													) : (
														<ManageSecurityKeys
															onChanged={refreshTwoFactorSummary}
														/>
													)}
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						{canReadApiKeys && (
							<TabsContent
								value="developer-access"
								className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
							>
								<div className="mb-4">
									<h2 className="text-xl font-semibold">Developer access</h2>
									<p className="text-sm text-muted-foreground">
										Manage the API keys that authenticate your tools.
									</p>
								</div>
								<div className="grid gap-4">
									<ShowApiKeys />
								</div>
							</TabsContent>
						)}
					</Tabs>
				)}
			</div>
		</Card>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Profile">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
	const { req, res } = ctx;
	const { user, session } = await validateRequest(req);

	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: req as any,
			res: res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});

	await Promise.all([
		helpers.settings.isCloud.prefetch(),
		helpers.user.get.prefetch(),
		helpers.organization.active.prefetch(),
		helpers.user.getPermissions.prefetch(),
	]);

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
}
