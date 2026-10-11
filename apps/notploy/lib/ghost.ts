import GhostContentAPI from "@tryghost/content-api";

const ghostConfig = {
	url: process.env.GHOST_URL || "https://notploy.com",
	key: process.env.GHOST_KEY || "42424242424242424242424242424242",
	version: "v5.0",
};

const api = GhostContentAPI({
	url: ghostConfig.url,
	key: ghostConfig.key,
	version: ghostConfig.version,
	// @ts-ignore
	makeRequest: ({ url, method, params, headers }) => {
		const apiUrl = new URL(url);
		// Slug is already in the path; Ghost returns 422 if we also send it as query param
		const { slug: _slug, ...queryParams } = params;
		for (const key of Object.keys(queryParams)) {
			apiUrl.searchParams.set(key, encodeURIComponent(queryParams[key]));
		}

		return fetch(apiUrl.toString(), { method, headers })
			.then(async (res) => {
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				return { data: await res.json() };
			})
			.catch((error) => {
				console.error("Fetch error:", error);
				throw error;
			});
	},
});

export interface Post {
	id: string;
	uuid: string;
	title: string;
	slug: string;
	html: string;
	feature_image: string | null;
	featured: boolean;
	visibility: string;
	created_at: string;
	updated_at: string;
	published_at: string;
	custom_excerpt: string | null;
	excerpt: string;
	reading_time: number;
	primary_tag?: {
		id: string;
		name: string;
		slug: string;
	};
	tags?: Array<{
		id: string;
		name: string;
		slug: string;
	}>;
	primary_author?: {
		id: string;
		name: string;
		slug: string;
		profile_image: string | null;
		bio: string | null;
		twitter: string | null;
	};
	authors?: Array<{
		id: string;
		name: string;
		slug: string;
		profile_image: string | null;
		bio: string | null;
	}>;
	url: string;
}

export interface Tag {
	id: string;
	name: string;
	slug: string;
}

/**
 * Job offers reuse the blog pipeline: each offer is a Ghost post carrying the
 * `job` tag, while the offer-specific data rides on prefixed tags so it stays
 * filterable and avoids a second datastore.
 */
export const JOBS_TAG = "job";
export const LOCATION_TAG_PREFIX = "location:";
export const APPLY_TAG_PREFIX = "apply:";

export interface Job {
	id: string;
	title: string;
	slug: string;
	region: string;
	description: string;
	applyUrl: string;
	url: string;
	published_at: string;
	tags: Array<{ id: string; name: string; slug: string }>;
}

function readTagValue(tags: Job["tags"] | undefined, prefix: string): string {
	const match = tags?.find((tag) => tag.name.startsWith(prefix));
	return match ? match.name.slice(prefix.length).trim() : "";
}

export function toJob(post: Post): Job {
	return {
		id: post.id,
		title: post.title,
		slug: post.slug,
		region: readTagValue(post.tags, LOCATION_TAG_PREFIX),
		description: post.custom_excerpt || post.excerpt || "",
		applyUrl: readTagValue(post.tags, APPLY_TAG_PREFIX) || post.url,
		url: post.url,
		published_at: post.published_at,
		tags: post.tags ?? [],
	};
}

export async function getJobs(): Promise<Job[]> {
	try {
		const result = (await api.posts.browse({
			filter: `tag:${JOBS_TAG}`,
			include: ["tags", "authors"],
			limit: "all",
		})) as unknown as Post[];
		return result.map(toJob);
	} catch (error) {
		console.error("Error fetching jobs:", error);
		return [];
	}
}

export async function getPosts(): Promise<Post[]> {
	try {
		const result = (await api.posts.browse({
			include: "authors",
			limit: "all",
		})) as unknown as Post[];
		return result;
	} catch (error) {
		console.error("Error fetching posts:", error);
		return [];
	}
}

export async function getTags(): Promise<Tag[]> {
	try {
		const result = (await api.tags.browse({ limit: "all" })) as Tag[];
		return result;
	} catch (error) {
		console.error("Error fetching tags:", error);
		return [];
	}
}
