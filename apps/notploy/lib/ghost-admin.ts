import crypto from "node:crypto";
import { APPLY_TAG_PREFIX, JOBS_TAG, LOCATION_TAG_PREFIX } from "./ghost";

const GHOST_URL = process.env.GHOST_URL || "https://notploy.com";
const GHOST_ADMIN_KEY = process.env.GHOST_ADMIN_KEY;

export interface CreatePostInput {
	title: string;
	html: string;
	status?: "draft" | "published";
	custom_excerpt?: string;
	feature_image?: string;
	tags?: string[];
}

export interface CreatedPost {
	id: string;
	uuid: string;
	title: string;
	slug: string;
	status: string;
	url: string;
}

export interface CreateJobInput {
	title: string;
	description: string;
	region?: string;
	applyUrl?: string;
	status?: "draft" | "published";
}

function base64Url(input: string): string {
	return Buffer.from(input).toString("base64url");
}

/**
 * The Ghost Admin API authenticates with a short-lived JWT signed by the
 * `<id>:<secret>` admin key (HS256, audience `/admin/`). Signing it locally
 * keeps the admin secret on the server, unlike the read-only Content API.
 */
function generateAdminToken(): string {
	if (!GHOST_ADMIN_KEY) {
		throw new Error("GHOST_ADMIN_KEY is not configured");
	}
	const [id, secret] = GHOST_ADMIN_KEY.split(":");
	if (!id || !secret) {
		throw new Error("GHOST_ADMIN_KEY must be in the form <id>:<secret>");
	}

	const iat = Math.floor(Date.now() / 1000);
	const header = base64Url(
		JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }),
	);
	const payload = base64Url(
		JSON.stringify({ iat, exp: iat + 5 * 60, aud: "/admin/" }),
	);
	const unsigned = `${header}.${payload}`;
	const signature = crypto
		.createHmac("sha256", secret)
		.update(unsigned)
		.digest("base64url");

	return `${unsigned}.${signature}`;
}

export async function createPost(input: CreatePostInput): Promise<CreatedPost> {
	const token = generateAdminToken();

	const response = await fetch(
		`${GHOST_URL}/ghost/api/admin/posts/?source=html`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Ghost ${token}`,
			},
			body: JSON.stringify({
				posts: [
					{
						title: input.title,
						html: input.html,
						status: input.status ?? "published",
						custom_excerpt: input.custom_excerpt || undefined,
						feature_image: input.feature_image || undefined,
						tags: input.tags?.map((name) => ({ name })),
					},
				],
			}),
		},
	);

	if (!response.ok) {
		const message = await response.text();
		throw new Error(`Ghost API error (${response.status}): ${message}`);
	}

	const data = (await response.json()) as { posts: CreatedPost[] };
	const post = data.posts?.[0];
	if (!post) {
		throw new Error("Ghost did not return the created post");
	}

	return post;
}

/**
 * A job offer is a Ghost post marked with the `job` tag, carrying its location
 * and application link on prefixed tags so the public `/jobs` page can rebuild
 * the listing without a dedicated datastore.
 */
export async function createJob(input: CreateJobInput): Promise<CreatedPost> {
	const tags = [JOBS_TAG];
	if (input.region) {
		tags.push(`${LOCATION_TAG_PREFIX}${input.region}`);
	}
	if (input.applyUrl) {
		tags.push(`${APPLY_TAG_PREFIX}${input.applyUrl}`);
	}

	return createPost({
		title: input.title,
		html: input.description,
		custom_excerpt: input.description,
		status: input.status,
		tags,
	});
}
