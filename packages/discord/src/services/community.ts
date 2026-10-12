import type { BotConfig, LinkEntry } from "../types/index.js";

export interface AboutInfo {
	name: string;
	tagline: string;
	description: string;
	repository: string;
	license: string;
	maintainer: string;
}

const ABOUT: Omit<AboutInfo, "repository"> = {
	name: "Notploy",
	tagline: "Open-source, self-hostable deployment platform",
	description:
		"Notploy is an open-source platform for deploying and operating applications and databases. " +
		"It ships a web control plane, a desktop client and a mobile app, and can be self-hosted or used through Notploy Cloud.",
	license: "Apache-2.0",
	maintainer: "Sky Genesis Enterprise",
};

/** Sub-paths resolved against the configured documentation base URL. */
const DOC_PATHS: ReadonlyArray<{ label: string; path: string; description: string }> = [
	{ label: "Documentation home", path: "", description: "start here" },
	{ label: "Installation", path: "/docs/core/installation", description: "self-hosting and setup" },
	{ label: "Features", path: "/docs/core/features", description: "what Notploy can do" },
	{
		label: "Deployment options",
		path: "/docs/core/deployment-options",
		description: "how to run Notploy",
	},
];

/**
 * Read-only view of the official Notploy community resources.
 *
 * Pure data + URL composition; it performs no network access.
 */
export class CommunityService {
	constructor(private readonly config: BotConfig) {}

	get about(): AboutInfo {
		return { ...ABOUT, repository: this.config.resources.githubRepository };
	}

	/** Official links surfaced by `/links`. */
	officialLinks(): LinkEntry[] {
		const r = this.config.resources;
		return [
			{ label: "Website", url: r.website, description: "the official Notploy website" },
			{ label: "Documentation", url: r.docs, description: "guides and API reference" },
			{ label: "GitHub", url: r.githubUrl, description: "source code and issues" },
			{ label: "Templates", url: r.templates, description: "one-click application blueprints" },
			{ label: "Notploy Cloud", url: r.cloud, description: "managed hosting" },
			{ label: "Status", url: r.status, description: "public platform status" },
			{ label: "Discord", url: r.discordInvite, description: "join the community" },
		];
	}

	/** Documentation deep links surfaced by `/docs`. */
	docsLinks(): LinkEntry[] {
		const base = this.config.resources.docs.replace(/\/$/, "");
		return DOC_PATHS.map((doc) => ({
			label: doc.label,
			url: `${base}${doc.path}`,
			description: doc.description,
		}));
	}
}
