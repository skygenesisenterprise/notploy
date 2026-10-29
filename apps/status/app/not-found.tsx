import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
			<SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
			<h1 className="text-xl font-semibold">Status page not found</h1>
			<p className="text-sm text-muted-foreground">
				The requested status page does not exist, or is no longer published.
			</p>
			<Link
				href="/"
				className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
			>
				Back to status
			</Link>
		</div>
	);
}
