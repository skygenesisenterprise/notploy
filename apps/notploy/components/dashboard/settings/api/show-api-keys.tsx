"use client";
import { formatDistanceToNow } from "date-fns";
import {
	ActivityIcon,
	ClockIcon,
	ExternalLinkIcon,
	KeyIcon,
	Loader2,
	Tag,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
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
import { api, type RouterOutputs } from "@/utils/api";
import { AddApiKey } from "./add-api-key";

type ApiKey = RouterOutputs["user"]["apiKeys"][number];

type KeyState = "active" | "disabled" | "expired";

/**
 * Derives the state of a key from the three fields that can make it stop
 * working. `enabled` is nullable in the schema — better-auth only ever writes
 * `true` for keys it created — so an absent value means "not disabled" and
 * must not be rendered as a disabled key.
 */
const stateOf = (key: ApiKey): KeyState => {
	if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
		return "expired";
	}
	if (key.enabled === false) return "disabled";
	return "active";
};

const STATE_BADGE: Record<
	KeyState,
	{ label: string; variant: "default" | "secondary" | "destructive" }
> = {
	active: { label: "Active", variant: "default" },
	disabled: { label: "Disabled", variant: "secondary" },
	expired: { label: "Expired", variant: "destructive" },
};

export const ShowApiKeys = () => {
	const {
		data: apiKeys,
		refetch,
		isLoading,
		isError,
		error,
	} = api.user.apiKeys.useQuery();
	const { mutateAsync: deleteApiKey, isPending: isLoadingDelete } =
		api.user.deleteApiKey.useMutation();
	const activeKeyCount = apiKeys?.filter(
		(apiKey) => stateOf(apiKey) === "active",
	).length;

	return (
		<Card className="w-full">
			<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
				<div>
					<CardTitle className="text-xl flex items-center gap-2">
						<KeyIcon className="size-5" />
						API Keys
					</CardTitle>
					<CardDescription>
						Personal keys authenticate your tools with Notploy. Secrets are
						shown only once when a key is created.
					</CardDescription>
					{activeKeyCount !== undefined && (
						<p className="mt-1 text-xs text-muted-foreground">
							{activeKeyCount} active {activeKeyCount === 1 ? "key" : "keys"}
						</p>
					)}
				</div>
				<div className="flex flex-row gap-2 max-sm:flex-wrap items-end">
					<span className="text-sm font-medium text-muted-foreground">
						Swagger API:
					</span>
					<Link
						href="/swagger"
						target="_blank"
						className="flex flex-row gap-2 items-center"
					>
						<span className="text-sm font-medium">View</span>
						<ExternalLinkIcon className="size-4" />
					</Link>
				</div>
			</CardHeader>
			<CardContent className="space-y-6 border-t pt-5">
				{isError ? (
					<AlertBlock type="error">
						{error instanceof Error
							? error.message
							: "Unable to load API keys."}
					</AlertBlock>
				) : isLoading ? (
					<div className="flex min-h-24 items-center justify-center">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{apiKeys && apiKeys.length > 0 ? (
							apiKeys.map((apiKey) => {
								const state = stateOf(apiKey);
								return (
									<div
										key={apiKey.id}
										className="flex flex-col gap-2 p-4 border rounded-lg"
									>
										<div className="flex justify-between items-start gap-2">
											<div className="flex flex-col gap-1 min-w-0">
												<span className="font-medium truncate">
													{apiKey.name}
												</span>
												<div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
													<Badge variant={STATE_BADGE[state].variant}>
														{STATE_BADGE[state].label}
													</Badge>
													{apiKey.prefix && (
														<Badge
															variant="secondary"
															className="flex items-center gap-1"
														>
															<Tag className="size-3.5" />
															{apiKey.prefix}
														</Badge>
													)}
													<span className="flex items-center gap-1">
														<ClockIcon className="size-3.5" />
														Created{" "}
														{formatDistanceToNow(new Date(apiKey.createdAt))}{" "}
														ago
													</span>
													<span className="flex items-center gap-1">
														<ActivityIcon className="size-3.5" />
														{apiKey.lastRequest
															? `Last used ${formatDistanceToNow(
																	new Date(apiKey.lastRequest),
																)} ago`
															: "Never used"}
													</span>
													{apiKey.expiresAt && (
														<Badge
															variant="outline"
															className="flex items-center gap-1"
														>
															<ClockIcon className="size-3.5" />
															Expires in{" "}
															{formatDistanceToNow(new Date(apiKey.expiresAt))}
														</Badge>
													)}
													{apiKey.rateLimitEnabled && (
														<Badge
															variant="outline"
															className="flex items-center gap-1"
														>
															{apiKey.rateLimitMax} req /{" "}
															{apiKey.rateLimitTimeWindow
																? formatDistanceToNow(
																		new Date(
																			Date.now() - apiKey.rateLimitTimeWindow,
																		),
																	)
																: "window"}
														</Badge>
													)}
												</div>
											</div>
											<DialogAction
												title="Delete API Key"
												description={`Any client still using “${apiKey.name}” will stop working immediately. This action cannot be undone.`}
												type="destructive"
												onClick={async () => {
													try {
														await deleteApiKey({ apiKeyId: apiKey.id });
														await refetch();
														toast.success("API key deleted successfully");
													} catch (error) {
														toast.error(
															error instanceof Error
																? error.message
																: "Error deleting API key",
														);
													}
												}}
											>
												<Button
													variant="ghost"
													size="icon"
													isLoading={isLoadingDelete}
													aria-label={`Delete ${apiKey.name}`}
												>
													<Trash2 className="size-4" />
												</Button>
											</DialogAction>
										</div>
									</div>
								);
							})
						) : (
							<div className="flex flex-col items-center gap-3 py-6">
								<KeyIcon className="size-8 text-muted-foreground" />
								<span className="text-base text-muted-foreground">
									No API keys found
								</span>
							</div>
						)}
					</div>
				)}

				<div className="flex justify-end border-t pt-4">
					<AddApiKey />
				</div>
			</CardContent>
		</Card>
	);
};
