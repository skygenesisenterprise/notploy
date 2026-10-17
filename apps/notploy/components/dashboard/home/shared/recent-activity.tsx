import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { HOME_TONES } from "../home-state";
import type { HomeActivityPanel } from "../types";
import { HomePanel, HomePanelMessage } from "./home-panel";

interface RecentActivityProps {
	title?: string;
	description?: string;
	panel: HomeActivityPanel;
	emptyMessage: string;
	action?: React.ReactNode;
}

/**
 * Recent operational activity. A failed source is stated instead of being
 * rendered as an empty list, and a source that could not be read is never
 * presented as "nothing happened".
 */
export const RecentActivityPanel = ({
	title = "Recent activity",
	description = "Events and operations that need a look",
	panel,
	emptyMessage,
	action,
}: RecentActivityProps) => {
	let body: React.ReactNode;

	if (panel.items.length > 0) {
		body = (
			<ul className="mt-3 divide-y border-t">
				{panel.items.map((item) => {
					const tone = HOME_TONES[item.tone ?? "neutral"];
					const content = (
						<>
							<span
								className={`size-2 shrink-0 rounded-full ${tone.dot}`}
								aria-hidden
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">
									{item.title}
								</span>
								{item.subtitle && (
									<span className="block truncate text-xs text-muted-foreground">
										{item.subtitle}
									</span>
								)}
							</span>
							{item.badge && (
								<Badge variant={tone.badge} className="hidden sm:inline-flex">
									{item.badge}
								</Badge>
							)}
							{item.meta && (
								<span className="shrink-0 text-xs text-muted-foreground">
									{item.meta}
								</span>
							)}
							<ArrowRight
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden
							/>
						</>
					);
					return (
						<li key={item.id}>
							{item.href ? (
								<Link
									href={item.href}
									className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
								>
									{content}
								</Link>
							) : (
								<div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
									{content}
								</div>
							)}
						</li>
					);
				})}
			</ul>
		);
	} else if (panel.state === "loading") {
		body = (
			<HomePanelMessage>
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-4 animate-spin" aria-hidden />
					Loading recent activity.
				</span>
			</HomePanelMessage>
		);
	} else if (panel.state === "restricted") {
		body = (
			<HomePanelMessage>
				{panel.message ?? "You do not have access to this activity."}
			</HomePanelMessage>
		);
	} else if (panel.state === "unavailable") {
		body = (
			<HomePanelMessage>
				{panel.message ?? "Recent activity is unavailable right now."}
			</HomePanelMessage>
		);
	} else {
		body = <HomePanelMessage>{emptyMessage}</HomePanelMessage>;
	}

	return (
		<HomePanel title={title} description={description} action={action}>
			{body}
			{panel.items.length > 0 && panel.message && (
				<p className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
					{panel.message}
				</p>
			)}
		</HomePanel>
	);
};
