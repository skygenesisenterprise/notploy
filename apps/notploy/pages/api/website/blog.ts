import { validateRequest } from "@notploy/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { createPost } from "@/lib/ghost-admin";

interface CreatePostBody {
	title?: unknown;
	html?: unknown;
	status?: unknown;
	custom_excerpt?: unknown;
	feature_image?: unknown;
	tags?: unknown;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { user } = await validateRequest(req);
	if (!user || (user.role !== "owner" && user.role !== "admin")) {
		return res.status(403).json({ error: "Forbidden" });
	}

	const body = (req.body ?? {}) as CreatePostBody;
	const { title, html, status, custom_excerpt, feature_image, tags } = body;

	if (typeof title !== "string" || !title.trim()) {
		return res.status(400).json({ error: "Title is required" });
	}
	if (typeof html !== "string" || !html.trim()) {
		return res.status(400).json({ error: "Content is required" });
	}

	const tagList = Array.isArray(tags)
		? tags.filter((tag): tag is string => typeof tag === "string")
		: undefined;

	try {
		const post = await createPost({
			title: title.trim(),
			html,
			status: status === "draft" ? "draft" : "published",
			custom_excerpt:
				typeof custom_excerpt === "string" && custom_excerpt
					? custom_excerpt
					: undefined,
			feature_image:
				typeof feature_image === "string" && feature_image
					? feature_image
					: undefined,
			tags: tagList,
		});

		return res.status(201).json({ post });
	} catch (error) {
		return res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to publish post",
		});
	}
}
