import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { format } from "date-fns";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { DEFAULT_GITHUB_URL, resolveGithubBaseUrl } from "@/utils/github-utils";
import { getGiteaOAuthUrl } from "@/utils/gitea-utils";
import { useUrl } from "@/utils/hooks/use-url";
import { GitCapabilityMatrix } from "./git-capability-matrix";
import {
	gitProviderCategoryByType,
	gitProviderCategoryDescriptions,
	gitProviderCategoryLabels,
	gitProviderCategoryOrder,
	gitProviderIcon,
	gitProviderLabel,
	gitProviderTypeOrder,
	type GitProviderType,
} from "./git-provider-meta";

/**
 * Unified Add / Edit Git Provider dialog.
 *
 * Follows the same shape as `HandleDnsProvider`: one entry point, a provider
 * type selected from a grouped list, then the credentials for that type. The
 * provider *type* (GitHub, GitLab, …) is chosen here; the *connection*
 * (name + endpoint + credentials) is what the form actually creates, so the
 * same type can be connected several times against SaaS or self-hosted
 * endpoints.
 *
 * The authorization flows differ per provider (a GitHub App manifest, a GitLab/
 * Gitea OAuth grant, a Bitbucket API token), so the content switches on the
 * selected type while the shell, the empty/loading states and the actions stay
 * identical — the provider-specific logic is not duplicated across the page.
 */

const gitProviderSchema = z.object({
	providerType: z.enum(gitProviderTypeOrder),
	name: z.string(),
	// Endpoint of the instance, shared by the types that accept a custom host.
	endpoint: z.string(),
	internalUrl: z.string(),
	// GitLab
	applicationId: z.string(),
	applicationSecret: z.string(),
	groupName: z.string(),
	// Gitea
	clientId: z.string(),
	clientSecret: z.string(),
	// Bitbucket
	username: z.string(),
	email: z.string(),
	apiToken: z.string(),
	appPassword: z.string(),
	workspaceName: z.string(),
	// GitHub
	appName: z.string(),
	isOrganization: z.boolean(),
	organizationName: z.string(),
});

type GitProviderForm = z.infer<typeof gitProviderSchema>;

const defaultValues: GitProviderForm = {
	providerType: "github",
	name: "",
	endpoint: "",
	internalUrl: "",
	applicationId: "",
	applicationSecret: "",
	groupName: "",
	clientId: "",
	clientSecret: "",
	username: "",
	email: "",
	apiToken: "",
	appPassword: "",
	workspaceName: "",
	appName: "",
	isOrganization: false,
	organizationName: "",
};

const baseUrlOf = (value: string | { url?: string }): string =>
	typeof value === "string" ? value : (value?.url ?? "");

const extractErrorMessage = (err: unknown) => {
	if (!(err instanceof Error)) return undefined;
	return err.message;
};

interface Props {
	trigger?: ReactNode;
	defaultProviderType?: GitProviderType;
	/** Edit mode: the provider row plus its type-specific child id. */
	gitProviderId?: string;
	providerType?: GitProviderType;
	providerId?: string;
}

export const HandleGitProvider = ({
	trigger,
	defaultProviderType,
	gitProviderId,
	providerType: initialProviderType,
	providerId,
}: Props) => {
	const utils = api.useUtils();
	const url = useUrl();
	const [isOpen, setIsOpen] = useState(false);

	const isEdit = Boolean(gitProviderId && initialProviderType && providerId);

	const { data: user } = api.user.get.useQuery();
	const { data: session } = api.user.session.useQuery();
	const { data: activeOrganization } = api.organization.active.useQuery();
	const { data: descriptors } = api.gitProvider.descriptors.useQuery(
		undefined,
		{ enabled: !isEdit && isOpen },
	);

	// Type-specific rows, loaded only in edit mode so the form can be prefilled.
	// Secrets are returned to the owner/admin only; this mirrors the previous
	// per-provider edit dialogs and does not widen that access.
	const githubQuery = api.github.one.useQuery(
		{ githubId: providerId ?? "" },
		{ enabled: isEdit && initialProviderType === "github" && isOpen },
	);
	const gitlabQuery = api.gitlab.one.useQuery(
		{ gitlabId: providerId ?? "" },
		{ enabled: isEdit && initialProviderType === "gitlab" && isOpen },
	);
	const giteaQuery = api.gitea.one.useQuery(
		{ giteaId: providerId ?? "" },
		{ enabled: isEdit && initialProviderType === "gitea" && isOpen },
	);
	const bitbucketQuery = api.bitbucket.one.useQuery(
		{ bitbucketId: providerId ?? "" },
		{ enabled: isEdit && initialProviderType === "bitbucket" && isOpen },
	);

	const githubCreate = api.github.update.useMutation();
	const gitlabCreate = api.gitlab.create.useMutation();
	const gitlabUpdate = api.gitlab.update.useMutation();
	const giteaCreate = api.gitea.create.useMutation();
	const giteaUpdate = api.gitea.update.useMutation();
	const bitbucketCreate = api.bitbucket.create.useMutation();
	const bitbucketUpdate = api.bitbucket.update.useMutation();

	const githubTest = api.github.testConnection.useMutation();
	const gitlabTest = api.gitlab.testConnection.useMutation();
	const giteaTest = api.gitea.testConnection.useMutation();
	const bitbucketTest = api.bitbucket.testConnection.useMutation();

	const form = useForm<GitProviderForm>({
		defaultValues: {
			...defaultValues,
			...(defaultProviderType
				? {
						providerType: defaultProviderType,
						endpoint:
							defaultProviderType === "bitbucket"
								? ""
								: (defaultValues.endpoint || ""),
					}
				: {}),
		},
		resolver: zodResolver(gitProviderSchema),
	});

	const providerType = form.watch("providerType");
	const isOrganization = form.watch("isOrganization");

	const providerGroups = useMemo(
		() =>
			gitProviderCategoryOrder
				.map((category) => ({
					category,
					types: gitProviderTypeOrder.filter(
						(type) => gitProviderCategoryByType[type] === category,
					),
				}))
				.filter((group) => group.types.length > 0),
		[],
	);

	const selectedDescriptor = descriptors?.find(
		(d) => d.providerType === providerType,
	);

	// GitHub App creation needs a manifest built from the current origin.
	const githubBase = resolveGithubBaseUrl(
		form.watch("endpoint") || DEFAULT_GITHUB_URL,
	);
	const origin = typeof window === "undefined" ? "" : document.location.origin;
	const randomString = () => Math.random().toString(36).slice(2, 8);
	const githubManifest = useMemo(() => {
		if (typeof window === "undefined") return "";
		return JSON.stringify(
			{
				redirect_url: `${origin}/api/providers/github/setup?organizationId=${
					activeOrganization?.id ?? ""
				}&userId=${session?.user?.id ?? ""}&githubUrl=${encodeURIComponent(
					githubBase.baseUrl,
				)}`,
				name: `Notploy-${format(new Date(), "yyyy-MM-dd")}-${randomString()}`,
				url: origin,
				hook_attributes: { url: `${origin}/api/deploy/github` },
				callback_urls: [`${origin}/api/providers/github/setup`],
				public: false,
				request_oauth_on_install: true,
				default_permissions: {
					contents: "read",
					metadata: "read",
					emails: "read",
					pull_requests: "write",
				},
				default_events: ["pull_request", "push"],
			},
			null,
			4,
		);
	}, [activeOrganization?.id, session?.user?.id, githubBase.baseUrl, origin]);

	// Reset the form when the dialog opens: defaults for create, the loaded
	// connection for edit.
	useEffect(() => {
		if (!isOpen) return;

		if (!isEdit) {
			form.reset({
				...defaultValues,
				...(defaultProviderType
					? { providerType: defaultProviderType }
					: {}),
			});
			return;
		}

		switch (initialProviderType) {
			case "github": {
				const github = githubQuery.data;
				if (github) {
					form.reset({
						...defaultValues,
						providerType: "github",
						name: github.gitProvider?.name ?? "",
						endpoint: github.githubUrl ?? DEFAULT_GITHUB_URL,
						appName: github.githubAppName ?? "",
					});
				}
				break;
			}
			case "gitlab": {
				const gitlab = gitlabQuery.data;
				if (gitlab) {
					form.reset({
						...defaultValues,
						providerType: "gitlab",
						name: gitlab.gitProvider?.name ?? "",
						endpoint: gitlab.gitlabUrl ?? "https://gitlab.com",
						internalUrl: gitlab.gitlabInternalUrl ?? "",
						groupName: gitlab.groupName ?? "",
					});
				}
				break;
			}
			case "gitea": {
				const gitea = giteaQuery.data;
				if (gitea) {
					form.reset({
						...defaultValues,
						providerType: "gitea",
						name: gitea.gitProvider?.name ?? "",
						endpoint: gitea.giteaUrl ?? "https://gitea.com",
						internalUrl: gitea.giteaInternalUrl ?? "",
						clientId: gitea.clientId ?? "",
						clientSecret: gitea.clientSecret ?? "",
					});
				}
				break;
			}
			case "bitbucket": {
				const bitbucket = bitbucketQuery.data;
				if (bitbucket) {
					form.reset({
						...defaultValues,
						providerType: "bitbucket",
						name: bitbucket.gitProvider?.name ?? "",
						username: bitbucket.bitbucketUsername ?? "",
						email: bitbucket.bitbucketEmail ?? "",
						apiToken: bitbucket.apiToken ?? "",
						appPassword: bitbucket.appPassword ?? "",
						workspaceName: bitbucket.bitbucketWorkspaceName ?? "",
					});
				}
				break;
			}
		}
	}, [
		isOpen,
		isEdit,
		initialProviderType,
		defaultProviderType,
		form,
		githubQuery.data,
		gitlabQuery.data,
		giteaQuery.data,
		bitbucketQuery.data,
	]);

	const editGitProviderId = () =>
		githubQuery.data?.gitProviderId ??
		gitlabQuery.data?.gitProviderId ??
		giteaQuery.data?.gitProviderId ??
		bitbucketQuery.data?.gitProviderId ??
		gitProviderId ??
		"";

	const validate = (data: GitProviderForm): string | null => {
		if (providerType === "github") {
			if (!isEdit) return null; // manifest flow navigates away
			if (!data.name.trim()) return "Name is required";
			if (!data.appName.trim()) return "App name is required";
			return null;
		}
		if (!data.name.trim()) return "Name is required";
		switch (providerType) {
			case "gitlab":
				if (!data.endpoint.trim()) return "GitLab URL is required";
				if (!data.applicationId.trim()) return "Application ID is required";
				if (!data.applicationSecret.trim())
					return "Application Secret is required";
				return null;
			case "gitea":
				if (!data.endpoint.trim()) return "Gitea URL is required";
				if (!data.clientId.trim()) return "Client ID is required";
				if (!data.clientSecret.trim()) return "Client Secret is required";
				return null;
			case "bitbucket":
				if (!data.username.trim()) return "Username is required";
				if (!data.apiToken.trim()) return "API Token is required";
				return null;
			default:
				return null;
		}
	};

	const afterSuccess = (message: string) => {
		toast.success(message);
		utils.gitProvider.getAll.invalidate();
		setIsOpen(false);
	};

	const onSubmit = async (data: GitProviderForm) => {
		const invalid = validate(data);
		if (invalid) {
			toast.error(invalid);
			return;
		}

		if (isEdit) {
			const providerIdValue = editGitProviderId();
			switch (initialProviderType) {
				case "github":
					await githubCreate
						.mutateAsync({
							githubId: providerId ?? "",
							name: data.name,
							gitProviderId: providerIdValue,
							githubAppName: data.appName,
						})
						.then(() => afterSuccess("GitHub connection updated"))
						.catch(() => toast.error("Error updating GitHub"));
					return;
				case "gitlab":
					await gitlabUpdate
						.mutateAsync({
							gitlabId: providerId ?? "",
							gitProviderId: providerIdValue,
							groupName: data.groupName || "",
							name: data.name,
							gitlabUrl: data.endpoint,
							gitlabInternalUrl: data.internalUrl || null,
						})
						.then(() => afterSuccess("GitLab connection updated"))
						.catch(() => toast.error("Error updating GitLab"));
					return;
				case "gitea":
					await giteaUpdate
						.mutateAsync({
							giteaId: providerId ?? "",
							gitProviderId: providerIdValue,
							name: data.name,
							giteaUrl: data.endpoint,
							giteaInternalUrl: data.internalUrl || null,
							clientId: data.clientId,
							clientSecret: data.clientSecret,
						})
						.then(() => afterSuccess("Gitea connection updated"))
						.catch(() => toast.error("Error updating Gitea"));
					return;
				case "bitbucket":
					await bitbucketUpdate
						.mutateAsync({
							bitbucketId: providerId ?? "",
							gitProviderId: providerIdValue,
							bitbucketUsername: data.username,
							bitbucketEmail: data.email || "",
							bitbucketWorkspaceName: data.workspaceName || "",
							name: data.name,
							apiToken: data.apiToken,
							appPassword: data.appPassword,
						})
						.then(() => afterSuccess("Bitbucket connection updated"))
						.catch(() => toast.error("Error updating Bitbucket"));
					return;
			}
		}

		const baseUrl = baseUrlOf(url);
		switch (providerType) {
			case "gitlab":
				await gitlabCreate
					.mutateAsync({
						applicationId: data.applicationId,
						secret: data.applicationSecret,
						groupName: data.groupName || "",
						authId: user?.id ?? "",
						name: data.name,
						redirectUri: `${baseUrl}/api/providers/gitlab/callback`,
						gitlabUrl: data.endpoint,
						gitlabInternalUrl: data.internalUrl || undefined,
					})
					.then(() => afterSuccess("GitLab connection created"))
					.catch(() => toast.error("Error configuring GitLab"));
				return;
			case "gitea": {
				try {
					const result = (await giteaCreate.mutateAsync({
						clientId: data.clientId,
						clientSecret: data.clientSecret,
						name: data.name,
						redirectUri: `${baseUrl}/api/providers/gitea/callback`,
						giteaUrl: data.endpoint,
						giteaInternalUrl: data.internalUrl || undefined,
						organizationName: data.organizationName || undefined,
					})) as { giteaId?: string };
					if (!result?.giteaId) {
						toast.error("Failed to get the Gitea id from the response");
						return;
					}
					const authUrl = getGiteaOAuthUrl(
						result.giteaId,
						data.clientId,
						data.endpoint,
						baseUrl,
					);
					if (authUrl !== "#") window.open(authUrl, "_blank");
					afterSuccess("Gitea connection created");
				} catch {
					toast.error("Error configuring Gitea");
				}
				return;
			}
			case "bitbucket":
				await bitbucketCreate
					.mutateAsync({
						bitbucketUsername: data.username,
						apiToken: data.apiToken,
						bitbucketWorkspaceName: data.workspaceName || "",
						authId: user?.id ?? "",
						name: data.name,
						bitbucketEmail: data.email || "",
					})
					.then(() => afterSuccess("Bitbucket connection created"))
					.catch(() => toast.error("Error configuring Bitbucket"));
				return;
			default:
				return;
		}
	};

	const onTestConnection = async () => {
		switch (initialProviderType) {
			case "github":
				await githubTest
					.mutateAsync({ githubId: providerId ?? "" })
					.then((message) => toast.info(`Message: ${message}`))
					.catch((error) =>
						toast.error(`Error: ${extractErrorMessage(error)}`),
					);
				return;
			case "gitlab":
				await gitlabTest
					.mutateAsync({
						gitlabId: providerId ?? "",
						groupName: form.getValues("groupName") || "",
					})
					.then((message) => toast.info(`Message: ${message}`))
					.catch((error) =>
						toast.error(`Error: ${extractErrorMessage(error)}`),
					);
				return;
			case "gitea":
				await giteaTest
					.mutateAsync({ giteaId: providerId ?? "" })
					.then((message) => toast.success("Gitea connection verified", { description: message }))
					.catch((error) => {
						const values = form.getValues();
						const authUrl = getGiteaOAuthUrl(
							providerId ?? "",
							values.clientId,
							values.endpoint,
							baseUrlOf(url),
						);
						toast.error("Gitea not connected", {
							description: extractErrorMessage(error),
							action:
								authUrl && authUrl !== "#"
									? {
											label: "Authorize now",
											onClick: () => window.open(authUrl, "_blank"),
										}
									: undefined,
						});
					});
				return;
			case "bitbucket": {
				const values = form.getValues();
				await bitbucketTest
					.mutateAsync({
						bitbucketId: providerId ?? "",
						bitbucketUsername: values.username,
						bitbucketEmail: values.email,
						workspaceName: values.workspaceName,
						apiToken: values.apiToken,
						appPassword: values.appPassword,
					})
					.then((message) => toast.info(`Message: ${message}`))
					.catch((error) =>
						toast.error(`Error: ${extractErrorMessage(error)}`),
					);
				return;
			}
		}
	};

	const test = {
		github: githubTest,
		gitlab: gitlabTest,
		gitea: giteaTest,
		bitbucket: bitbucketTest,
	}[initialProviderType ?? "github"];

	const TypeIcon = gitProviderIcon(providerType);

	const textField = (
		name: keyof GitProviderForm,
		label: string,
		options?: { type?: string; description?: ReactNode; placeholder?: string },
	) => (
		<FormField
			key={name}
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<FormControl>
						<Input
							type={options?.type}
							placeholder={options?.placeholder}
							{...field}
							value={String(field.value ?? "")}
						/>
					</FormControl>
					{options?.description && (
						<FormDescription>{options.description}</FormDescription>
					)}
					<FormMessage />
				</FormItem>
			)}
		/>
	);

	const credentialFields = () => {
		switch (providerType) {
			case "github":
				return null;
			case "gitlab":
				return (
					<>
						{textField("endpoint", "GitLab URL", {
							placeholder: "https://gitlab.com",
							description:
								"SaaS (https://gitlab.com) or your self-hosted instance.",
						})}
						{textField("internalUrl", "Internal URL (optional)", {
							placeholder: "http://gitlab:80",
							description:
								"Used for the OAuth token exchange when GitLab runs next to Notploy (e.g. a Docker service name).",
						})}
						{textField("applicationId", "Application ID")}
						{textField("applicationSecret", "Application Secret", {
							type: "password",
						})}
						{textField("groupName", "Group name (optional)", {
							placeholder: "my-org",
							description:
								"Comma-separated group slugs to expose for organization access.",
						})}
					</>
				);
			case "gitea":
				return (
					<>
						{textField("endpoint", "Gitea URL", {
							placeholder: "https://gitea.com",
							description:
								"SaaS (https://gitea.com) or your self-hosted instance.",
						})}
						{textField("internalUrl", "Internal URL (optional)", {
							placeholder: "http://gitea:3000",
							description:
								"Used for the OAuth token exchange when Gitea runs next to Notploy.",
						})}
						{textField("clientId", "Client ID")}
						{textField("clientSecret", "Client Secret", {
							type: "password",
						})}
					</>
				);
			case "bitbucket":
				return (
					<>
						{textField("username", "Bitbucket username")}
						{textField("email", "Bitbucket email", { type: "email" })}
						{textField("apiToken", "API Token", {
							type: "password",
							description:
								"Create a scoped token in your Atlassian account; App Passwords are deprecated.",
						})}
						{textField("workspaceName", "Workspace name (optional)", {
							placeholder: "For organization accounts",
						})}
					</>
				);
			default:
				return null;
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : isEdit ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit provider</span>
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Edit provider</TooltipContent>
				</Tooltip>
			) : (
				<DialogTrigger asChild>
					<Button>
						<PlusIcon className="size-4" />
						Add Provider
					</Button>
				</DialogTrigger>
			)}

			<DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TypeIcon className="size-5" />
						{isEdit
							? `Update ${gitProviderLabel(providerType)} connection`
							: "Add Git Provider"}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Update this connection's name, endpoint and credentials."
							: "Connect a Git forge so Notploy can list, clone and deploy from its repositories."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						{!isEdit && (
							<FormField
								control={form.control}
								name="providerType"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Provider type</FormLabel>
										<Select
											onValueChange={(value) => {
												field.onChange(value);
												form.setValue("endpoint", "");
											}}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a provider" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{providerGroups.map((group) => (
													<SelectGroup key={group.category}>
														<SelectLabel>
															{gitProviderCategoryLabels[group.category]}
														</SelectLabel>
														{group.types.map((value) => {
															const Icon = gitProviderIcon(value);
															return (
																<SelectItem key={value} value={value}>
																	<div className="flex flex-row items-center gap-2">
																		<Icon className="size-4 shrink-0" />
																		{gitProviderLabel(value)}
																	</div>
																</SelectItem>
															);
														})}
													</SelectGroup>
												))}
											</SelectContent>
										</Select>
										<FormDescription>
											{gitProviderCategoryDescriptions[
												gitProviderCategoryByType[providerType]
											]}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{providerType !== "github" &&
							textField("name", "Connection name", {
								placeholder: "production-acme",
							})}

						{isEdit && providerType === "github" && (
							<>
								{textField("name", "Connection name")}
								{textField("appName", "App name")}
								<div className="flex flex-col gap-1">
									<span className="text-sm font-medium">GitHub URL</span>
									<Input value={form.watch("endpoint")} readOnly />
									<span className="text-muted-foreground text-xs">
										Set when the app was created; the app credentials
										belong to this instance.
									</span>
								</div>
							</>
						)}

						{!isEdit && providerType === "github" && (
							<>
								{textField("endpoint", "GitHub URL", {
									placeholder: DEFAULT_GITHUB_URL,
									description:
										"Leave as github.com, or use your GitHub Enterprise URL (e.g. https://acme.ghe.com).",
								})}
								{githubBase.error && (
									<AlertBlock type="error">{githubBase.error}</AlertBlock>
								)}
								<FormField
									control={form.control}
									name="isOrganization"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
											<div className="flex flex-col gap-0.5">
												<FormLabel className="text-sm">
													Organization
												</FormLabel>
												<FormDescription>
													Install the app on an organization instead of your
													personal account.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
								{isOrganization &&
									textField("organizationName", "Organization name", {
										placeholder: "acme",
									})}
								<AlertBlock type="info">
									Creating the app opens GitHub to install it; Notploy then
									registers the connection automatically.
								</AlertBlock>
								<input
									type="text"
									name="manifest"
									defaultValue={githubManifest}
									className="invisible"
								/>
							</>
						)}

						{providerType !== "github" && credentialFields()}

						{selectedDescriptor && (
							<div className="flex flex-col gap-2 rounded-lg border p-3">
								<span className="text-sm font-medium">
									What {gitProviderLabel(providerType)} supports
								</span>
								<GitCapabilityMatrix
									capabilities={selectedDescriptor.capabilities}
								/>
							</div>
						)}

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							{isEdit ? (
								<Button
									type="button"
									variant="secondary"
									isLoading={test?.isPending}
									onClick={onTestConnection}
								>
									Test Connection
								</Button>
							) : (
								<span />
							)}
							{!isEdit && providerType === "github" ? (
								<Button
									type="button"
									disabled={
										!!githubBase.error || (isOrganization && !form.watch("organizationName"))
									}
									onClick={() => {
										const state = `gh_init:${activeOrganization?.id ?? ""}:${session?.user?.id ?? ""}`;
										const formEl = document.createElement("form");
										formEl.method = "post";
										formEl.action = isOrganization
											? `${githubBase.baseUrl}/organizations/${form.getValues("organizationName")}/settings/apps/new?state=${state}`
											: `${githubBase.baseUrl}/settings/apps/new?state=${state}`;
										const manifestInput = document.createElement("input");
										manifestInput.type = "hidden";
										manifestInput.name = "manifest";
										manifestInput.value = githubManifest;
										formEl.appendChild(manifestInput);
										document.body.appendChild(formEl);
										formEl.submit();
									}}
								>
									Create GitHub App
								</Button>
							) : (
								<Button type="submit" isLoading={form.formState.isSubmitting}>
									{isEdit ? "Update" : "Create"}
								</Button>
							)}
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
