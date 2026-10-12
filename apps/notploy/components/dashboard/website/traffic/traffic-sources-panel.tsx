import { KeyRound, PlayCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";
import {
	SECTION_STATE_LABELS,
	type TrafficSectionState,
} from "./section-state";
import { TrafficPropertyDialog } from "./traffic-property-dialog";
import {
	formatDateTime,
	formatRelativeMinutes,
	SOURCE_TYPE_LABELS,
} from "./traffic-types";

export interface TrafficSourceHealthRow {
	sourceId: string;
	propertyId: string;
	platform: string;
	domain: string;
	propertyName: string;
	propertyEnabled: boolean;
	type: string;
	enabled: boolean;
	status: string;
	derivedStatus: string;
	lastEventAt: string | null;
	lastAggregatedAt: string | null;
	lastError: string | null;
	lastErrorAt: string | null;
	lagMinutes: number | null;
	publicKey: string | null;
	logPath: string | null;
	warnings: string[];
}

interface TrafficSourcesPanelProps {
	health: TrafficSourceHealthRow[];
	hasProperties: boolean;
	isLoading: boolean;
	/** Retentions and schedules, shown so the policy is visible where it applies. */
	retention: { httpDays: number; audienceDays: number };
	collectorCron: string;
}

const STATUS_VARIANTS: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	active: "default",
	degraded: "secondary",
	"not-configured": "outline",
	unavailable: "destructive",
};

/**
 * Platforms, domains and collection sources.
 *
 * This is where an operator sees *why* a metric is missing: which domain is
 * watched, by which collector, whether it is enabled, when it last received
 * anything and what failed. Enabling a source and reading the log are offered
 * right here; declaring a new domain opens the dialog.
 */
export const TrafficSourcesPanel = ({
	health,
	hasProperties,
	isLoading,
	retention,
	collectorCron,
}: TrafficSourcesPanelProps) => {
	const utils = api.useUtils();
	const [installKey, setInstallKey] = useState<string | null>(null);

	const declareRecommended = api.traffic.declareRecommended.useMutation({
		onSuccess: async (result) => {
			await utils.traffic.invalidate();
			toast.success(
				`${result.created} properties declared, ${result.existing} already present`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const collectNow = api.traffic.collectNow.useMutation({
		onSuccess: async (report) => {
			await utils.traffic.invalidate();
			const failures = report.sources.filter((source) => source.error);
			if (failures.length > 0) {
				toast.warning(
					`Collected ${report.eventsAccepted} events, ${failures.length} sources reported a problem`,
				);
				return;
			}
			toast.success(
				`Collected ${report.eventsAccepted} events over ${report.propertiesTouched} properties`,
			);
		},
		onError: (error) => toast.error(error.message),
	});

	const upsertSource = api.traffic.upsertSource.useMutation({
		onSuccess: async () => {
			await utils.traffic.invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const installEndpoint =
		typeof window === "undefined" ? "" : window.location.origin;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="space-y-1">
					<h3 className="text-sm font-medium">
						Platforms, domains and sources
					</h3>
					<p className="text-xs text-muted-foreground">
						Retention: {retention.httpDays} days of HTTP aggregates,{" "}
						{retention.audienceDays} days of audience aggregates. Collection
						runs on the schedule <code>{collectorCron}</code>.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{!hasProperties && (
						<Button
							variant="outline"
							onClick={() => declareRecommended.mutate()}
							isLoading={declareRecommended.isPending}
						>
							Declare recommended SGE properties
						</Button>
					)}
					<TrafficPropertyDialog />
					<Button
						onClick={() => collectNow.mutate()}
						isLoading={collectNow.isPending}
						disabled={!hasProperties}
					>
						<PlayCircle className="size-4" aria-hidden />
						Collect now
					</Button>
				</div>
			</div>

			{!hasProperties && !isLoading && (
				<AlertBlock type="info">
					No web property is watched yet. Declare the SGE domains (or add your
					own) to let the Traffic Manager collect their traffic. Until a source
					actually receives data, the page reports “source not configured”
					instead of showing zeroes.
				</AlertBlock>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Sources</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Domain</TableHead>
								<TableHead>Source</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Last reception</TableHead>
								<TableHead>Last collection</TableHead>
								<TableHead className="text-right">Enabled</TableHead>
								<TableHead className="text-right">Details</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{health.map((row) => (
								<TableRow key={row.sourceId}>
									<TableCell>
										<div className="flex flex-col">
											<span>{row.domain}</span>
											<span className="text-xs text-muted-foreground">
												{row.platform}
												{!row.propertyEnabled ? " · property disabled" : ""}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-xs">
										{SOURCE_TYPE_LABELS[row.type] ?? row.type}
									</TableCell>
									<TableCell>
										<div className="flex flex-col gap-1">
											<Badge
												variant={
													STATUS_VARIANTS[row.derivedStatus] ?? "outline"
												}
												className="w-fit text-[11px]"
											>
												{SECTION_STATE_LABELS[
													row.derivedStatus as TrafficSectionState
												] ?? row.derivedStatus}
											</Badge>
											{row.status !== row.derivedStatus && (
												<span className="text-[11px] text-muted-foreground">
													collector reported: {row.status}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell className="text-xs">
										{formatRelativeMinutes(row.lagMinutes)}
										<span className="block text-muted-foreground">
											{formatDateTime(row.lastEventAt)}
										</span>
									</TableCell>
									<TableCell className="text-xs">
										{formatDateTime(row.lastAggregatedAt)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end">
											<Switch
												checked={row.enabled}
												aria-label={`Enable ${row.domain} ${row.type}`}
												onCheckedChange={(checked) =>
													upsertSource.mutate({
														propertyId: row.propertyId,
														type: row.type as
															| "traefik"
															| "web-instrumentation"
															| "external",
														enabled: checked,
													})
												}
											/>
										</div>
									</TableCell>
									<TableCell className="text-right">
										{row.type === "web-instrumentation" && row.publicKey && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setInstallKey(row.publicKey)}
											>
												{" "}
												<KeyRound className="size-4" aria-hidden />
												Install
											</Button>
										)}
										{row.type === "traefik" && (
											<span className="font-mono text-[11px] text-muted-foreground">
												{row.logPath ?? "default log path"}
											</span>
										)}
									</TableCell>
								</TableRow>
							))}
							{health.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-sm text-muted-foreground"
									>
										No collection source is declared.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
					{health.some((row) => row.warnings.length > 0) && (
						<div className="mt-4 space-y-2">
							{health
								.filter((row) => row.warnings.length > 0)
								.map((row) => (
									<div key={row.sourceId} className="flex items-start gap-2">
										<TriangleAlert
											className="mt-0.5 size-4 shrink-0 text-orange-500"
											aria-hidden
										/>
										<p className="text-xs text-muted-foreground">
											<span className="font-medium">{row.domain}</span>:{" "}
											{row.warnings.join(" ")}
										</p>
									</div>
								))}
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={installKey !== null}
				onOpenChange={() => setInstallKey(null)}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Install the web instrumentation</DialogTitle>
						<DialogDescription>
							Add this script to the site. It sends page views and the events
							you track; it never sends cookies, user agent, raw referrer URLs
							or IP-completing information.
						</DialogDescription>
					</DialogHeader>
					<pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
						{`<script defer src="${installEndpoint}/traffic.js"\n        data-property-key="${installKey ?? ""}"\n        data-endpoint="${installEndpoint}"></script>`}
					</pre>
					<pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
						{`// Explicit events (optional)\nwindow.notployTraffic.track("signup_completed");`}
					</pre>
					<AlertBlock type="info">
						The public key identifies the property; it is not a secret. The
						collector also enforces the origin allow-list, a per-site and a
						per-client rate limit, and a size cap on every batch.
					</AlertBlock>
					<DialogFooter>
						<Button variant="outline" onClick={() => setInstallKey(null)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
