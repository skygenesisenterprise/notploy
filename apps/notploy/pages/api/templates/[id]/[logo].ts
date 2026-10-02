import { readFileSync } from "node:fs";
import { TEMPLATES_BASE_URL } from "@notploy/server/templates/github";
import {
	getLocalBlueprintsDir,
	getLocalTemplateLogoPath,
} from "@notploy/server/templates/local";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Serves blueprint logos straight from the local `templates/blueprints`
 * directory so the gallery works without the remote templates domain.
 *
 * Only active when a local blueprints directory is present (local development).
 */
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ message: "Method not allowed" });
	}

	const blueprintId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
	const logo = Array.isArray(req.query.logo)
		? req.query.logo[0]
		: req.query.logo;

	if (!blueprintId || !logo) {
		return res.status(400).json({ message: "Missing template id or logo" });
	}

	if (!getLocalBlueprintsDir()) {
		// No local blueprints (production): redirect to the published gallery.
		return res.redirect(
			302,
			`${TEMPLATES_BASE_URL}/blueprints/${encodeURIComponent(blueprintId)}/${encodeURIComponent(logo)}`,
		);
	}

	const logoFile = getLocalTemplateLogoPath(blueprintId);
	if (!logoFile || logoFile.path.split("/").pop() !== logo) {
		return res.status(404).json({ message: "Logo not found" });
	}

	try {
		const buffer = readFileSync(logoFile.path);
		res.setHeader("Content-Type", logoFile.mimeType);
		res.setHeader("Cache-Control", "public, max-age=60");
		return res.status(200).send(buffer);
	} catch (error) {
		console.warn(`Failed to read local logo for "${blueprintId}":`, error);
		return res.status(404).json({ message: "Logo not found" });
	}
}