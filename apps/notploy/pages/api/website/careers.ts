import { validateRequest } from "@notploy/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { createJob } from "@/lib/ghost-admin";

interface CreateJobBody {
	title?: unknown;
	description?: unknown;
	region?: unknown;
	apply_url?: unknown;
	status?: unknown;
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

	const body = (req.body ?? {}) as CreateJobBody;
	const { title, description, region, apply_url, status } = body;

	if (typeof title !== "string" || !title.trim()) {
		return res.status(400).json({ error: "Title is required" });
	}
	if (typeof description !== "string" || !description.trim()) {
		return res.status(400).json({ error: "Description is required" });
	}

	try {
		const post = await createJob({
			title: title.trim(),
			description: description.trim(),
			region:
				typeof region === "string" && region.trim() ? region.trim() : undefined,
			applyUrl:
				typeof apply_url === "string" && apply_url.trim()
					? apply_url.trim()
					: undefined,
			status: status === "draft" ? "draft" : "published",
		});

		return res.status(201).json({ post });
	} catch (error) {
		return res.status(500).json({
			error:
				error instanceof Error ? error.message : "Failed to publish job offer",
		});
	}
}
