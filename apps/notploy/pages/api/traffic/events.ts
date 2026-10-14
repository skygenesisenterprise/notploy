import {
	AUDIENCE_INGEST_LIMIT,
	AUDIENCE_INGEST_PER_CLIENT_LIMIT,
	AUDIENCE_INGEST_WINDOW_SECONDS,
	audienceIngestPayloadSchema,
	audienceIngestRateLimiter,
	ingestAudienceEvents,
	MAX_AUDIENCE_PAYLOAD_BYTES,
	TrafficServiceError,
} from "@notploy/server";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Public ingest endpoint of the web instrumentation.
 *
 * This is the only unauthenticated write surface of the Traffic Manager, so it
 * is deliberately narrow:
 *
 * - POST only, JSON only, and Next refuses a body over {@link MAX_AUDIENCE_PAYLOAD_BYTES}
 *   before the handler runs;
 * - the body is validated against the strict audience contract (unknown keys
 *   rejected, at most 20 events, bounded string lengths);
 * - the property key identifies the source, and the source's origin allow-list
 *   (or its own domain) decides whether the origin may post at all;
 * - two rate limits apply: one per property key and one per client address, so a
 *   single visitor cannot exhaust the site's budget;
 * - nothing sensitive is stored: no IP address, no user agent, no referrer URL,
 *   no cookie, no arbitrary event properties. The transport address only lives
 *   for as long as the rate-limit window lasts, as a hashed counter key.
 */

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "16kb",
		},
	},
} as const;

const corsHeaders = (origin: string | undefined) => ({
	...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "content-type",
	"Access-Control-Max-Age": "600",
	Vary: "Origin",
});

/**
 * Rate-limit key of the caller.
 *
 * The address is hashed with a per-process salt, so the limiter never holds a
 * readable IP address, and the entry disappears with the window.
 */
const clientKeyOf = (req: NextApiRequest): string => {
	const forwarded = req.headers["x-forwarded-for"];
	const raw = Array.isArray(forwarded)
		? forwarded[0]
		: (forwarded?.split(",")[0]?.trim() ??
			req.socket.remoteAddress ??
			"unknown");
	return raw ?? "unknown";
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const origin =
		typeof req.headers.origin === "string" ? req.headers.origin : undefined;

	if (req.method === "OPTIONS") {
		res.writeHead(204, corsHeaders(origin));
		return res.end();
	}
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST, OPTIONS");
		return res.status(405).json({ error: "Method not allowed" });
	}

	const headers = corsHeaders(origin);
	for (const [name, value] of Object.entries(headers)) {
		res.setHeader(name, value);
	}
	res.setHeader("Cache-Control", "no-store");

	const contentLength = Number.parseInt(
		String(req.headers["content-length"] ?? "0"),
		10,
	);
	if (
		Number.isFinite(contentLength) &&
		contentLength > MAX_AUDIENCE_PAYLOAD_BYTES
	) {
		return res.status(413).json({ error: "Payload too large" });
	}

	const parsed = audienceIngestPayloadSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			error: "Invalid payload",
			issues: parsed.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			})),
		});
	}

	const clientKey = clientKeyOf(req);
	const [perKey, perClient] = await Promise.all([
		audienceIngestRateLimiter.consume(`key:${parsed.data.publicKey}`, {
			limit: AUDIENCE_INGEST_LIMIT,
			windowSeconds: AUDIENCE_INGEST_WINDOW_SECONDS,
		}),
		audienceIngestRateLimiter.consume(`client:${clientKey}`, {
			limit: AUDIENCE_INGEST_PER_CLIENT_LIMIT,
			windowSeconds: AUDIENCE_INGEST_WINDOW_SECONDS,
		}),
	]);
	if (!perKey.allowed || !perClient.allowed) {
		const retryAfter = Math.max(
			perKey.retryAfterSeconds,
			perClient.retryAfterSeconds,
		);
		res.setHeader("Retry-After", String(retryAfter));
		return res.status(429).json({ error: "Too many requests" });
	}

	try {
		const result = await ingestAudienceEvents({
			payload: parsed.data,
			origin: origin ?? null,
			userAgent:
				typeof req.headers["user-agent"] === "string"
					? req.headers["user-agent"]
					: null,
		});
		return res.status(202).json({ accepted: result.pageviews + result.events });
	} catch (error) {
		if (error instanceof TrafficServiceError) {
			switch (error.code) {
				case "SOURCE_NOT_FOUND":
					return res.status(401).json({ error: error.message });
				case "SOURCE_DISABLED":
				case "ORIGIN_NOT_ALLOWED":
				case "AUDIENCE_INGEST_DISABLED":
					return res.status(403).json({ error: error.message });
				default:
					return res.status(400).json({ error: error.message });
			}
		}
		console.error("[traffic] audience ingest failed", error);
		return res.status(500).json({ error: "Unable to record traffic events" });
	}
}
