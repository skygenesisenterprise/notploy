import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	Shield,
	Users,
	FolderLock,
	SlidersHorizontal,
	UserPlus,
	KeyRound,
	ScrollText,
	Paintbrush,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Role-Based Access Control for Teams",
	description:
		"Control who can access what across your Notploy projects. Fine-grained RBAC keeps your infrastructure secure as your team scales.",
};

const coreFeatures = [
	{
		icon: Users,
		title: "Set organization-wide roles",
		description:
			"Assign owners, admins, and members across your organization, with each role scoping what that user can access and action within Notploy.",
	},
	{
		icon: FolderLock,
		title: "Grant project-level access",
		description:
			"Go beyond top-level roles and give individual users access to specific projects, services, or environments\u2014keeping sensitive deployments off-limits to those who don\u2019t need them.",
	},
	{
		icon: SlidersHorizontal,
		title: "Manage permissions for every workflow",
		description:
			"Enable or restrict actions at a granular level: creating projects, deploying services, accessing Docker, managing SSH keys, running the CLI, and more. Build a permission set that reflects how your team actually works.",
	},
	{
		icon: UserPlus,
		title: "Scale access as your team grows",
		description:
			"As you add engineers, contractors, stakeholders, and third parties, RBAC makes it straightforward to onboard them with the right level of access from day one\u2014and to update or revoke permissions as roles change.",
	},
];

const relatedFeatures = [
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
			"Keep a full record of every action taken across your Notploy environment for compliance and accountability.",
		href: "/features/audit-logs",
	},
	{
		icon: Paintbrush,
		title: "White labeling",
		description:
			"Present Notploy as your own product, with custom branding for your clients or organization.",
		href: "/features/white-labeling",
	},
];

export default function RoleBasedAccessControlPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Security & governance"
			title="Secure access"
			highlight="at every level"
			description="Give every team member the right permissions in your application deployment solution with fine-grained role-based access control — no more, no less."
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
			links={[{ href: "/features/security", label: "Security overview" }, { href: "/features/single-sign-on", label: "Single sign-on" }]}
			sections={[
				{
					id: "control-without-compromise",
					title: "Control without compromise",
					description:
						"RBAC in Notploy lets you define exactly what each person on your team can see, create, control, and manage.",
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
				title: "Ready to take your business to the next level?",
				description:
					"Talk to us about fine-grained RBAC and the rest of Notploy's higher-tier feature set.",
				cta: "Schedule a call",
				href: "/contact",
			}}
		/>
	);
}
