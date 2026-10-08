import { coreSitePages } from "@/lib/site-navigation";
import { getPosts } from "@/lib/ghost";
import { getTemplates } from "@/lib/templates";
import type { MetadataRoute } from "next";

const BASE_URL = "https://notploy.com";

const featurePages = [
	"/features/application-deployment-platform",
	"/features/application-management-software",
	"/features/database-management-tool",
	"/features/security",
	"/features/role-based-access-control",
	"/features/single-sign-on",
	"/features/audit-logs",
	"/features/white-labeling",
];

const comparisonPages = [
	"/comparison",
	"/notploy-vs-coolify",
	"/notploy-vs-portainer",
	"/notploy-vs-caprover",
	"/notploy-vs-dokku",
	"/notploy-vs-render",
	"/notploy-vs-vercel",
];

const industryPages = [
	"/industries",
	"/industries/finance-banking",
	"/industries/agencies",
	"/industries/healthcare",
	"/industries/government",
	"/industries/manufacturing",
	"/industries/pharmaceuticals",
	"/industries/higher-education",
];

const legalPages = ["/terms-of-service", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const posts = await getPosts();
	const templates = await getTemplates();
	const now = new Date();

	return [
		{
			url: BASE_URL,
			lastModified: now,
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${BASE_URL}/blog`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		...coreSitePages.map(({ path, priority }) => ({
			url: `${BASE_URL}${path}`,
			lastModified: now,
			changeFrequency: "monthly" as const,
			priority,
		})),
		...featurePages.map((path) => ({
			url: `${BASE_URL}${path}`,
			lastModified: now,
			changeFrequency: "monthly" as const,
			priority: 0.7,
		})),
		...comparisonPages.map((path) => ({
			url: `${BASE_URL}${path}`,
			lastModified: now,
			changeFrequency: "monthly" as const,
			priority: 0.6,
		})),
		...industryPages.map((path) => ({
			url: `${BASE_URL}${path}`,
			lastModified: now,
			changeFrequency: "monthly" as const,
			priority: 0.7,
		})),
		...legalPages.map((path) => ({
			url: `${BASE_URL}${path}`,
			lastModified: now,
			changeFrequency: "yearly" as const,
			priority: 0.3,
		})),
		...posts.map((post) => ({
			url: `${BASE_URL}/blog/${post.slug}`,
			lastModified: new Date(post.published_at),
			changeFrequency: "monthly" as const,
			priority: 0.8,
		})),
		{
			url: `${BASE_URL}/templates`,
			lastModified: now,
			changeFrequency: "weekly" as const,
			priority: 0.8,
		},
		...templates.map((template) => ({
			url: `${BASE_URL}/templates/${template.id}`,
			lastModified: now,
			changeFrequency: "weekly" as const,
			priority: 0.7,
		})),
	];
}
