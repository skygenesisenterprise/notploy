import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { objectStorageProviderIcons } from "@/components/icons/object-storage-provider-icons";
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
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import {
	objectStorageCategoryDescriptions,
	objectStorageCategoryLabels,
	objectStorageCategoryOrder,
	objectStorageProviderIconKey,
	objectStorageProviderLabel,
} from "./object-storage-meta";

const objectStorageFormSchema = z
	.object({
		name: z
			.string()
			.min(1, { message: "Name is required" })
			.regex(/^[a-zA-Z0-9_.-]+$/, {
				message: "Only letters, numbers, dots, dashes and underscores",
			}),
		category: z.enum(["external", "self-hosted", "internal"]),
		providerType: z.string().min(1, { message: "Provider is required" }),
		endpoint: z.string(),
		region: z.string(),
		accessKeyId: z.string(),
		secretAccessKey: z.string(),
		pathStyle: z.boolean(),
		allowInsecureTls: z.boolean(),
		additionalFlags: z.string(),
		rootPath: z.string(),
		serverId: z.string().optional(),
	})
	// The internal provider owns its storage and needs no credentials; every
	// other provider must supply an endpoint and keys.
	.superRefine((value, ctx) => {
		if (value.providerType === "notploy-internal") return;
		if (!value.endpoint) {
			ctx.addIssue({
				code: "custom",
				path: ["endpoint"],
				message: "Endpoint is required",
			});
		}
		if (!value.accessKeyId) {
			ctx.addIssue({
				code: "custom",
				path: ["accessKeyId"],
				message: "Access Key ID is required",
			});
		}
		if (!value.secretAccessKey) {
			ctx.addIssue({
				code: "custom",
				path: ["secretAccessKey"],
				message: "Secret Access Key is required",
			});
		}
	});

type ObjectStorageForm = z.infer<typeof objectStorageFormSchema>;

const defaultValues: ObjectStorageForm = {
	name: "",
	category: "external",
	providerType: "aws",
	endpoint: "",
	region: "",
	accessKeyId: "",
	secretAccessKey: "",
	pathStyle: true,
	allowInsecureTls: false,
	additionalFlags: "",
	rootPath: "",
	serverId: undefined,
};

const parseFlags = (value: string) =>
	value
		.split("\n")
		.map((flag) => flag.trim())
		.filter(Boolean);

const extractErrorMessage = (err: unknown) => {
	if (!(err instanceof Error)) return undefined;
	try {
		const issues = JSON.parse(err.message) as { message?: string }[];
		if (Array.isArray(issues)) {
			return issues
				.map((issue) => issue.message)
				.filter(Boolean)
				.join(", ");
		}
	} catch {}
	return err.message;
};

interface Props {
	objectStorageProviderId?: string;
	trigger?: ReactNode;
}

export const HandleObjectStorage = ({
	objectStorageProviderId,
	trigger,
}: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: descriptors } = api.objectStorage.descriptors.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: servers } = api.server.withSSHKey.useQuery();

	const { data: provider } = api.objectStorage.provider.useQuery(
		{ objectStorageProviderId: objectStorageProviderId || "" },
		{ enabled: !!objectStorageProviderId && isOpen },
	);

	const {
		mutateAsync: createProvider,
		isPending: isCreating,
		error: createError,
		isError: isCreateError,
	} = api.objectStorage.createProvider.useMutation();
	const {
		mutateAsync: updateProvider,
		isPending: isUpdating,
		error: updateError,
		isError: isUpdateError,
	} = api.objectStorage.updateProvider.useMutation();
	const { mutateAsync: testConnection, isPending: isTesting } =
		api.objectStorage.testConnection.useMutation();

	const isPending = isCreating || isUpdating;
	const error = updateError ?? createError;
	const isError = isUpdateError || isCreateError;

	const form = useForm<ObjectStorageForm>({
		defaultValues,
		resolver: zodResolver(objectStorageFormSchema),
	});

	const category = form.watch("category");
	const providerType = form.watch("providerType");
	const pathStyle = form.watch("pathStyle");
	const allowInsecureTls = form.watch("allowInsecureTls");
	const isInternal = providerType === "notploy-internal";

	const providerGroups = useMemo(
		() =>
			objectStorageCategoryOrder
				.map((categoryKey) => ({
					category: categoryKey,
					providers: (descriptors ?? []).filter(
						(descriptor) => descriptor.category === categoryKey,
					),
				}))
				.filter((group) => group.providers.length > 0),
		[descriptors],
	);

	// The provider is the single source of truth for the storage type: picking
	// one sets whether this is external or self-hosted, so there is no separate
	// category control to keep in sync.
	const applyDescriptorDefaults = (value: string) => {
		const descriptor = descriptors?.find(
			(entry) => entry.providerType === value,
		);
		if (!descriptor || objectStorageProviderId) return;
		form.setValue("category", descriptor.category);
		form.setValue("endpoint", descriptor.endpointTemplate);
		form.setValue("region", descriptor.defaultRegion ?? "");
		form.setValue("pathStyle", descriptor.pathStyle);
	};

	useEffect(() => {
		if (provider) {
			form.reset({
				...defaultValues,
				name: provider.name,
				category: provider.category as ObjectStorageForm["category"],
				providerType: provider.providerType,
				endpoint: provider.config.endpoint,
				region: provider.config.region,
				accessKeyId: provider.config.accessKeyId,
				secretAccessKey: provider.config.secretAccessKey,
				pathStyle: provider.config.pathStyle,
				allowInsecureTls: provider.config.allowInsecureTls,
				additionalFlags: (provider.config.additionalFlags ?? []).join("\n"),
				rootPath: provider.config.rootPath ?? "",
			});
		} else if (!objectStorageProviderId && isOpen) {
			form.reset(defaultValues);
		}
	}, [provider, objectStorageProviderId, isOpen, form]);

	const buildConfig = (data: ObjectStorageForm) => ({
		endpoint: data.endpoint,
		region: data.region,
		accessKeyId: data.accessKeyId,
		secretAccessKey: data.secretAccessKey,
		pathStyle: data.pathStyle,
		allowInsecureTls: data.allowInsecureTls,
		additionalFlags: parseFlags(data.additionalFlags),
		rootPath: data.rootPath.trim() || undefined,
	});

	const onSubmit = async (data: ObjectStorageForm) => {
		const config = buildConfig(data);

		try {
			if (objectStorageProviderId) {
				await updateProvider({
					objectStorageProviderId,
					name: data.name,
					providerType: data.providerType as never,
					category: data.category,
					config,
				});
				toast.success("Storage updated");
			} else {
				await createProvider({
					name: data.name,
					providerType: data.providerType as never,
					category: data.category,
					config,
					serverId: data.serverId,
				});
				toast.success("Storage created");
			}
			await utils.objectStorage.providers.invalidate();
			setIsOpen(false);
		} catch (error) {
			toast.error("Error saving the storage", {
				description: extractErrorMessage(error),
			});
		}
	};

	const onTestConnection = async () => {
		const isValid = await form.trigger();
		if (!isValid) return;
		const data = form.getValues();
		await testConnection({
			providerType: data.providerType as never,
			category: data.category,
			config: buildConfig(data),
			...(objectStorageProviderId ? { objectStorageProviderId } : {}),
			serverId: data.serverId,
		})
			.then(() => {
				toast.success("Connection successful");
			})
			.catch((err) => {
				toast.error("Connection failed", {
					description: extractErrorMessage(err),
				});
			});
	};

	const textField = (
		name: keyof ObjectStorageForm,
		label: string,
		options?: { type?: string; placeholder?: string; description?: ReactNode },
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

	const switchField = (
		name: "pathStyle" | "allowInsecureTls",
		label: string,
		description: string,
		value: boolean,
	) => (
		<FormField
			key={name}
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
					<div className="flex flex-col gap-0.5">
						<FormLabel className="text-sm">{label}</FormLabel>
						<FormDescription>{description}</FormDescription>
					</div>
					<FormControl>
						<Switch checked={value} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : objectStorageProviderId ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit storage</span>
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Edit storage</TooltipContent>
				</Tooltip>
			) : (
				<DialogTrigger asChild>
					<Button>
						<PlusIcon className="size-4" />
						Add Storage
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{objectStorageProviderId ? "Update Storage" : "Add Storage"}
					</DialogTitle>
					<DialogDescription>
						Connect an S3-compatible provider so buckets and backups can use it
						without ever seeing the underlying endpoint.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					{" "}
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-3"
					>
						{isError && (
							<AlertBlock type="error">{extractErrorMessage(error)}</AlertBlock>
						)}

						{textField("name", "Name", {
							placeholder: "prod-storage",
						})}

						<FormField
							control={form.control}
							name="providerType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Provider</FormLabel>
									<Select
										onValueChange={(value) => {
											field.onChange(value);
											applyDescriptorDefaults(value);
										}}
										value={field.value}
										disabled={!!objectStorageProviderId}
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
														{objectStorageCategoryLabels[group.category] ??
															group.category}
													</SelectLabel>
													{group.providers.map((entry) => {
														const ProviderIcon =
															objectStorageProviderIcons[
																objectStorageProviderIconKey(entry.providerType)
															];
														return (
															<SelectItem
																key={entry.providerType}
																value={entry.providerType}
															>
																<div className="flex flex-row items-center gap-2">
																	<ProviderIcon className="size-4 shrink-0" />
																	{entry.label ??
																		objectStorageProviderLabel(
																			entry.providerType,
																		)}
																</div>
															</SelectItem>
														);
													})}
												</SelectGroup>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										{objectStorageCategoryDescriptions[category] ??
											objectStorageProviderLabel(providerType)}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{!isInternal && (
							<>
								<div className="grid grid-cols-2 gap-3">
									{textField("endpoint", "Endpoint", {
										placeholder: "https://s3.eu-central-1.wasabisys.com",
									})}
									{textField("region", "Region", {
										placeholder: "us-east-1",
									})}
									{textField("accessKeyId", "Access Key ID")}
									{textField("secretAccessKey", "Secret Access Key", {
										type: "password",
									})}
								</div>
								{switchField(
									"pathStyle",
									"Force path-style addressing",
									"Required by most self-hosted S3-compatible stores.",
									pathStyle,
								)}
								{switchField(
									"allowInsecureTls",
									"Allow self-signed TLS",
									"Skip certificate verification for an internal endpoint.",
									allowInsecureTls,
								)}
								<FormField
									control={form.control}
									name="additionalFlags"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Additional rclone flags (optional)</FormLabel>
											<FormControl>
												<Textarea
													className="min-h-[56px] font-mono text-xs"
													placeholder={"--s3-sign-accept-encoding=false"}
													{...field}
												/>
											</FormControl>
											<FormDescription>One flag per line.</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</>
						)}

						{isInternal && (
							<>
								<AlertBlock type="info">
									Notploy keeps these buckets on its own storage path, so no
									external endpoint or credentials are needed. Ideal for a
									self-hosted install that wants backups without a third party.
								</AlertBlock>
								{textField("rootPath", "Storage root (optional)", {
									placeholder: "/etc/notploy/object-storage",
									description:
										"Leave empty to use the default Notploy storage path.",
								})}
							</>
						)}

						{isCloud && (
							<FormField
								control={form.control}
								name="serverId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Server (required to test)</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Select a server" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectLabel>Servers</SelectLabel>
													{servers?.map((server) => (
														<SelectItem
															key={server.serverId}
															value={server.serverId}
														>
															{server.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							<Button
								type="button"
								variant="secondary"
								isLoading={isTesting}
								onClick={onTestConnection}
							>
								Test Connection
							</Button>
							<Button type="submit" isLoading={isPending}>
								{objectStorageProviderId ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
