import GhostContentAPI from "@tryghost/content-api";

// Ghost API configuration
const ghostConfig = {
	url: process.env.GHOST_URL || "https://notploy.com",
	key: process.env.GHOST_KEY || "42424242424242424242424242424242",
	version: "v5.0",
};

// Initialize the Ghost API with your credentials
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
				// Check if the response was successful.
				if (!res.ok) {
					// You can handle HTTP errors here
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

/**
 * Job offers are published as Ghost posts marked with the `job` tag by the
 * Notploy console. The location and application link travel on prefixed tags,
 * so no separate datastore is needed.
 */
const JOBS_TAG = "job";
const LOCATION_TAG_PREFIX = "location:";
const APPLY_TAG_PREFIX = "apply:";

export interface JobPosition {
	id: string;
	title: string;
	slug: string;
	region: string;
	description: string;
	applyUrl: string;
	url: string;
}

function readTagValue(
	tags: Post["tags"] | undefined,
	prefix: string,
): string {
	const match = tags?.find((tag) => tag.name.startsWith(prefix));
	return match ? match.name.slice(prefix.length).trim() : "";
}

export async function getJobs(): Promise<JobPosition[]> {
	try {
		const posts = (await api.posts.browse({
			limit: "all",
			filter: `tag:${JOBS_TAG}`,
			include: ["tags", "authors"],
		})) as Post[];

		return posts.map((post) => ({
			id: post.id,
			title: post.title,
			slug: post.slug,
			region: readTagValue(post.tags, LOCATION_TAG_PREFIX),
			description: post.custom_excerpt || post.excerpt || "",
			applyUrl: readTagValue(post.tags, APPLY_TAG_PREFIX) || post.url,
			url: post.url,
		}));
	} catch (error) {
		console.error("Error fetching job offers:", error);
		return [];
	}
}
