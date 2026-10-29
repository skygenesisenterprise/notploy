import { Rss, Webhook } from "lucide-react";
import Link from "next/link";

export const Subscribe = ({ slug }: { slug: string }) => (
	<section className="status-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
		<div className="flex flex-col gap-1">
			<h2 className="font-semibold">Subscribe to updates</h2>
			<p className="text-sm text-muted-foreground">
				Follow incidents through the RSS feed, or register a signed webhook for
				machine-readable events.
			</p>
		</div>
		<div className="flex flex-wrap gap-2">
			<a
				href={`/api/v1/pages/${slug}/feed.xml`}
				className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
			>
				<Rss className="size-4" aria-hidden="true" />
				RSS feed
			</a>
			<Link
				href="/admin"
				className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
			>
				<Webhook className="size-4" aria-hidden="true" />
				Webhooks
			</Link>
		</div>
	</section>
);
