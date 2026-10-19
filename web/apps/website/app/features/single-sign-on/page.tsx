import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	KeyRound,
	Link2,
	Paintbrush,
	ScrollText,
	Shield,
	ShieldCheck,
	UserMinus,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Single Sign-On for Businesses and Enterprise Teams",
	description:
		"Connect Notploy to your existing identity provider with SSO. Centralize access control and keep your organization secure at scale.",
};

const coreFeatures = [
	{
		icon: Link2,
		title: "Connect your existing identity provider",
		description:
			"Notploy supports SSO via OpenID Connect (OIDC) and SAML, with native integrations for Okta, Azure AD (Microsoft Entra ID), Auth0, and Keycloak. If you use a different provider, you can configure it manually using standard OIDC or SAML endpoints.",
	},
	{
		icon: Users,
		title: "Remove friction for your team",
		description:
			"With SSO enabled, your team signs in to Notploy using the same credentials they use across the rest of your organization\u2014no extra passwords, no separate accounts to keep in sync.",
	},
	{
		icon: ShieldCheck,
		title: "Enforce centralized access policies",
		description:
			"Authentication flows through your identity provider, so you can apply your existing security policies\u2014MFA requirements, conditional access rules, session timeouts\u2014without configuring them separately in Notploy.",
	},
	{
		icon: UserMinus,
		title: "Provision and deprovision automatically",
		description:
			"With SCIM provisioning, your identity provider creates, updates, and deactivates Notploy accounts as your directory changes. When someone leaves, their access is revoked automatically\u2014no manual cleanup across multiple tools.",
	},
];

const relatedFeatures = [
	{
		icon: Shield,
		title: "RBAC",
		description:
			"Define exactly what each user can do once they\u2019re in Notploy, with granular role and permission controls across projects, services, and features.",
		href: "/features/role-based-access-control",
	},
	{
		icon: ScrollText,
		title: "Audit logs",
		description:
			"Keep a full record of every login, logout, and action taken across your Notploy environment for compliance and accountability.",
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

export default function SingleSignOnPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Security & governance"
			title="One login"
			highlight="for everyone"
			description="Connect Notploy to your identity provider and manage access from a single place. Available to Enterprise plan users and as a one-off additional feature."
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
			links={[{ href: "/features/security", label: "Security overview" }, { href: "/features/role-based-access-control", label: "Role-based access" }]}
			sections={[
				{
					id: "authentication-that-scales",
					title: "Authentication that scales with you",
					description:
						"Notploy's SSO support means your team logs in through the identity provider you already trust, so there are no separate credentials to manage.",
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
				title: "Ready to simplify access for your team?",
				description:
					"Talk to us about SSO and the rest of Notploy's security features.",
				cta: "Schedule a call",
				href: "/contact",
			}}
		/>
	);
}
