import { ChoicePanels } from "@/components/pages/PagePrimitives";
import { FeaturePageTemplate } from "@/components/pages/FeaturePageTemplate";
import { Container } from "@/components/Container";
import AnimatedGridPattern from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import {
	EyeOff,
	Fingerprint,
	KeyRound,
	Link2,
	Lock,
	Plug,
	Rocket,
	ScrollText,
	Server,
	Shield,
	ShieldCheck,
	SlidersHorizontal,
	UserCog,
	UserMinus,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Security, Access Control, & Governance",
	description:
		"Notploy gives teams enterprise-grade security with SSO, fine-grained RBAC, audit logs, and 2FA – built for compliance and infrastructure control.",
};

const ssoFeatures = [
	{
		icon: Link2,
		title: "Integrate with OIDC and SAML",
		description:
			"Notploy's SSO supports both OpenID Connect and SAML 2.0, so it works with virtually any enterprise IdP—no custom engineering work required.",
	},
	{
		icon: Plug,
		title: "Connect the providers you use",
		description:
			"Pre-configured integrations with Okta, Microsoft Entra ID, Auth0, Keycloak, and Zitadel. Any other compatible provider can be configured.",
	},
	{
		icon: UserMinus,
		title: "Centralize user provisioning",
		description:
			"When you add or remove a user in your IdP, it's reflected in Notploy. No parallel user management, no accounts lingering after someone leaves.",
	},
	{
		icon: ShieldCheck,
		title: "Enforce your auth policies",
		description:
			"MFA requirements, session timeouts, and conditional access rules configured in your IdP apply to Notploy automatically so your security posture stays consistent.",
	},
];

const rbacFeatures = [
	{
		icon: Users,
		plan: "All plans",
		title: "Assign built-in roles",
		description:
			"Every paid plan includes built-in Owner, Admin, and Member roles, giving you immediate control over who can manage the platform and who simply uses it, with no configuration needed.",
	},
	{
		icon: UserCog,
		plan: "Enterprise",
		title: "Build custom roles from scratch",
		description:
			"Go beyond the defaults by creating roles with the permissions each function needs: a “deployer” who can trigger releases but can't touch infrastructure, or a “viewer” who can just read logs.",
	},
	{
		icon: SlidersHorizontal,
		plan: "Enterprise",
		title: "Set permissions at the resource level",
		description:
			"Permissions span users, projects, services, servers, certificates, environment variables, domains, backups, and more—each with granular read, write, create, and delete controls.",
	},
	{
		icon: Rocket,
		plan: "Enterprise",
		title: "Control deployment access independently",
		description:
			"Deployment permissions are separate from service configuration permissions. A team member might be able to trigger a deploy without access to edit environment variables or infrastructure settings.",
	},
	{
		icon: EyeOff,
		plan: "Enterprise",
		title: "Restrict environment variable visibility",
		description:
			"Sensitive configuration values stay hidden from users whose roles don't include environment variable read access, even if they can deploy and manage the service itself.",
	},
	{
		icon: ScrollText,
		plan: "Enterprise",
		title: "Scope access to logs and monitoring",
		description:
			"Read access to application logs, audit entries, and server metrics—each one has separate permissions, so teams get the visibility they need without exposure to production configuration.",
	},
];

const auditLogItems = [
	{
		title: "Authentication events",
		description:
			"every login, logout, and session change, with timestamps and the user responsible",
	},
	{
		title: "User management",
		description: "role assignments, invitations, and member removals",
	},
	{
		title: "Deployments",
		description:
			"every deploy triggered, cancelled, or queued, with the user and resource named",
	},
	{
		title: "Infrastructure changes",
		description:
			"servers, certificates, SSH keys, registries, and S3 destinations",
	},
	{
		title: "Configuration changes",
		description:
			"environment variables, domains, backups, and scheduled jobs",
	},
	{
		title: "Powerful filtering",
		description:
			"filter by user, action type, resource type, or resource name to zero in on exactly what you need",
	},
];

const startupPlanFeatures = [
	"Built-in roles, including Admin and Developer",
	"Two-factor authentication (2FA)",
	"SSH key management",
	"SSL/TLS certificate management",
	"API key authentication",
	"Server security audit checks",
	"UFW firewall guidance",
	"Email and chat support",
];

const enterprisePlanFeatures = [
	"SSO/SAML (Okta, Azure AD, Auth0, Keycloak, Zitadel, and more)",
	"Fine-grained RBAC with custom roles",
	"Audit logs",
	"MSA/SLA",
	"Complete hosting flexibility (on-prem or your own cloud)",
	"Priority support",
];

const infrastructureFeatures = [
	{
		icon: Fingerprint,
		title: "Enable two-factor authentication",
		description:
			"Startup plans and above include 2FA for all users: an extra layer of protection on top of passwords, without needing SSO.",
	},
	{
		icon: Lock,
		title: "Automate SSL/TLS certificate management",
		description:
			"Notploy handles certificate provisioning and renewal automatically via Traefik, so your services stay encrypted without manual intervention or renewal tracking.",
	},
	{
		icon: KeyRound,
		title: "Authenticate with SSH keys, not passwords",
		description:
			"Notploy's built-in security checks recommend disabling password authentication on your servers and switching to key-based SSH. You can manage your keys directly within the platform.",
	},
	{
		icon: Server,
		title: "Keep your data on your own infrastructure",
		description:
			"Self-hosted Notploy means your deployments, credentials, and configurations stay on servers you control. No vendor accesses your environment.",
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
		icon: Shield,
		title: "RBAC",
		description:
			"Define exactly what each user can do once they're in Notploy, with granular role and permission controls across projects, services, and features.",
		href: "/features/role-based-access-control",
	},
	{
		icon: ScrollText,
		title: "Audit logs",
		description:
			"Keep a full record of every login, logout, and action taken across your Notploy environment for compliance and accountability.",
		href: "/features/audit-logs",
	},
];

const faqs = [
	{
		question: "What SSO providers does Notploy support?",
		answer:
			"Notploy supports any OIDC or SAML 2.0 provider. Pre-configured integrations are available for Okta, Azure AD (now Microsoft Entra ID), Auth0, Keycloak, and Zitadel. If your provider isn't listed, you can configure it manually using standard endpoints.",
	},
	{
		question: "Is RBAC available on every plan?",
		answer:
			"Basic role-based access control—Owner, Admin, and Member roles—is available from the Startup plan. There are Admin and Developer roles on the Startup plan. Custom roles with granular, resource-level permissions are an Enterprise feature.",
	},
	{
		question: "What does the audit log record?",
		answer:
			"Every meaningful action: logins and logouts, user and role changes, deployments, domain and certificate changes, environment variable edits, backup events, and infrastructure modifications.",
	},
	{
		question: "Does Notploy support SOC 2 or GDPR compliance?",
		answer:
			"Notploy's Enterprise features—SSO, custom RBAC, and audit logs—are designed to support compliance with SOC 2, GDPR, and internal governance requirements. For MSA/SLA and compliance documentation, contact the Notploy team.",
	},
	{
		question: "Can I use SSO on Notploy Cloud and self-hosted?",
		answer:
			"SSO is available on both Notploy Cloud and self-hosted Enterprise instances. Contact sales for configuration support.",
	},
];

export default function SecurityPage() {
	return (
		<FeaturePageTemplate
			badge="Capabilities"
			badgeDetail="Security & governance"
			title="Lock down your deployments"
			highlight="without blocking your team"
			description="Notploy gives you layered security at every level, from how your team authenticates to exactly what each user can access. Get SSO, custom roles, a complete audit trail, and host in your own secure environment."
			actions={
				<>
					<Button className="w-full rounded-full px-6 sm:w-auto" asChild>
						<Link href="https://app.notploy.com/register" target="_blank">
							Get Started
						</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full rounded-full px-6 sm:w-auto"
						asChild
					>
						<Link href="/contact">Contact sales</Link>
					</Button>
				</>
			}
			links={[
				{ href: "/enterprise", label: "Enterprise" },
				{ href: "/features/single-sign-on", label: "Single sign-on" },
				{ href: "/features/audit-logs", label: "Audit logs" },
			]}
			sections={[
				{
					id: "connect-identity-provider",
					title: "Connect any identity provider",
					description:
						"Enterprise users can authenticate through any OIDC or SAML 2.0-compatible identity provider. If your organization already runs Okta, Azure AD, or Keycloak, Notploy connects to it.",
					items: ssoFeatures,
					columns: 2,
					layout: "split",
				},
				{
					id: "control-user-access",
					title: "Control exactly what each user can access",
					description:
						"Role-based access control ships with every paid plan. Enterprise extends it with fully custom roles built from individual permissions across every resource type in the platform.",
					items: rbacFeatures,
					columns: 3,
				},
				{
					id: "know-who-did-what",
					title: "Know exactly who did what and when",
					description:
						"Audit Logs give Enterprise organizations a complete, filterable record of every action taken across the platform — essential for SOC 2, GDPR, and internal change management processes.",
					items: auditLogItems,
					columns: 3,
				},
				{
					id: "infrastructure-security",
					title: "Security from the infrastructure up",
					description:
						"Access control is only one part of the picture. Notploy is built with server-level security in mind, including built-in guidance to keep your infrastructure hardened alongside your access policies.",
					items: infrastructureFeatures,
					columns: 2,
					layout: "split",
				},
			]}
			related={{
				id: "security-in-depth",
				title: "Explore Notploy's security features in depth",
				description:
					"Dive deeper into the access control and governance features that keep your organization secure.",
				items: relatedFeatures,
				columns: 3,
			}}
			faqs={{
				id: "security-faqs",
				title: "Security and governance FAQs",
				description: "How access, audit and infrastructure security fit together.",
				items: faqs,
			}}
			finalCta={{
				title: "Deploy securely with Notploy",
				description:
					"Start shipping applications today with Notploy, safe in the knowledge that your environment is secure. For additional governance, choose our Enterprise plan.",
				cta: "Get Started",
				href: "https://app.notploy.com/register",
				external: true,
			}}
		>
			<ChoicePanels
				id="security-features-by-plan"
				title="Security features by plan"
				description="Core access controls come with every paid plan. Enterprise adds the layers that compliance-conscious teams and larger organizations need."
				panels={[
					{
						name: "Startup and above",
						tagline: "The essentials",
						description:
							"Core access controls for teams that are getting their deployment workflow under control.",
						bullets: startupPlanFeatures,
						cta: "See pricing",
						href: "/pricing",
					},
					{
						name: "Enterprise",
						tagline: "Governance at scale",
						description:
							"Everything in Startup, plus the governance layers required by larger and regulated organizations.",
						bullets: enterprisePlanFeatures,
						cta: "Contact sales",
						href: "/contact",
						highlighted: true,
					},
				]}
			/>
		</FeaturePageTemplate>
	);
}
