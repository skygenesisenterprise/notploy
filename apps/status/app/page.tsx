import { ServerCog } from "lucide-react";
import Link from "next/link";
import { StatusPageView } from "@/components/status-page";
import { defaultPageSlug, loadStatusPage } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function HomePage() {
	const slug = defaultPageSlug();
	const data = slug ? loadStatusPage(slug) : null;

	if (!data) {
		return (
			<div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
				<ServerCog
					className="size-8 text-muted-foreground"
					aria-hidden="true"
				/>
				<h1 className="text-xl font-semibold">No status page configured</h1>
				<p className="text-sm text-muted-foreground">
					Create the first status page from the administration console, then
					reload this page.
				</p>
				<Link
					href="/admin"
					className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
				>
					Open administration
				</Link>
			</div>
		);
	}

	return <StatusPageView {...data} />;
}
