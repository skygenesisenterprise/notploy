export const SiteFooter = ({ name }: { name: string }) => (
	<footer className="mt-12 flex flex-col gap-1.5 border-t border-border py-8 text-xs text-muted-foreground">
		<p>
			© {new Date().getFullYear()} {name}. All rights reserved.
		</p>
		<p>
			Powered by Notploy Status —{" "}
			<a
				href="/api/v1/openapi.json"
				className="underline decoration-dotted underline-offset-2 hover:text-foreground"
			>
				API
			</a>{" "}
			·{" "}
			<a
				href="/api/v1/pages"
				className="underline decoration-dotted underline-offset-2 hover:text-foreground"
			>
				Status: pages
			</a>
		</p>
	</footer>
);
