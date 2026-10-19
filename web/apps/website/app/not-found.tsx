import { PageHero } from "@/components/pages/PageHero";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="min-h-screen bg-background">
			<PageHero
				badge="404"
				badgeDetail="Page not found"
				title="This page"
				highlight="does not exist"
				description="The link may be out of date, or the page may have moved. Here are a few good places to continue."
				actions={
					<>
						<Button className="rounded-full" asChild>
							<Link href="/">Back to home</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link href="/platform">Explore the platform</Link>
						</Button>
					</>
				}
				links={[
					{ href: "/templates", label: "Templates" },
					{ href: "https://docs.notploy.com", label: "Documentation", external: true },
					{ href: "/contact", label: "Contact" },
				]}
			/>
		</div>
	);
}
