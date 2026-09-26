import { NextResponse } from "next/server";

/**
 * Repository star count.
 *
 * The Node deployment serves this dynamically and honours `?owner=&repo=`.
 * Under `output: "export"` a route handler may not read the query string, so
 * the build writes a single snapshot for the repository the site actually
 * points at (DEFAULT_OWNER/DEFAULT_REPO) to out/api/github-stars.json and it
 * is refreshed on every deploy.
 */
export const dynamic = "force-static";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

const DEFAULT_OWNER = "skygenesisenterprise";
const DEFAULT_REPO = "notploy";

// Cache the result for 5 minutes to avoid rate limiting
let cachedStars: { count: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

function ok(body: unknown) {
	return NextResponse.json(body, {
		headers: {
			"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
}

async function fetchStarCount(owner: string, repo: string) {
	if (cachedStars && Date.now() - cachedStars.timestamp < CACHE_DURATION) {
		return ok({ stargazers_count: cachedStars.count });
	}

	try {
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}`,
			{
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "Notploy-Website",
				},
			},
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch repository data" },
				{ status: response.status },
			);
		}

		const data = await response.json();
		const starCount = data.stargazers_count;

		cachedStars = { count: starCount, timestamp: Date.now() };

		return ok({ stargazers_count: starCount });
	} catch (error) {
		console.error("Error fetching GitHub stars:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

const dynamicHandler = async (request: Request) => {
	const { searchParams } = new URL(request.url);
	const owner = searchParams.get("owner");
	const repo = searchParams.get("repo");

	if (!owner || !repo) {
		return NextResponse.json(
			{ error: "Owner and repo parameters are required" },
			{ status: 400 },
		);
	}

	return fetchStarCount(owner, repo);
};

export const GET = isStaticExport
	? async () => fetchStarCount(DEFAULT_OWNER, DEFAULT_REPO)
	: dynamicHandler;
