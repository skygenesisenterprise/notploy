"use client";

import {
	Activity,
	Bot,
	Loader2,
	PenBoxIcon,
	ShieldCheck,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/utils/api";
import { AiCapabilityMatrix } from "./ai-capability-matrix";
import {
	aiProviderIconKey,
	aiProviderIcons,
	aiTestStatusLabels,
	aiTestStatusStyles,
	formatAiTestDate,
} from "./ai-provider-meta";
import { HandleAi } from "./handle-ai";
import { HandleAiProviders } from "./handle-ai-providers";

type AiSetting = RouterOutputs["ai"]["getAll"][number];

const ConnectionBadge = ({ setting }: { setting: AiSetting }) => {
	const utils = api.useUtils();
	const { mutateAsync, isPending } = api.ai.testConnection.useMutation();
	const status = setting.lastTestStatus ?? "none";
	const label = isPending ? "Testing" : aiTestStatusLabels[status];
	const testedAt = formatAiTestDate(setting.lastTestedAt);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					disabled={isPending}
					onClick={async () => {
						try {
							await mutateAsync({
								aiId: setting.aiId,
								model: setting.model,
							});
							await utils.ai.getAll.invalidate();
							toast.success("Connection successful");
						} catch (error) {
							toast.error("Connection failed", {
								description: error instanceof Error ? error.message : undefined,
							});
							await utils.ai.getAll.invalidate();
						}
					}}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						aiTestStatusStyles[status],
					)}
				>
					{isPending ? (
						<Loader2 className="size-3 animate-spin" aria-hidden="true" />
					) : status === "success" ? (
						<ShieldCheck className="size-3" aria-hidden="true" />
					) : (
						<Activity className="size-3" aria-hidden="true" />
					)}
					{label}
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<div className="flex max-w-xs flex-col gap-1">
					<span>
						{setting.lastTestMessage ||
							(status === "none"
								? "No connection test has been run yet."
								: label)}
					</span>
					{testedAt && (
						<span className="text-xs opacity-80">Last test: {testedAt}</span>
					)}
					{setting.lastTestLatencyMs != null && (
						<span className="text-xs opacity-80">
							{setting.lastTestLatencyMs} ms
						</span>
					)}
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

export const ShowAiProviders = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const { data, isPending, refetch } = api.ai.getAll.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { mutateAsync } = api.ai.delete.useMutation();

	const count = data?.length ?? 0;
	const enabledCount = data?.filter((item) => item.isEnabled).length ?? 0;

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<Bot className="size-6 text-muted-foreground self-center" />
								AI Providers
							</CardTitle>
							<CardDescription>
								Connect cloud, self-hosted or internal AI endpoints so
								Notploy&apos;s AI features can use them without being tied to
								one vendor.
							</CardDescription>
						</CardHeader>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" className="tabular-nums">
								{count} configured
							</Badge>
							{count > 0 && (
								<Badge variant="outline" className="tabular-nums">
									{enabledCount} enabled
								</Badge>
							)}
							{permissions?.aiProvider.create && <HandleAiProviders />}
							{permissions?.aiProvider.create && <HandleAi />}
						</div>
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : count === 0 ? (
							<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
								<Bot className="size-8 text-muted-foreground" />
								<span className="font-medium text-muted-foreground">
									No AI providers configured
								</span>
								<span className="max-w-md text-center text-sm text-muted-foreground">
									Use <span className="font-medium">Add Provider</span> to
									connect OpenAI, Anthropic, a local Ollama instance, an
									internal gateway or any authorized OpenAI-compatible endpoint.
								</span>
								{permissions?.aiProvider.create && <HandleAi />}
							</div>
						) : (
							<>
								<ul className="flex flex-col gap-2">
									{data?.map((setting) => {
										const Icon =
											aiProviderIcons[aiProviderIconKey(setting.providerId)];
										return (
											<li
												key={setting.aiId}
												className="group flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring"
											>
												<Icon className="size-7 shrink-0" />
												<div className="flex min-w-0 flex-col gap-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="truncate text-sm font-medium">
															{setting.name}
														</span>
														<Badge
															variant={
																setting.isEnabled ? "secondary" : "outline"
															}
															className={cn(
																!setting.isEnabled && "text-muted-foreground",
															)}
														>
															{setting.isEnabled ? "Enabled" : "Disabled"}
														</Badge>
													</div>
													<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
														<span>{setting.providerLabel}</span>
														<span aria-hidden="true">·</span>
														<span className="font-mono">{setting.model}</span>
														{!setting.hasApiKey &&
															setting.providerId !== "ollama" && (
																<Badge variant="outline">No stored key</Badge>
															)}
													</div>
													<AiCapabilityMatrix
														capabilities={setting.capabilities}
														verifiedCapabilities={setting.verifiedCapabilities}
														compact
													/>
												</div>

												<div className="ml-auto flex flex-row items-center gap-1">
													<ConnectionBadge setting={setting} />
													{permissions?.aiProvider.update && (
														<HandleAi
															aiId={setting.aiId}
															trigger={
																<Button
																	variant="ghost"
																	size="icon"
																	className="text-muted-foreground"
																	aria-label="Edit provider"
																	title="Edit provider"
																>
																	<PenBoxIcon className="size-4" />
																</Button>
															}
														/>
													)}
													{permissions?.aiProvider.delete && (
														<Tooltip>
															<DialogAction
																title="Delete AI Provider"
																description="AI features using this provider will need another one. The stored API key is deleted with it. Are you sure?"
																type="destructive"
																onClick={async () => {
																	setRemovingId(setting.aiId);
																	await mutateAsync({
																		aiId: setting.aiId,
																	})
																		.then(() => {
																			toast.success("AI provider deleted");
																			refetch();
																		})
																		.catch(() => {
																			toast.error(
																				"Error deleting the AI provider",
																			);
																		})
																		.finally(() => setRemovingId(null));
																}}
															>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
																		isLoading={removingId === setting.aiId}
																	>
																		<Trash2 className="size-4" />
																		<span className="sr-only">
																			Delete provider
																		</span>
																	</Button>
																</TooltipTrigger>
															</DialogAction>
															<TooltipContent>Delete provider</TooltipContent>
														</Tooltip>
													)}
												</div>
											</li>
										);
									})}
								</ul>

								<div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
									<Sparkles className="mt-0.5 size-4 shrink-0" />
									<p>
										AI features such as Compose generation and log analysis
										resolve one of the enabled providers at run time. Open a
										provider&apos;s edit dialog to test its connection and see
										which capabilities are declared or verified.
									</p>
								</div>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
