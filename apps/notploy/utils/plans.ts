/**
 * Notploy Cloud plan catalogue and pricing helpers.
 *
 * This module is the single source of truth for the plans we market (Hobby,
 * Startup, Enterprise) and for the price maths used by both the billing page
 * and the onboarding flow. It is intentionally dependency-free so it can be
 * imported from the client (React components) and the server (tRPC routers)
 * without pulling in Stripe, the database, or any other runtime.
 */

/** Resources that a plan can cap, mirroring the server-side `plan-limits`. */
export type PlanLimitResource =
	| "organization"
	| "member"
	| "environment"
	| "volumeBackup"
	| "databaseBackup"
	| "scheduledJob";

/** Marketing identity of a plan. Note `legacy` is a backend plan id, not sold here. */
export type PlanId = "hobby" | "startup" | "enterprise";

export interface PlanPricing {
	/** Price charged per billing period; `unit` says what it buys. */
	monthly: number;
	annual: number;
	unit: "server" | "account";
}

export interface PlanDefinition {
	id: PlanId;
	name: string;
	description: string;
	/** Highlighted as the recommended choice in the comparison grid. */
	recommended: boolean;
	/** Cannot be bought online; drives a "Contact Sales" call to action. */
	contactSales: boolean;
	/** Whether the plan can be purchased/started via Stripe checkout. */
	purchaseEnabled: boolean;
	/** Servers bundled before per-server pricing kicks in. */
	includedServers: number;
	/** `null` for plans without public pricing (Enterprise). */
	pricing: PlanPricing | null;
	features: string[];
}

export const STARTUP_SERVERS_INCLUDED = 3;

/**
 * Legacy / Hobby tiered pricing: $4.50/mo for the first server, $3.50 for the
 * rest; annual is $45.90 first then $35.70 per extra server.
 */
export const calculatePrice = (count: number, isAnnual = false) => {
	if (isAnnual) {
		if (count <= 1) return 45.9;
		return 35.7 * count;
	}
	if (count <= 1) return 4.5;
	return count * 3.5;
};

/** Hobby: $4.50/mo per server; annual 20% off = $43.20/yr per server. */
export const calculatePriceHobby = (count: number, isAnnual = false) => {
	const perServerMonthly = 4.5;
	const perServerAnnual = 43.2; // 4.5 * 12 * 0.8
	return isAnnual ? count * perServerAnnual : count * perServerMonthly;
};

/** Startup: 3 servers included ($15/mo); extra servers $4.50/mo each. Annual 20% off. */
export const calculatePriceStartup = (count: number, isAnnual = false) => {
	const baseMonthly = 15;
	const extraMonthly = 4.5;
	const baseAnnual = 144; // 15 * 12 * 0.8
	const extraAnnual = 43.2; // 4.5 * 12 * 0.8, consistent with Hobby annual
	if (count <= STARTUP_SERVERS_INCLUDED)
		return isAnnual ? baseAnnual : baseMonthly;
	return isAnnual
		? baseAnnual + (count - STARTUP_SERVERS_INCLUDED) * extraAnnual
		: baseMonthly + (count - STARTUP_SERVERS_INCLUDED) * extraMonthly;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
	{
		id: "hobby",
		name: "Hobby",
		description: "Everything an individual developer needs",
		recommended: false,
		contactSales: false,
		purchaseEnabled: true,
		includedServers: 1,
		pricing: { monthly: calculatePriceHobby(1, false), annual: calculatePriceHobby(1, true), unit: "server" },
		features: [
			"Unlimited Deployments",
			"Unlimited Databases",
			"Unlimited Applications",
			"Setup 1 Server",
			"1 Organization",
			"1 User",
			"2 Environments",
			"1 Volume Backup per Application",
			"1 Backup per Database",
			"1 Scheduled Job per Application",
			"Community Support (Discord)",
		],
	},
	{
		id: "startup",
		name: "Startup",
		description: "Perfect for small to mid-size teams",
		recommended: true,
		contactSales: false,
		purchaseEnabled: true,
		includedServers: STARTUP_SERVERS_INCLUDED,
		pricing: {
			monthly: calculatePriceStartup(STARTUP_SERVERS_INCLUDED, false),
			annual: calculatePriceStartup(STARTUP_SERVERS_INCLUDED, true),
			unit: "account",
		},
		features: [
			"All the features of Hobby, plus…",
			"Setup up to 3 Servers",
			"3 Organizations",
			"Unlimited Users",
			"Unlimited Environments",
			"Unlimited Volume Backups",
			"Unlimited Database Backups",
			"Unlimited Scheduled Jobs",
			"Basic RBAC (Admin, Developer)",
			"2FA",
			"Email and Chat Support",
		],
	},
	{
		id: "enterprise",
		name: "Enterprise",
		description: "For large organizations who want more control",
		recommended: false,
		contactSales: true,
		purchaseEnabled: false,
		includedServers: 0,
		pricing: null,
		features: [
			"All the features of Startup, plus…",
			"Up to Unlimited Servers",
			"Up to Unlimited Organizations",
			"Fine-grained RBAC",
			"Complete Hosting Flexibility",
			"SSO / SAML (Azure, OKTA, etc)",
			"Audit Logs",
			"MSA/SLA",
			"White Labeling",
			"Priority Support and Services",
		],
	},
];

/** Human-friendly labels for plan limit resources, shared by usage UIs. */
export const planLimitLabels: Record<PlanLimitResource, string> = {
	organization: "Organizations",
	member: "Members",
	environment: "Environments",
	volumeBackup: "Volume backups",
	databaseBackup: "Database backups",
	scheduledJob: "Scheduled jobs",
};

export const getPlanDefinition = (id: PlanId) =>
	PLAN_DEFINITIONS.find((plan) => plan.id === id);
