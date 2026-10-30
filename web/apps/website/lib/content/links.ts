/**
 * Every public destination used by the marketing site, in one place.
 *
 * Rules:
 * - Internal navigation targets are paths, so the static export keeps working.
 * - Cloud signup is NOT linked from marketing copy until the public onboarding
 *   endpoint is verified; `/cloud` is the canonical entry point.
 * - Documentation URLs live under docs.notploy.com; `comparison` replaces the
 *   older `differences` slug, which is not part of the docs navigation anymore.
 */

export const SITE_URL = "https://notploy.com";

export const links = {
	/** Existing customer sessions. Not a marketing call to action. */
	app: {
		signIn: "https://app.notploy.com/",
	},
	docs: {
		home: "https://docs.notploy.com/docs/core",
		install: "https://docs.notploy.com/docs/core/installation",
		architecture: "https://docs.notploy.com/docs/core/architecture",
		comparison: "https://docs.notploy.com/docs/core/comparison",
		philosophy: "https://docs.notploy.com/docs/core/philosophy",
		featureMatrix: "https://docs.notploy.com/docs/core/feature-matrix",
		limitations: "https://docs.notploy.com/docs/core/limitations",
		cloud: "https://docs.notploy.com/docs/core/cloud",
		cloudOnboarding: "https://docs.notploy.com/docs/core/cloud-onboarding",
		sso: "https://docs.notploy.com/docs/core/sso",
		auditLogs: "https://docs.notploy.com/docs/core/audit-logs",
		ai: "https://docs.notploy.com/docs/core/ai",
		security: "https://docs.notploy.com/docs/core/vulnerability-disclosure",
	},
	github: {
		repo: "https://github.com/skygenesisenterprise/notploy",
		discussions: "https://github.com/skygenesisenterprise/notploy/discussions",
		issues: "https://github.com/skygenesisenterprise/notploy/issues",
		releases: "https://github.com/skygenesisenterprise/notploy/releases",
	},
	community: {
		discord: "https://discord.gg/GUkDugVh34",
	},
	templates: "https://templates.notploy.com",
	/** Verified reachable (HTTP 200) at the time of the redesign. */
	status: "https://status.notploy.com",
	install: {
		linux: "curl -sSL https://notploy.com/install.sh | sh",
		windows: "irm https://notploy.com/install.ps1 | iex",
	},
} as const;
