import {
	AlertTriangle,
	ExternalLink,
	HeartPulse,
	Package,
	Tag,
} from "lucide-react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
	SummaryMetric,
} from "@/components/shared/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/utils/api";
import {
	COMMUNITY_ATTENTION_LABELS,
	formatCount,
	formatDateTime,
	formatRelative,
} from "./community-types";

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export const CommunityOverviewPanel = ({
	repositoryScope,
	preset,
	from,
	to,
}: {
	repositoryScope?: string[];
	preset: string;
	from?: string;
	to?: string;
}) => {
	const overview = api.community.overview.useQuery({
		preset: preset as "30d",
		from,
		to,
		repositoryIds: repositoryScope,
	});

	if (overview.isLoading) {
		return <ConsoleLoading label="Loading overview" />;
	}
	if (overview.error) {
		return (
			<AlertBlock type="error">
				{overview.error.message || "Could not load the overview."}
			</AlertBlock>
		);
	}
	const data = overview.data;
	if (!data) {
		return (
			<ConsoleEmpty
				icon={HeartPulse}
				title="No overview yet"
				description="Track at least one repository and run a sync to see community metrics."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<SummaryMetric
					label="Open issues"
					value={formatCount(data.openIssues)}
					detail={`${formatCount(data.repositories)} repositories tracked`}
				/>
				<SummaryMetric
					label="Open pull requests"
					value={formatCount(data.openPullRequests)}
					detail={`${formatCount(data.awaitingReview)} awaiting review`}
				/>
				<SummaryMetric
					label="Active contributors"
					value={formatCount(data.activeContributors)}
					detail="Distinct actors in the period"
				/>
				<SummaryMetric
					label="Merged pull requests"
					value={formatCount(data.mergedPullRequests)}
					detail="In the selected period"
				/>
				<SummaryMetric
					label="Unanswered issues"
					value={formatCount(data.unansweredIssues)}
					detail="No comment past the threshold"
				/>
				<SummaryMetric
					label="Unassigned"
					value={formatCount(data.unassigned)}
					detail="Issues or pull requests without an assignee"
				/>
				<SummaryMetric
					label="Releases published"
					value={formatCount(data.releasesInPeriod)}
					detail="In the selected period"
				/>
				<SummaryMetric
					label="Community events"
					value={formatCount(data.contributionsInPeriod)}
					detail="Events recorded in the period"
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				Last successful sync: {formatRelative(data.lastSyncedAt)}. Period-over-period
				changes are not shown because no historical aggregate is stored yet.
			</p>
		</div>
	);
};

/* -------------------------------------------------------------------------- */
/* Attention                                                                  */
/* -------------------------------------------------------------------------- */

export const CommunityAttentionPanel = ({
	repositoryScope,
}: {
	repositoryScope?: string[];
}) => {
	const attention = api.community.attention.useQuery({
		repositoryIds: repositoryScope,
		limit: 50,
	});

	if (attention.isLoading) {
		return <ConsoleLoading label="Loading contributions" />;
	}
	if (attention.error) {
		return (
			<AlertBlock type="error">
				{attention.error.message || "Could not load the attention list."}
			</AlertBlock>
		);
	}
	const items = attention.data ?? [];
	if (items.length === 0) {
		return (
			<ConsoleEmpty
				icon={AlertTriangle}
				title="Nothing needs attention"
				description="No open issue or pull request matches the configured rules. Rules are explicit: awaiting review, stale, unanswered and unassigned."
			/>
		);
	}

	return (
		<ul className="space-y-2">
			{items.map((item) => (
				<li key={item.id} className="rounded-md border p-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="text-[11px]">
									{item.kind === "pull-request" ? "PR" : "Issue"} #
									{item.number}
								</Badge>
								{item.attention.map((rule) => (
									<Badge
										key={rule}
										variant="secondary"
										className="text-[11px]"
									>
										{COMMUNITY_ATTENTION_LABELS[rule] ?? rule}
									</Badge>
								))}
							</div>
							<p className="font-medium">{item.title}</p>
							<p className="text-xs text-muted-foreground">
								{item.repositoryFullName} · opened{" "}
								{formatRelative(item.openedAt)}
								{item.author ? ` by ${item.author}` : ""}
							</p>
							<ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
								{item.reasons.map((reason) => (
									<li key={reason}>{reason}</li>
								))}
							</ul>
						</div>
						<Button variant="outline" size="sm" asChild>
							<a
								href={item.url}
								target="_blank"
								rel="noreferrer noopener"
							>
								<ExternalLink className="size-4" aria-hidden />
								Open on GitHub
							</a>
						</Button>
					</div>
				</li>
			))}
		</ul>
	);
};

/* -------------------------------------------------------------------------- */
/* Releases                                                                   */
/* -------------------------------------------------------------------------- */

export const CommunityReleasesPanel = ({
	repositoryScope,
}: {
	repositoryScope?: string[];
}) => {
	const releases = api.community.releases.useQuery({
		repositoryIds: repositoryScope,
		limit: 15,
	});

	if (releases.isLoading) {
		return <ConsoleLoading label="Loading releases" />;
	}
	if (releases.error) {
		return (
			<AlertBlock type="error">
				{releases.error.message || "Could not load the releases."}
			</AlertBlock>
		);
	}
	const items = releases.data ?? [];
	if (items.length === 0) {
		return (
			<ConsoleEmpty
				icon={Tag}
				title="No published release"
				description="Only published releases are listed: drafts and plain Git tags are excluded."
			/>
		);
	}

	return (
		<ul className="space-y-2">
			{items.map((release) => (
				<li
					key={release.id}
					className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<Package className="size-4 text-muted-foreground" aria-hidden />
							<span className="font-medium">{release.tagName}</span>
							{release.isPrerelease && (
								<Badge variant="outline" className="text-[11px]">
									pre-release
								</Badge>
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							{release.repositoryFullName} · published{" "}
							{formatDateTime(release.publishedAt)}
							{release.author ? ` by ${release.author}` : ""}
						</p>
					</div>
					<Button variant="outline" size="sm" asChild>
						<a href={release.url} target="_blank" rel="noreferrer noopener">
							<ExternalLink className="size-4" aria-hidden />
							Release notes
						</a>
					</Button>
				</li>
			))}
		</ul>
	);
};

/* -------------------------------------------------------------------------- */
/* Ecosystem health                                                           */
/* -------------------------------------------------------------------------- */

export const CommunityHealthPanel = ({
	repositoryScope,
}: {
	repositoryScope?: string[];
}) => {
	const health = api.community.health.useQuery({
		repositoryIds: repositoryScope,
	});

	if (health.isLoading) {
		return <ConsoleLoading label="Loading health checks" />;
	}
	if (health.error) {
		return (
			<AlertBlock type="error">
				{health.error.message || "Could not load the health report."}
			</AlertBlock>
		);
	}
	const data = health.data;
	if (!data || data.items.length === 0) {
		return (
			<ConsoleEmpty
				icon={HeartPulse}
				title="No repository to check"
				description="Track repositories to see which contribution resources are present."
			/>
		);
	}

	return (
		<div className="space-y-3">
			<AlertBlock type="info">
				These are presence indicators, not a quality verdict. A missing file is
				a suggestion to add one; a present file is not reviewed.
			</AlertBlock>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Contribution resources ({data.checkedRepositories} repositories)
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{data.items.map((item) => (
						<div key={item.repositoryId} className="space-y-1">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium">
									{item.repositoryFullName}
								</span>
								{item.healthPercentage !== null && (
									<Badge variant="secondary" className="text-[11px]">
										GitHub health {item.healthPercentage}%
									</Badge>
								)}
								<span className="text-xs text-muted-foreground">
									checked {formatRelative(item.checkedAt)}
								</span>
							</div>
							{item.missing.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									All checked resources are present.
								</p>
							) : (
								<p className="text-xs text-muted-foreground">
									Missing: {item.missing.join(", ")}
								</p>
							)}
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
};
