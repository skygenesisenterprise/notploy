import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	ScrollText,
	Building2,
	Search,
	FileCheck,
	AlertCircle,
	Shield,
	KeyRound,
	Paintbrush,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Audit Logs for Enterprise Compliance",
	description:
		"Track every action across your Notploy organization. Audit logs give enterprise teams the visibility they need for security and compliance.",
};

const coreFeatures = [
	{
		icon: Building2,
		title: "Track actions across your whole organization",
		description:
			"Audit logs capture authentication events, user management changes, deployment activity, infrastructure updates, environment variable changes, backup configuration, and more. If it happened in Notploy, it\u2019s recorded.",
	},
	{
		icon: AlertCircle,
		title: "Investigate issues quickly",
		description:
			"Each log entry includes a timestamp, the user who performed the action, the action type, the resource affected, and the user\u2019s role in Notploy at the time. When something goes wrong, you have everything you need to trace it back to its source.",
	},
	{
		icon: Search,
		title: "Filter down to exactly what you need",
		description:
			"Search and filter audit logs by user, resource name, action type, or resource type so you can find the specific event you\u2019re looking for without scrolling through unrelated activity.",
	},
	{
		icon: FileCheck,
		title: "Meet compliance requirements with confidence",
		description:
			"Audit logs give you documented evidence of access control and change management, making it straightforward to satisfy requirements for SOC 2, GDPR, and internal security policies.",
	},
];

const relatedFeatures = [
	{
		icon: Shield,
		title: "RBAC",
		description:
			"Control who can perform the actions your audit logs record, with fine-grained permissions across projects and services.",
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
		icon: Paintbrush,
		title: "White labeling",
		description:
			"Present Notploy as your own product, with custom branding for your clients or organization.",
		href: "/features/white-labeling",
	},
];

export default function AuditLogsPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Security & governance"
			title="Full visibility into"
			highlight="every action taken"
			description="Know exactly who did what, and when, across your entire Notploy organization, with an audit trail built for security reviews, compliance and incident response."
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
			links={[{ href: "/features/security", label: "Security overview" }, { href: "/pricing", label: "Plans and pricing" }]}
			sections={[
				{
					id: "complete-record-of-changes",
					title: "A complete record of every change",
					description:
						"Every create, update, delete, deployment, and configuration change is logged — giving you a reliable trail for security, compliance, and debugging.",
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
				title: "Ready to take control?",
				description:
					"Talk to us about audit logs and the rest of Notploy's higher-tier features.",
				cta: "Schedule a call",
				href: "/contact",
			}}
		/>
	);
}
