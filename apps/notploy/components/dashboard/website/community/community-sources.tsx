import { Github, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";
import {
	COMMUNITY_SOURCE_STATUS_LABELS,
	formatRelative,
} from "./community-types";

/**
 * Data sources of the Community page.
 *
 * A source is a GitHub connection plus the account being followed. This panel is
 * the only place credentials are involved, and it never displays them: it lists
 * the connections the user already created elsewhere in the Console and lets
 * them pick one. When none is configured the page says so instead of faking a
 * connection.
 */
export const CommunitySourcesPanel = ({
	onSynced,
}: {
	onSynced: () => void;
}) => {
	const utils = api.useUtils();
	const [providerId, setProviderId] = useState("");
	const [owner, setOwner] = useState("");
	const [error, setError] = useState<string | null>(null);

	const providersQuery = api.gitProvider.getAll.useQuery();
	const sourcesQuery = api.community.sources.useQuery();

	const githubProviders = (providersQuery.data ?? []).filter(
		(provider) => provider.providerType === "github" && provider.github,
	);

	const createSource = api.community.createSource.useMutation({
		onSuccess: async () => {
			setOwner("");
			setError(null);
			await utils.community.sources.invalidate();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const removeSource = api.community.removeSource.useMutation({
		onSuccess: async () => {
			await utils.community.invalidate();
			onSynced();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	const updateSource = api.community.updateSource.useMutation({
		onSuccess: () => void utils.community.sources.invalidate(),
		onError: (mutationError) => setError(mutationError.message),
	});

	const syncNow = api.community.syncNow.useMutation({
		onSuccess: async () => {
			await utils.community.invalidate();
			onSynced();
		},
		onError: (mutationError) => setError(mutationError.message),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Github className="size-4" aria-hidden />
					Sources
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{error && (
					<AlertBlock type="error">
						<span className="font-medium">Action failed</span> — {error}
					</AlertBlock>
				)}

				{sourcesQuery.isLoading ? (
					<ConsoleLoading label="Loading sources" />
				) : (sourcesQuery.data ?? []).length === 0 ? (
					<ConsoleEmpty
						icon={Github}
						title="No GitHub source yet"
						description="Connect a GitHub App and follow an account or organization to start tracking its repositories. No token is ever entered here: the connection is created in Git settings."
					/>
				) : (
					<ul className="space-y-2">
						{(sourcesQuery.data ?? []).map((source) => {
							const isStale =
								!source.lastSuccessfulSyncAt ||
								Date.now() -
									new Date(source.lastSuccessfulSyncAt).getTime() >
									60 * 60 * 1000;
							return (
								<li
									key={source.id}
									className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">
												{source.owner}
											</span>
											<Badge
												variant="outline"
												className="text-[11px]"
											>
												{COMMUNITY_SOURCE_STATUS_LABELS[source.status] ??
													source.status}
											</Badge>
											<Badge variant="secondary" className="text-[11px]">
												{source.repositoryCount} tracked
											</Badge>
											{isStale && (
												<Badge variant="outline" className="text-[11px]">
													possibly stale
												</Badge>
											)}
										</div>
										<p className="text-xs text-muted-foreground">
											{source.providerName} · last sync{" "}
											{formatRelative(source.lastSyncedAt)}
											{source.lastError ? ` · ${source.lastError}` : ""}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												syncNow.mutate({ sourceId: source.id })
											}
											disabled={syncNow.isPending}
										>
											<RefreshCw
												className={`size-4 ${
													syncNow.isPending ? "animate-spin" : ""
												}`}
												aria-hidden
											/>
											Sync now
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												updateSource.mutate({
													sourceId: source.id,
													enabled: !source.enabled,
												})
											}
											disabled={updateSource.isPending}
										>
											{source.enabled ? "Disable" : "Enable"}
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() =>
												removeSource.mutate({ sourceId: source.id })
											}
											disabled={removeSource.isPending}
											aria-label={`Remove ${source.owner}`}
										>
											<Trash2 className="size-4" aria-hidden />
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				)}

				<div className="space-y-3 rounded-md border border-dashed p-3">
					<p className="text-sm font-medium">Follow a GitHub account</p>
					{providersQuery.isLoading ? (
						<ConsoleLoading label="Loading GitHub connections" />
					) : githubProviders.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No GitHub App is configured. Install one from{" "}
							<a
								className="underline"
								href="/dashboard/settings/git"
							>
								Git settings
							</a>
							, then come back here.
						</p>
					) : (
						<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
							<div className="space-y-1">
								<Label htmlFor="community-provider">Connection</Label>
								<Select
									value={providerId}
									onValueChange={setProviderId}
								>
									<SelectTrigger
										id="community-provider"
										className="w-[220px]"
									>
										<SelectValue placeholder="Select a connection" />
									</SelectTrigger>
									<SelectContent>
										{githubProviders.map((provider) => (
											<SelectItem
												key={provider.gitProviderId}
												value={provider.gitProviderId}
											>
												{provider.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label htmlFor="community-owner">
									Account or organization
								</Label>
								<Input
									id="community-owner"
									placeholder="skygenesisenterprise"
									value={owner}
									onChange={(event) => setOwner(event.target.value)}
									className="w-[240px]"
								/>
							</div>
							<Button
								onClick={() =>
									createSource.mutate({
										gitProviderId: providerId,
										owner: owner.trim(),
									})
								}
								disabled={
									createSource.isPending ||
									!providerId ||
									owner.trim().length === 0
								}
							>
								<Plus className="size-4" aria-hidden />
								Follow
							</Button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};
