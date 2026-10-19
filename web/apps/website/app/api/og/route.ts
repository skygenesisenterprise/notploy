import { generateOGImage } from "@/lib/og-image";
import { getTemplate } from "@/lib/templates";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const templateId = searchParams.get("template");

		if (!templateId) {
			console.error("Missing template parameter");
			return new Response("Missing template parameter", { status: 400 });
		}

		const template = await getTemplate(templateId);

		if (!template) {
			console.error("Template not found:", templateId);
			return new Response("Template not found", { status: 404 });
		}

		const ogImage = await generateOGImage({
			title: `Deploy ${template.name} on Notploy`,
			label: "Notploy - Open Source Templates",
		});

		return new Response(ogImage, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=86400, stale-while-revalidate",
			},
		});
	} catch (error) {
		console.error("Error generating OG image:", error);
		return new Response(`Error generating image: ${error}`, { status: 500 });
	}
}
