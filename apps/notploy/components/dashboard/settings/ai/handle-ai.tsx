"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import {
	Check,
	ChevronDown,
	CircleHelp,
	PenBoxIcon,
	Plug,
	PlusIcon,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { AiCapabilityMatrix } from "./ai-capability-matrix";
import {
	AI_PROVIDER_CATEGORY_LABELS,
	AI_PROVIDER_PRESETS,
	type AiProviderCategory,
	aiProviderIconKey,
	aiProviderIcons,
	formatAiTestDate,
	getAiProviderPreset,
	getCapabilityWarnings,
	getModelCapabilities,
	resolveAiProviderId,
} from "./ai-provider-meta";

const Schema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	apiUrl: z.string().url({ message: "Please enter a valid URL" }),
	apiKey: z.string(),
	model: z.string().min(1, { message: "Model is required" }),
	isEnabled: z.boolean(),
});

type Schema = z.infer<typeof Schema>;

interface Props {
	aiId?: string;
	trigger?: ReactNode;
}

interface ProviderOption {
	key: string;
	name: string;
	apiUrl: string;
	providerId: string;
	description: string;
	requiresApiKey: boolean;
	category: AiProviderCategory;
}

interface LocalTestResult {
	success: boolean;
	message: string;
	latencyMs?: number;
	warnings?: string[];
	testedAt?: string | null;
}

const normalize = (value: string) => value.trim().replace(/\/+$/, "");

export const HandleAi = ({ aiId, trigger }: Props) => {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [modelQuery, setModelQuery] = useState<{
		apiUrl: string;
		apiKey?: string;
		aiId?: string;
	} | null>(null);
	const [testResult, setTestResult] = useState<LocalTestResult | null>(null);

	const { data, isPending: isLoadingSetting } = api.ai.one.useQuery(
		{ aiId: aiId || "" },
		{ enabled: !!aiId && open },
	);
	const { data: customProviders } = api.ai.getCustomProviders.useQuery();
	const hasCustomProviders = (customProviders?.length ?? 0) > 0;

	const providerOptions = useMemo<ProviderOption[]>(() => {
		if (hasCustomProviders) {
			return (customProviders ?? []).map((provider) => ({
				key: `custom:${provider.apiUrl}`,
				name: provider.name,
				apiUrl: provider.apiUrl,
				providerId: resolveAiProviderId(provider.apiUrl),
				description: "Allowed by your organization",
				requiresApiKey: false,
				category: "custom",
			}));
		}
		return AI_PROVIDER_PRESETS.map((preset) => ({
			key: preset.id,
			name: preset.name,
			apiUrl: preset.apiUrl,
			providerId: preset.id,
			description: preset.description,
			requiresApiKey: preset.requiresApiKey,
			category: preset.category,
		}));
	}, [customProviders, hasCustomProviders]);

	const providerGroups = useMemo(() => {
		const order: AiProviderCategory[] = [
			"cloud",
			"gateway",
			"self-hosted",
			"custom",
		];
		return order
			.map((category) => ({
				category,
				options: providerOptions.filter(
					(option) => option.category === category,
				),
			}))
			.filter((group) => group.options.length > 0);
	}, [providerOptions]);

	const createMutation = api.ai.create.useMutation();
	const updateMutation = api.ai.update.useMutation();
	const mutation = aiId ? updateMutation : createMutation;
	const { isPending, error, isError } = mutation;

	const [modelsError, setModelsError] = useState<string | null>(null);
	const {
		data: models,
		isFetching: isDiscovering,
		error: modelsQueryError,
		refetch: refetchModels,
	} = api.ai.getModels.useQuery(modelQuery ?? { apiUrl: "" }, {
		enabled: open && !!modelQuery,
		retry: false,
	});

	useEffect(() => {
		if (modelsQueryError) setModelsError(modelsQueryError.message);
	}, [modelsQueryError]);

	useEffect(() => {
		if (models && models.length === 0) {
			setModelsError(
				"The endpoint returned no models. Type an identifier manually.",
			);
		}
	}, [models]);

	const { mutateAsync: testConnection, isPending: isTesting } =
		api.ai.testConnection.useMutation();

	const form = useForm<Schema>({
		resolver: zodResolver(Schema),
		defaultValues: {
			name: "",
			apiUrl: "",
			apiKey: "",
			model: "",
			isEnabled: true,
		},
	});

	const apiUrl = form.watch("apiUrl");
	const apiKey = form.watch("apiKey");
	const model = form.watch("model");
	const providerId = resolveAiProviderId(apiUrl);
	const preset = getAiProviderPreset(providerId);
	const capabilities = getModelCapabilities(providerId, model);
	const warnings = getCapabilityWarnings(capabilities);
	const hasStoredApiKey = data?.hasApiKey ?? false;
	const requiresApiKey = hasCustomProviders
		? false
		: (preset.requiresApiKey && !hasStoredApiKey) ||
			(preset.requiresApiKey && !aiId);
	const canLoadModels =
		!!apiUrl && (!requiresApiKey || !!apiKey || !!aiId || hasStoredApiKey);

	const selectedProviderKey = useMemo(() => {
		if (hasCustomProviders) {
			const match = providerOptions.find(
				(option) => normalize(option.apiUrl) === normalize(apiUrl),
			);
			return match?.key ?? "";
		}
		if (providerId === "custom") return "custom";
		return providerOptions.some((option) => option.key === providerId)
			? providerId
			: "";
	}, [apiUrl, hasCustomProviders, providerId, providerOptions]);

	useEffect(() => {
		if (!open) return;

		if (data) {
			form.reset({
				name: data.name,
				apiUrl: data.apiUrl,
				apiKey: "",
				model: data.model,
				isEnabled: data.isEnabled,
			});
			setModelQuery({ apiUrl: data.apiUrl, aiId: data.aiId });
			setTestResult(
				data.lastTestStatus
					? {
							success: data.lastTestStatus === "success",
							message: data.lastTestMessage ?? "",
							latencyMs: data.lastTestLatencyMs ?? undefined,
							testedAt: data.lastTestedAt,
						}
					: null,
			);
		} else if (!aiId) {
			form.reset({
				name: "",
				apiUrl: "",
				apiKey: "",
				model: "",
				isEnabled: true,
			});
			setModelQuery(null);
			setTestResult(null);
		}

		setModelsError(null);
		setModelSearch("");
		setModelPopoverOpen(false);
	}, [open, data, aiId, form]);

	const onProviderSelect = (key: string) => {
		const option = providerOptions.find((item) => item.key === key);
		if (!option) return;
		form.setValue("name", option.name);
		form.setValue("apiUrl", option.apiUrl);
		form.setValue("model", "");
		form.setValue("apiKey", "");
		setModelsError(null);
		setModelQuery(
			option.requiresApiKey || aiId || !option.apiUrl
				? null
				: { apiUrl: option.apiUrl, aiId },
		);
	};

	const onLoadModels = async () => {
		if (!canLoadModels) {
			toast.error("Enter an API key before loading models");
			return;
		}
		setModelsError(null);
		const nextQuery = {
			apiUrl: form.getValues("apiUrl"),
			apiKey: form.getValues("apiKey") || undefined,
			aiId,
		};
		if (
			modelQuery &&
			modelQuery.apiUrl === nextQuery.apiUrl &&
			modelQuery.aiId === nextQuery.aiId
		) {
			void refetchModels();
			return;
		}
		setModelQuery(nextQuery);
	};

	const onTestConnection = async () => {
		const isValid = await form.trigger();
		if (!isValid) return;
		const values = form.getValues();
		setTestResult(null);
		try {
			const result = await testConnection({
				aiId,
				apiUrl: values.apiUrl,
				apiKey: values.apiKey || undefined,
				model: values.model,
			});
			setTestResult({
				success: true,
				message: result.message,
				latencyMs: result.latencyMs,
				warnings: result.warnings,
				testedAt: new Date().toISOString(),
			});
			toast.success("Connection successful", {
				description: `${result.providerLabel} · ${result.model} · ${result.latencyMs} ms`,
			});
			utils.ai.getAll.invalidate();
		} catch (testError) {
			const message =
				testError instanceof Error ? testError.message : "Connection failed";
			setTestResult({ success: false, message });
			toast.error("Connection failed", { description: message });
		}
	};

	const onSubmit = async (values: Schema) => {
		try {
			if (aiId) {
				await updateMutation.mutateAsync({
					aiId,
					name: values.name,
					apiUrl: values.apiUrl,
					model: values.model,
					isEnabled: values.isEnabled,
					...(values.apiKey ? { apiKey: values.apiKey } : {}),
				});
			} else {
				await createMutation.mutateAsync({
					name: values.name,
					apiUrl: values.apiUrl,
					model: values.model,
					isEnabled: values.isEnabled,
					apiKey: values.apiKey,
				});
			}
			await utils.ai.getAll.invalidate();
			if (aiId) await utils.ai.one.invalidate({ aiId });
			toast.success(aiId ? "AI provider updated" : "AI provider created");
			setOpen(false);
		} catch {
			// The mutation error is rendered in the dialog.
		}
	};

	const displayModels =
		models?.filter((item) =>
			item.id.toLowerCase().includes(modelSearch.toLowerCase()),
		) ?? [];
	const selectedModel = models?.find((item) => item.id === model);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				setOpen(isOpen);
				if (!isOpen) {
					setModelSearch("");
					setModelPopoverOpen(false);
				}
			}}
		>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : aiId ? (
				<DialogTrigger asChild>
					<Button variant="ghost" size="icon" className="text-muted-foreground">
						<PenBoxIcon className="size-4" />
						<span className="sr-only">Edit provider</span>
					</Button>
				</DialogTrigger>
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
					<DialogTitle>
						{aiId ? "Edit AI Provider" : "Add AI Provider"}
					</DialogTitle>
					<DialogDescription>
						Connect an AI endpoint so Notploy&apos;s AI features can resolve a
						model without being tied to one vendor.
					</DialogDescription>
				</DialogHeader>

				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="production-openai" {...field} />
									</FormControl>
									<FormDescription>
										A name to identify this connection in AI features.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="space-y-2">
							<FormLabel>Provider</FormLabel>
							<Select
								onValueChange={onProviderSelect}
								value={selectedProviderKey}
								disabled={!!aiId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a provider preset" />
								</SelectTrigger>
								<SelectContent>
									{providerGroups.map((group) => (
										<SelectGroup key={group.category}>
											<SelectLabel>
												{AI_PROVIDER_CATEGORY_LABELS[group.category] ??
													group.category}
											</SelectLabel>
											{group.options.map((option) => {
												const Icon =
													aiProviderIcons[aiProviderIconKey(option.providerId)];
												return (
													<SelectItem key={option.key} value={option.key}>
														<div className="flex flex-row items-center gap-2">
															<Icon className="size-4 shrink-0" />
															{option.name}
														</div>
													</SelectItem>
												);
											})}
										</SelectGroup>
									))}
								</SelectContent>
							</Select>
							<p className="text-[0.8rem] text-muted-foreground">
								{hasCustomProviders
									? "Only providers approved by your organization can be used."
									: preset.description}
							</p>
						</div>

						<FormField
							control={form.control}
							name="apiUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API URL</FormLabel>
									<FormControl>
										<Input
											placeholder="https://api.openai.com/v1"
											disabled={hasCustomProviders}
											{...field}
											onChange={(event) => {
												field.onChange(event);
												form.setValue("model", "");
												setModelsError(null);
												setModelQuery(null);
											}}
										/>
									</FormControl>
									<FormDescription>
										{hasCustomProviders
											? "The endpoint is defined by your organization."
											: "The base URL of the provider API. Private and self-hosted endpoints are allowed in self-hosted mode."}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="apiKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API Key</FormLabel>
									<FormControl>
										<div className="flex gap-2">
											<Input
												type="password"
												autoComplete="one-time-code"
												placeholder={
													hasStoredApiKey
														? "••••••••  (leave blank to keep the stored key)"
														: preset.requiresApiKey
															? "sk-..."
															: "Optional for this endpoint"
												}
												{...field}
												onChange={(event) => {
													field.onChange(event);
													setModelsError(null);
													setModelQuery(null);
												}}
											/>
										</div>
									</FormControl>
									<FormDescription>
										{hasStoredApiKey
											? "A key is already stored. It is never sent back to the browser."
											: "Stored server-side and never returned by the API after saving."}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="model"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center justify-between gap-2">
										<FormLabel>Model</FormLabel>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 gap-1.5 px-2 text-xs"
											isLoading={isDiscovering}
											disabled={!canLoadModels || isLoadingSetting}
											onClick={onLoadModels}
										>
											{!isDiscovering && <RefreshCw className="size-3.5" />}
											Load models
										</Button>
									</div>
									<FormControl>
										{displayModels.length > 0 ? (
											<Popover
												open={modelPopoverOpen}
												onOpenChange={setModelPopoverOpen}
											>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														className={cn(
															"w-full justify-between",
															!field.value && "text-muted-foreground",
														)}
													>
														{field.value
															? (selectedModel?.id ?? field.value)
															: "Select a model"}
														<ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-[400px] p-0" align="start">
													<Command>
														<CommandInput
															placeholder="Search or type a custom model..."
															value={modelSearch}
															onValueChange={setModelSearch}
														/>
														<CommandList>
															<CommandEmpty>
																{modelSearch ? (
																	<button
																		type="button"
																		className="w-full cursor-pointer px-2 py-1.5 text-left text-sm hover:bg-accent"
																		onClick={() => {
																			field.onChange(modelSearch);
																			setModelPopoverOpen(false);
																			setModelSearch("");
																		}}
																	>
																		Use custom model: &quot;{modelSearch}&quot;
																	</button>
																) : (
																	"No models found."
																)}
															</CommandEmpty>
															{displayModels.map((item) => {
																const isSelected = field.value === item.id;
																return (
																	<CommandItem
																		key={item.id}
																		value={item.id}
																		onSelect={() => {
																			field.onChange(item.id);
																			setModelPopoverOpen(false);
																			setModelSearch("");
																		}}
																	>
																		<Check
																			className={cn(
																				"mr-2 size-4",
																				isSelected
																					? "opacity-100"
																					: "opacity-0",
																			)}
																		/>
																		{item.id}
																	</CommandItem>
																);
															})}
														</CommandList>
													</Command>
												</PopoverContent>
											</Popover>
										) : (
											<Input
												placeholder={
													isDiscovering
														? "Loading models..."
														: "Enter a model identifier (e.g. gpt-4o)"
												}
												disabled={isDiscovering}
												{...field}
											/>
										)}
									</FormControl>
									<FormDescription>
										Load the provider list or type an identifier manually.
										Unknown capabilities are not treated as guaranteed.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{modelsError && (
							<p className="text-xs text-muted-foreground">{modelsError}</p>
						)}

						<div className="rounded-lg border bg-muted/20 p-3">
							<div className="mb-2 flex items-center gap-2">
								<span className="text-xs font-medium text-muted-foreground">
									Declared capabilities
								</span>
								<span className="text-[11px] text-muted-foreground/80">
									{selectedModel
										? `for ${selectedModel.id}`
										: "for this endpoint"}
								</span>
							</div>
							<AiCapabilityMatrix
								capabilities={capabilities}
								verifiedCapabilities={data?.verifiedCapabilities}
								compact
							/>
							{warnings.length > 0 && (
								<ul className="mt-2 space-y-1">
									{warnings.slice(0, 2).map((warning) => (
										<li
											key={warning}
											className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
										>
											<CircleHelp className="mt-0.5 size-3 shrink-0" />
											{warning}
										</li>
									))}
								</ul>
							)}
						</div>

						<FormField
							control={form.control}
							name="isEnabled"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel className="text-base">Enable provider</FormLabel>
										<FormDescription>
											Enabled providers can be selected by AI features.
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

						{testResult && (
							<div
								className={cn(
									"flex flex-col gap-1 rounded-lg border p-3 text-xs",
									testResult.success
										? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
										: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
								)}
							>
								<div className="flex items-center gap-2 font-medium">
									{testResult.success ? (
										<ShieldCheck className="size-4" />
									) : (
										<CircleHelp className="size-4" />
									)}
									{testResult.success
										? "Connection verified"
										: "Connection failed"}
									{testResult.latencyMs != null && (
										<span className="font-normal opacity-80">
											· {testResult.latencyMs} ms
										</span>
									)}
								</div>
								{testResult.message && <span>{testResult.message}</span>}
								{testResult.testedAt && (
									<span className="opacity-70">
										Last test:{" "}
										{formatAiTestDate(testResult.testedAt) ?? "just now"}
									</span>
								)}
							</div>
						)}

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							<Button
								type="button"
								variant="secondary"
								isLoading={isTesting}
								disabled={!model || !apiUrl}
								onClick={onTestConnection}
							>
								{!isTesting && <Plug className="size-4" />}
								Test Connection
							</Button>
							<Button type="submit" isLoading={isPending}>
								{aiId ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
