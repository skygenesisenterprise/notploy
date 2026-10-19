import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	Paintbrush,
	Type,
	Palette,
	Link2,
	MonitorCheck,
	Shield,
	KeyRound,
	ScrollText,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "White Label Deployment Platform",
	description:
		"Rebrand Notploy as your own product. Customize the name, logo, colors and more to deliver a seamless experience under your own brand.",
};

const coreFeatures = [
	{
		icon: Type,
		title: "Customize your name and logo",
		description:
			"Replace Notploy across the entire interface with your own application name. Upload your logo for the sidebar, header, and login page, and set a custom favicon so your branding carries through to the browser tab.",
	},
	{
		icon: Palette,
		title: "Style the interface to match your brand",
		description:
			"The custom CSS editor gives you direct control over the look and feel of the platform. Load the default theme variables as a starting point, then adjust colors, backgrounds, and button styles to match your brand guidelines.",
	},
	{
		icon: Link2,
		title: "Control the metadata and support links",
		description:
			"Set your own page title, footer text, sidebar links, and more for documentation and support, so users are always directed to your resources, not Notploy\u2019s.",
	},
	{
		icon: MonitorCheck,
		title: "Preview changes before you ship them",
		description:
			"The live preview panel shows how your branding will look across key parts of the interface before you save anything, reducing the risk of pushing changes that break your user experience.",
	},
];

const relatedFeatures = [
	{
		icon: Shield,
		title: "RBAC",
		description:
			"Define exactly what each user can do once they\u2019re in Notploy, with fine-grained permissions across projects, features, and services.",
		href: "/features/role-based-access-control",
	},
	{
		icon: KeyRound,
		title: "SSO",
		description:
			"Centralize authentication with your existing identity provider for secure, seamless access across your organization.",
		href: "/features/single-sign-on",
	},
	{
		icon: ScrollText,
		title: "Audit logs",
		description:
			"Keep a full record of every action taken across your environment for compliance and accountability.",
		href: "/features/audit-logs",
	},
];

export default function WhiteLabelingPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Enterprise & agencies"
			title="Your platform,"
			highlight="your own brand"
			description="Replace every Notploy mention with your own name, logo, branding, and visual identity — and hand clients a deployment platform that looks entirely yours."
			actions={
				<>
					<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
						<Link href="/contact">Contact sales</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full rounded-full px-6 sm:w-auto"
						asChild
					>
						<Link href="https://docs.notploy.com/docs/core" target="_blank">
							View documentation
						</Link>
					</Button>
				</>
			}
			links={[{ href: "/enterprise", label: "Notploy Enterprise" }, { href: "/partners", label: "Partner program" }]}
			sections={[
				{
					id: "your-product-your-brand",
					title: "Your product, your brand",
					description:
						"Notploy's white labeling lets enterprise teams and agencies deliver a fully branded, professional deployment platform.",
					items: coreFeatures,
					columns: 2,
					layout: "split",
				},
			]}
			related={{
				id: "powerful-features",
				title: "Powerful features for growing teams",
				description:
					"Notploy scales with your team, with features and plans for when you're ready to take the next step.",
				items: relatedFeatures,
				columns: 3,
			}}
			finalCta={{
				title: "Ready to launch your own platform?",
				description:
					"Talk to us about white labeling and the rest of Notploy's higher-tier features.",
				cta: "Schedule a call",
				href: "/contact",
			}}
		/>
	);
}
