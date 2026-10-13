import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { KeyRound, PenBoxIcon, PlugZap, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { registryProviderIcons } from "@/components/icons/registry-provider-icons";
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
import {
	registryAuthMethodLabels,
	registryCategoryDescriptions,
	registryCategoryLabels,
	registryCategoryOrder,
	registryCredentialSourceLabels,
	registryProviderIconKey,
} from "./registry-provider-meta";

const PROVIDER_TYPES = [
	"docker-hub",
	"ghcr",
	"gitlab",
	"ecr",
	"gar",
	"acr",
	"quay",
	"artifactory",
	"harbor",
	"zot",
	"distribution",
	"nexus",
	"generic-oci",
] as const;

type ProviderType = (typeof PROVIDER_TYPES)[number];

/**
 * Registry form.
 *
 * Everything provider-specific — the endpoint, the accepted authentication
 * transports, the meaning of the namespace — comes from the server catalogue, so
 * adding a registry to Notploy never means editing this form. Credentials are
 * either written inline or referenced from the Secrets Manager; a referenced
 * secret is resolved server-side, so the Console never has to handle it again.
 */
const RegistrySchema = z.object({
	registryName: z
		.string()
		.min(1, { message: "Name is required" })
		.regex(/^[a-zA-Z0-9_-]+$/, {
			message: "Only letters, numbers, dashes and underscores",
		}),
	providerType: z.enum(PROVIDER_TYPES),
	registryUrl: z.string(),
	namespace: z.string(),
	authMethod: z.enum(["none", "basic", "token"]),
	credentialSource: z.enum(["secret", "inline"]),
	vaultSecretId: z.string(),
	username: z.string(),
	password: z.string(),
	allowAnonymous: z.boolean(),
});

type RegistryForm = z.infer<typeof RegistrySchema>;

interface Props {
	registryId?: string;
}

export const HandleRegistry = ({ registryId }: Props) => {
	const [open, setOpen] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testError, setTestError] = useState<string | null>(null);

	const utils = api.useUtils();
	const { data: registry, refetch } = api.registry.one.useQuery(
		{ registryId: registryId ?? "" },
		{ enabled: !!registryId },
	);
	const { data: descriptors } = api.registry.descriptors.useQuery();
	const { data: secretOptions } = api.registry.secretOptions.useQuery();
	const { mutateAsync: createRegistry, isPending: isCreating } =
		api.registry.create.useMutation();
	const { mutateAsync: updateRegistry, isPending: isUpdating } =
		api.registry.update.useMutation();
	const { mutateAsync: testConnection } =
		api.registry.testConnection.useMutation();

	const isUpdate = !!registryId;
	const isPending = isCreating || isUpdating;

	const form = useForm<RegistryForm>({
		resolver: zodResolver(RegistrySchema),
		defaultValues: {
			registryName: "",
			providerType: "generic-oci",
			registryUrl: "",
			namespace: "",
			authMethod: "basic",
			credentialSource: "inline",
			vaultSecretId: "",
			username: "",
			password: "",
			allowAnonymous: false,
		},
	});

	const providerType = form.watch("providerType");
	const authMethod = form.watch("authMethod");
	const credentialSource = form.watch("credentialSource");
	const descriptor = useMemo(
		() =>
			descriptors?.find((entry) => entry.providerType === providerType) ??
			descriptors?.find((entry) => entry.providerType === "generic-oci"),
		[descriptors, providerType],
	);

	// The stored password is never sent to the Console, so an edit starts blank
	// and only overwrites it when the user types a new one.
	useEffect(() => {
		if (!open) return;
		if (registry) {
			form.reset({
				registryName: registry.registryName,
				providerType: registry.providerType as ProviderType,
				registryUrl: registry.registryUrl,
				namespace: registry.namespace ?? "",
				authMethod: registry.authMethod,
				credentialSource: registry.credentialSource,
				vaultSecretId: registry.vaultSecretId ?? "",
				username: registry.username ?? "",
				password: "",
				allowAnonymous: registry.allowAnonymous,
			});
			return;
		}
		form.reset({
			registryName: "",
			providerType: "generic-oci",
			registryUrl: "",
			namespace: "",
			authMethod: "basic",
			credentialSource: "inline",
			vaultSecretId: "",
			username: "",
			password: "",
			allowAnonymous: false,
		});
	}, [open, registry, form]);

	// Selecting a provider supplies its defaults; the endpoint stays editable so
	// regional and account-specific hosts (ECR, Artifact Registry) can be typed.
	const applyProviderDefaults = (next: ProviderType) => {
		const nextDescriptor = descriptors?.find(
			(entry) => entry.providerType === next,
		);
		if (!nextDescriptor) return;
		form.setValue("providerType", next);
		form.setValue("registryUrl", nextDescriptor.endpoint ?? "");
		form.setValue("authMethod", nextDescriptor.defaultAuthMethod);
	};

	const buildPayload = (values: RegistryForm) => {
		const anonymous = values.authMethod === "none" || values.allowAnonymous;
		return {
			registryName: values.registryName,
			providerType: values.providerType,
			registryUrl: values.registryUrl.trim(),
			namespace: values.namespace.trim() ? values.namespace.trim() : null,
			authMethod: values.authMethod,
			credentialSource: values.credentialSource,
			allowAnonymous: values.allowAnonymous,
			...(anonymous
				? { username: null, password: null, vaultSecretId: null }
				: values.credentialSource === "secret"
					? {
							username: values.username.trim() ? values.username.trim() : null,
							vaultSecretId: values.vaultSecretId || null,
						}
					: {
							username: values.username.trim() ? values.username.trim() : null,
							...(values.password ? { password: values.password } : {}),
							vaultSecretId: null,
						}),
		};
	};

	const validateCredentials = (values: RegistryForm): string | null => {
		if (values.authMethod === "none" || values.allowAnonymous) return null;
		if (values.credentialSource === "secret") {
			return values.vaultSecretId
				? null
				: "Select a secret from the Secrets Manager";
		}
		return values.username.trim() ? null : "Username is required";
	};

	const onSubmit = async (values: RegistryForm) => {
		const credentialError = validateCredentials(values);
		if (credentialError) {
			toast.error(credentialError);
			return;
		}

		await (isUpdate
			? updateRegistry({ registryId: registryId, ...buildPayload(values) })
			: createRegistry(buildPayload(values))
		)
			.then(async () => {
				toast.success(
					isUpdate ? "Container registry updated" : "Container registry added",
				);
				setOpen(false);
				await utils.registry.all.invalidate();
				if (isUpdate) await refetch();
			})
			.catch((error) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Error saving the container registry",
				);
			});
	};

	const onTest = async (values: RegistryForm) => {
		setIsTesting(true);
		setTestError(null);
		await testConnection({
			...(isUpdate ? { registryId: registryId } : {}),
			providerType: values.providerType,
			registryUrl: values.registryUrl.trim(),
			authMethod: values.authMethod,
			credentialSource: values.credentialSource,
			allowAnonymous: values.allowAnonymous,
			username: values.username.trim() ? values.username.trim() : null,
			...(values.password ? { password: values.password } : {}),
			vaultSecretId: values.vaultSecretId || null,
		})
			.then((result) => {
				if (result.connected) {
					toast.success(result.message, {
						description: result.latencyMs
							? `${result.latencyMs} ms${
									result.identity?.authService
										? ` · ${result.identity.authService}`
										: ""
								}`
							: undefined,
					});
				} else {
					setTestError(result.message);
					toast.error(result.message);
				}
			})
			.catch((error) => {
				const message =
					error instanceof Error ? error.message : "Registry test failed";
				setTestError(message);
				toast.error(message);
			})
			.finally(() => setIsTesting(false));
	};

	const ProviderIcon =
		registryProviderIcons[registryProviderIconKey(providerType)];
	const anonymous = authMethod === "none" || form.watch("allowAnonymous");

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DialogTrigger asChild>
						{isUpdate ? (
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit registry</span>
							</Button>
						) : (
							<Button>
								<PlusIcon className="mr-1 size-4" />
								Add registry
							</Button>
						)}
					</DialogTrigger>
				</TooltipTrigger>
				<TooltipContent>
					{isUpdate ? "Edit registry" : "Add registry"}
				</TooltipContent>
			</Tooltip>

			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ProviderIcon className="size-5" />
						{isUpdate ? "Edit Container Registry" : "Add Container Registry"}
					</DialogTitle>
					<DialogDescription>
						Any endpoint serving OCI artifacts can be connected. Provider
						defaults only pre-fill the endpoint and the authentication a
						registry usually expects.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						id="registry-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex flex-col gap-4"
					>
						<FormField
							control={form.control}
							name="registryName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="sge-registry" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="providerType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Provider</FormLabel>
									<Select
										value={field.value}
										onValueChange={(value) =>
											applyProviderDefaults(value as ProviderType)
										}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a provider" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{registryCategoryOrder.map((category) => (
												<SelectGroup key={category}>
													<SelectLabel>
														{registryCategoryLabels[category]}
													</SelectLabel>
													{descriptors
														?.filter((entry) => entry.category === category)
														.map((entry) => (
															<SelectItem
																key={entry.providerType}
																value={entry.providerType}
															>
																{entry.label}
															</SelectItem>
														))}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
									{descriptor && (
										<FormDescription>
											{descriptor.description}
											{registryCategoryDescriptions[descriptor.category]
												? ` ${registryCategoryDescriptions[descriptor.category]}`
												: ""}
										</FormDescription>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="registryUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Endpoint</FormLabel>
									<FormControl>
										<Input
											placeholder={
												descriptor?.endpointPlaceholder ??
												"registry.example.com or https://harbor.internal"
											}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Hostname, hostname:port or an http(s) URL. Private and plain
										HTTP endpoints are supported.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="namespace"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{descriptor?.namespaceLabel ?? "Namespace (optional)"}
									</FormLabel>
									<FormControl>
										<Input
											placeholder={
												descriptor?.namespacePlaceholder ?? "team/api"
											}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Used to derive the image prefix applications push to, e.g.{" "}
										{descriptor?.imagePrefixTemplate ??
											"{endpoint}/{namespace}"}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="authMethod"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Authentication</FormLabel>
										<Select value={field.value} onValueChange={field.onChange}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{(
													descriptor?.authMethods ?? ["none", "basic", "token"]
												).map((method) => (
													<SelectItem key={method} value={method}>
														{registryAuthMethodLabels[method]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="credentialSource"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Credentials</FormLabel>
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={anonymous}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="inline">
													{registryCredentialSourceLabels.inline}
												</SelectItem>
												<SelectItem value="secret">
													{registryCredentialSourceLabels.secret}
												</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>
											Referencing a secret keeps the registry record free of raw
											credentials.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{!anonymous && credentialSource === "secret" && (
							<FormField
								control={form.control}
								name="vaultSecretId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Secret</FormLabel>
										<Select value={field.value} onValueChange={field.onChange}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a secret" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{secretOptions?.length ? (
													secretOptions.map((secret) => (
														<SelectItem
															key={secret.vaultSecretId}
															value={secret.vaultSecretId}
														>
															{secret.providerName} · {secret.name}
														</SelectItem>
													))
												) : (
													<SelectItem value="none" disabled>
														No managed secret available
													</SelectItem>
												)}
											</SelectContent>
										</Select>
										<FormDescription className="flex items-center gap-1">
											<KeyRound className="size-3" />
											Store the password alone, or a JSON object with username
											and password.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{!anonymous && (
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input
												autoComplete="off"
												placeholder={
													providerType === "ecr"
														? "AWS"
														: "robot$library+notploy"
												}
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Case is preserved — some registries require an exact
											username (ECR uses <code>AWS</code>).
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{!anonymous && credentialSource === "inline" && (
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{authMethod === "token" ? "Access token" : "Password"}
										</FormLabel>
										<FormControl>
											<Input
												type="password"
												autoComplete="new-password"
												placeholder={
													isUpdate
														? "Leave empty to keep the stored credential"
														: "••••••••"
												}
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Sent only when the registry is contacted; stored
											encrypted.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<FormField
							control={form.control}
							name="allowAnonymous"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="flex flex-col gap-0.5">
										<FormLabel>Anonymous pulls</FormLabel>
										<FormDescription>
											Read public repositories without credentials.
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

						{testError && <AlertBlock type="error">{testError}</AlertBlock>}
					</form>
				</Form>

				<DialogFooter className="gap-2 sm:justify-between">
					<Button
						type="button"
						variant="secondary"
						isLoading={isTesting}
						onClick={form.handleSubmit(onTest)}
					>
						<PlugZap className="mr-1 size-4" />
						Test connection
					</Button>
					<Button type="submit" form="registry-form" isLoading={isPending}>
						{isUpdate ? "Save" : "Add registry"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
