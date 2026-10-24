import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { HomePanel, HomePanelMessage } from "../shared/home-panel";
import { HOME_TONES } from "../home-state";
import type { HomeTone } from "../types";
import type {
	ConsoleAttentionItem,
	ConsoleAttentionModel,
	ConsoleSeverity,
} from "./console-home-data";

const severityTone: Record<ConsoleSeverity, HomeTone> = {
	critical: "critical",
	warning: "warning",
	info: "info",
};

const CoverageRow = ({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone: HomeTone;
}) => (
	<div className="flex min-w-0 items-baseline justify-between gap-3">
		<span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
			<span
				className={`size-1.5 shrink-0 rounded-full ${HOME_TONES[tone].dot}`}
				aria-hidden
			/>
			<span className="truncate">{label}</span>
		</span>
		<span className="shrink-0 text-right text-foreground">{value}</span>
	</div>
);

const AttentionRow = ({ item }: { item: ConsoleAttentionItem }) => {
	const tone = HOME_TONES[severityTone[item.severity]];

	const content = (
		<>
			<span className={`mt-1 h-8 w-0.5 shrink-0 rounded-full ${tone.bar}`} aria-hidden />
			<span className="min-w-0 flex-1 space-y-1">
				<span className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-medium">{item.title}</span>
					<Badge variant={tone.badge}>{item.severity}</Badge>
					{item.state && (
						<Badge variant="outline" className="font-normal">
							{item.state}
						</Badge>
					)}
				</span>
				{item.description && (
					<span className="block text-xs text-muted-foreground">
						{item.description}
					</span>
				)}
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
					<span>{item.source}</span>
					{item.resource && <span>· {item.resource}</span>}
					{item.meta && <span>· {item.meta}</span>}
				</span>
			</span>
			{item.href && (
				<ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
			)}
		</>
	);

	return item.href ? (
		<Link
			href={item.href}
			className="flex min-w-0 items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
		>
			{content}
		</Link>
	) : (
		<div className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">{content}</div>
	);
};

export const ConsoleAttentionPanel = ({
	attention,
}: {
	attention: ConsoleAttentionModel;
}) => {
	let body: React.ReactNode;

	if (attention.state === "loading" && attention.items.length === 0) {
		body = (
			<HomePanelMessage>
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Reading the operational sources.
				</span>
			</HomePanelMessage>
		);
	} else if (attention.items.length > 0) {
		body = (
			<ul className="divide-y">
				{attention.items.map((item) => (
					<li key={item.id}>
						<AttentionRow item={item} />
					</li>
				))}
			</ul>
		);
	} else if (attention.state === "unavailable") {
		body = (
			<HomePanelMessage>
				{attention.message ??
					"No operational source could be read, so the absence of a signal is not an absence of incident."}
			</HomePanelMessage>
		);
	} else if (attention.state === "restricted") {
		body = (
			<HomePanelMessage>
				{attention.message ??
					"No source this account may read can report an operational signal."}
			</HomePanelMessage>
		);
	} else if (attention.state === "loading") {
		body = (
			<HomePanelMessage>
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Some sources are still answering.
				</span>
			</HomePanelMessage>
		);
	} else {
		body = (
			<div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-6 text-center">
				<ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
				<p className="text-sm font-medium">No signal requires action</p>
				<p className="max-w-md text-xs text-muted-foreground">
					Every source listed below answered and reported nothing open. This is
					not a claim that unmonitored components are healthy.
				</p>
			</div>
		);
	}

	return (
		<HomePanel
			title="Needs attention"
			description={
				attention.total > 0
					? `${attention.total} signal(s), most severe first`
					: "Ranked from the sources this console can read"
			}
			action={
				<Link
					href="/dashboard/incidents"
					className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Incidents <ArrowRight className="size-3.5" aria-hidden />
				</Link>
			}
		>
			{body}
			<div className="space-y-1.5 border-t px-4 py-3 text-[11px] sm:px-5">
				<p className="font-medium uppercase tracking-wide text-muted-foreground">
					Source coverage
				</p>
				<div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
					{attention.coverage.map((line) => (
						<CoverageRow
							key={line.id}
							label={line.label}
							value={line.value}
							tone={line.tone}
						/>
					))}
				</div>
				{attention.message && (
					<p className="pt-1 text-amber-600 dark:text-amber-400">{attention.message}</p>
				)}
			</div>
		</HomePanel>
	);
};
