import { History, Rss, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface SiteHeaderProps {
	name: string;
	slug: string;
	/** Hide the admin entry point on the embedded admin shell. */
	showAdmin?: boolean;
}

export const SiteHeader = ({
	name,
	slug,
	showAdmin = true,
}: SiteHeaderProps) => (
	<header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
		<Link href={`/p/${slug}`} className="flex items-center gap-2.5">
			<span
				className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
				aria-hidden="true"
			>
				{name.slice(0, 1).toUpperCase()}
			</span>
			<span className="flex flex-col leading-tight">
				<span className="font-semibold">{name}</span>
				<span className="text-xs text-muted-foreground">Status</span>
			</span>
		</Link>
		<nav className="flex items-center gap-1 text-sm">
			<Link
				href={`/p/${slug}/history`}
				className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<History className="size-4" aria-hidden="true" />
				History
			</Link>
			<a
				href={`/api/v1/pages/${slug}/feed.xml`}
				className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<Rss className="size-4" aria-hidden="true" />
				RSS
			</a>
			{showAdmin ? (
				<Link
					href="/admin"
					className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					<ShieldCheck className="size-4" aria-hidden="true" />
					Admin
				</Link>
			) : null}
		</nav>
	</header>
);
