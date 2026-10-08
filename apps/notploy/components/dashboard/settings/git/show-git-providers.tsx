import {
	Activity,
	ExternalLinkIcon,
	GitBranch,
	HeartPulse,
	Loader2,
	Trash2,
	Users,
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
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/utils/api";
import { GitCapabilityMatrix } from "./git-capability-matrix";
import {
	gitHealthLabels,
	gitProviderEndpoint,
	gitProviderIcon,
	gitProviderIsSelfHosted,
	gitProviderLabel,
	type GitProviderType,
	isGitProviderType,
} from "./git-provider-meta";
import { HandleGitProvider } from "./handle-git-provider";

type GitProvider = RouterOutputs["gitProvider"]["getAll"][number];
type GitProviderHealth = RouterOutputs["gitProvider"]["health"];

/** Host of a connection endpoint, shown next to its provider type. */
const endpointHost = (endpoint: string | null): string | null => {
	if (!endpoint) return null;
	try {
		return new URL(endpoint).host;
	} catch {
		return endpoint;
	}
};

/** Type-specific child id an edit needs, keyed by provider type. */
const providerChildId = (provider: GitProvider): string | null => {
	switch (provider.providerType) {
		case "github":
			return provider.github?.githubId ?? null;
		case "gitlab":
			return provider.gitlab?.gitlabId ?? null;
		case "gitea":
			return provider.gitea?.giteaId ?? null;
		case "bitbucket":
			return provider.bitbucket?.bitbucketId ?? null;
		default:
			return null;
	}
};

const healthStyles: Record<string, string> = {
	connected:
		"border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	needsAuthorization:
		"border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	misconfigured:
		"border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400",
	unreachable:
		"border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
	checking: "border-border bg-muted/40 text-muted-foreground",
};

interface HealthBadgeProps {
	health: GitProviderHealth | undefined;
	isPending: boolean;
	isError: boolean;
	isFetching: boolean;
	onRefetch: () => void;
}

const GitHealthBadge = ({
	health,
	isPending,
	isError,
	isFetching,
	onRefetch,
}: HealthBadgeProps) => {
	const status = isPending
		? "checking"
		: isError
			? "unreachable"
			: (health?.status ?? "unreachable");

	const label = status === "checking" ? "Checking" : gitHealthLabels[status];

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onRefetch();
					}}
					className={cn(
						"relative z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
						healthStyles[status],
					)}
				>
					{isPending || isFetching ? (
						<Loader2 className="size-3 animate-spin" aria-hidden="true" />
					) : (
						<HeartPulse className="size-3" aria-hidden="true" />
					)}
					{label}
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<div className="flex max-w-xs flex-col gap-1">
					{health?.message && <span>{health.message}</span>}
					{!health?.message && <span>{label}</span>}
					{health?.remediation && (
						<span className="text-xs opacity-80">{health.remediation}</span>
					)}
					{health?.identity?.login && (
						<span className="text-xs opacity-80">
							Acting as {health.identity.login}
						</span>
					)}
					{health?.latencyMs != null && (
						<span className="text-xs opacity-80">
							{health.latencyMs} ms
							{health.repositoryCount != null
								? ` · ${health.repositoryCount} repositor${
										health.repositoryCount === 1 ? "y" : "ies"
									}`
								: ""}
						</span>
					)}
					<span className="text-xs opacity-70">Click to re-check</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

interface RowProps {
	provider: GitProvider;
	canEdit: boolean;
	canDelete: boolean;
	isOrgAdmin: boolean;
	isToggling: boolean;
	isRemoving: boolean;
	onToggleShare: (shared: boolean) => void;
	onRemove: () => void;
}

const GitProviderRow = ({
	provider,
	canEdit,
	canDelete,
	isOrgAdmin,
	isToggling,
	isRemoving,
	onToggleShare,
	onRemove,
}: RowProps) => {
	const { data: health, isPending, isError, isFetching, refetch } =
		api.gitProvider.health.useQuery(
			{ gitProviderId: provider.gitProviderId },
			{ retry: false, refetchOnWindowFocus: false },
		);

	const ProviderIcon = gitProviderIcon(provider.providerType);
	const endpoint = gitProviderEndpoint(provider);
	const selfHosted = gitProviderIsSelfHosted(provider);
	const host = endpointHost(endpoint);
	const canManage = provider.isOwner || isOrgAdmin;
	const childId = providerChildId(provider);
	const providerType: GitProviderType | null = isGitProviderType(
		provider.providerType,
	)
		? provider.providerType
		: null;
	const viewUrl = endpoint;

	return (
		<li className="group relative flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring">
			<ProviderIcon className="size-7 shrink-0" />

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="truncate text-sm font-medium">
						{provider.name}
					</span>
					{!provider.isOwner && (
						<Badge variant="secondary" className="text-xs">
							<Users className="mr-1 size-3" />
							Shared
						</Badge>
					)}
					{provider.providerType === "bitbucket" &&
						provider.bitbucket?.isDeprecated && (
							<Badge variant="yellow">Deprecated</Badge>
						)}
					<span className="text-xs text-muted-foreground">
						{gitProviderLabel(provider.providerType)}
						{" · "}
						{selfHosted ? "self-hosted" : "SaaS"}
						{host ? ` · ${host}` : ""}
					</span>
				</div>

				{health?.identity?.login && (
					<span className="truncate text-xs text-muted-foreground">
						Connected as {health.identity.login}
					</span>
				)}

				{health?.capabilities && (
					<GitCapabilityMatrix
						capabilities={health.capabilities}
						compact
						max={5}
					/>
				)}
			</div>

			<div className="relative z-10 ml-auto flex shrink-0 flex-row items-center gap-1">
				{provider.isOwner && (
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1.5">
								<Users className="size-4 text-muted-foreground" />
								<Switch
									disabled={isToggling}
									checked={provider.sharedWithOrganization}
									onCheckedChange={(checked) => onToggleShare(checked)}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>Share with entire organization</TooltipContent>
					</Tooltip>
				)}

				<GitHealthBadge
					health={health}
					isPending={isPending}
					isError={isError}
					isFetching={isFetching}
					onRefetch={() => void refetch()}
				/>

				{viewUrl && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
								asChild
							>
								<a
									href={viewUrl}
									target="_blank"
									rel="noreferrer noopener"
									onClick={(event) => event.stopPropagation()}
								>
									<ExternalLinkIcon className="size-4" />
									<span className="sr-only">Open provider</span>
								</a>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open provider</TooltipContent>
					</Tooltip>
				)}

				{canManage && canEdit && childId && providerType && (
					<HandleGitProvider
						gitProviderId={provider.gitProviderId}
						providerType={providerType}
						providerId={childId}
					/>
				)}

				{canManage && canDelete && (
					<Tooltip>
						<DialogAction
							title="Delete Git Provider"
							description={
								provider.sharedWithOrganization
									? "This provider is shared with the organization. Deleting it will remove access for all members. Are you sure?"
									: "Applications and services deploying from this provider will lose access. Are you sure?"
							}
							type="destructive"
							onClick={onRemove}
						>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
									isLoading={isRemoving}
								>
									<Trash2 className="size-4" />
									<span className="sr-only">Delete provider</span>
								</Button>
							</TooltipTrigger>
						</DialogAction>
						<TooltipContent>Delete provider</TooltipContent>
					</Tooltip>
				)}
			</div>
		</li>
	);
};

export const ShowGitProviders = () => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const { data, isPending, refetch } = api.gitProvider.getAll.useQuery();
	const { mutateAsync: toggleShare, isPending: isToggling } =
		api.gitProvider.toggleShare.useMutation();
	const { mutateAsync: remove } = api.gitProvider.remove.useMutation();
	const { data: currentMember } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const isOrgAdmin =
		currentMember?.role === "owner" || currentMember?.role === "admin";
	const connectedCount = data?.length ?? 0;

	return (
		<TooltipProvider delayDuration={0}>
			<div className="w-full">
				<Card className="h-full bg-sidebar p-2.5 rounded-xl">
					<div className="rounded-xl bg-background shadow-md">
						<div className="flex flex-wrap items-center justify-between gap-4 p-6">
							<CardHeader className="flex-1 p-0">
								<CardTitle className="text-xl flex flex-row gap-2">
									<GitBranch className="size-6 text-muted-foreground self-center" />
									Git Providers
								</CardTitle>
								<CardDescription>
									Connect the Git forges Notploy deploys from, so it can list
									repositories, resolve commits and report each connection's
									health and capabilities.
								</CardDescription>
							</CardHeader>
							<div className="flex items-center gap-2">
								<Badge variant="secondary" className="tabular-nums">
									{connectedCount} connected
								</Badge>
								{permissions?.gitProviders.create && <HandleGitProvider />}
							</div>
						</div>

						<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
							{isPending ? (
								<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
									<span>Loading...</span>
									<Loader2 className="animate-spin size-4" />
								</div>
							) : connectedCount === 0 ? (
								<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
									<Activity className="size-8 text-muted-foreground" />
									<span className="font-medium text-muted-foreground">
										No Git providers connected
									</span>
									<span className="max-w-sm text-center text-sm text-muted-foreground">
										Use <span className="font-medium">Add Provider</span> to
										connect GitHub, GitLab, Bitbucket or Gitea — at its SaaS
										endpoint or a self-hosted instance.
									</span>
								</div>
							) : (
								<ul className="flex flex-col gap-2">
									{data?.map((provider) => (
										<GitProviderRow
											key={provider.gitProviderId}
											provider={provider}
											canEdit={!!permissions?.gitProviders.update}
											canDelete={!!permissions?.gitProviders.delete}
											isOrgAdmin={isOrgAdmin}
											isToggling={isToggling}
											isRemoving={removingId === provider.gitProviderId}
											onToggleShare={(checked) => {
												void toggleShare({
													gitProviderId: provider.gitProviderId,
													sharedWithOrganization: checked,
												})
													.then(() => {
														toast.success(
															checked
																? "Provider shared with organization"
																: "Provider unshared",
														);
														refetch();
													})
													.catch(() => {
														toast.error("Error updating sharing");
													});
											}}
											onRemove={async () => {
												setRemovingId(provider.gitProviderId);
												await remove({ gitProviderId: provider.gitProviderId })
													.then(() => {
														toast.success("Git provider deleted");
														refetch();
													})
													.catch(() => {
														toast.error("Error deleting the Git provider");
													})
													.finally(() => setRemovingId(null));
											}}
										/>
									))}
								</ul>
							)}
						</CardContent>
					</div>
				</Card>
			</div>
		</TooltipProvider>
	);
};
