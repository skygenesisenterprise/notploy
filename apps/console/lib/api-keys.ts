import { z } from "zod";

/**
 * Maximum length allowed for an API key name.
 *
 * This mirrors the default `maximumNameLength` enforced by the
 * `@better-auth/api-key` plugin. Names longer than this are rejected by
 * better-auth with a 400, so we validate against it up front to surface a
 * clear field-level error instead of an opaque 500.
 */
export const API_KEY_NAME_MAX_LENGTH = 32;

/**
 * Shared validation for an API key name, used by both the tRPC input schema
 * and the client form so the two can't drift.
 */
export const apiKeyNameSchema = z
	.string()
	.min(1, "Name is required")
	.max(
		API_KEY_NAME_MAX_LENGTH,
		`Name must be at most ${API_KEY_NAME_MAX_LENGTH} characters`,
	);

/**
 * The organization an API key is scoped to.
 *
 * The `apikey` table has no organization foreign key: `@better-auth/api-key`
 * only knows about users, so Notploy stores the scope as JSON in the plugin's
 * own `metadata` column and `validateRequest` reads it back to build the
 * synthetic session used by `x-api-key` requests. That makes this blob the
 * single source of truth for a key's organization, which is why every read and
 * write path has to go through here instead of trusting a request field.
 */
export interface ApiKeyMetadata {
	organizationId?: string;
}

/**
 * Reads the organization out of an API key's `metadata` column.
 *
 * Returns `undefined` for missing, unparsable or non-object metadata. Legacy
 * rows migrated from `auth.token` have no metadata at all, and a key without a
 * resolvable organization cannot authenticate (see `validateRequest`), so
 * callers must treat `undefined` as "not usable" rather than "belongs to
 * everyone".
 */
export function parseApiKeyOrganizationId(
	metadata: string | null | undefined,
): string | undefined {
	if (!metadata) return undefined;
	try {
		const parsed: unknown = JSON.parse(metadata);
		if (!parsed || typeof parsed !== "object") return undefined;
		const { organizationId } = parsed as ApiKeyMetadata;
		return typeof organizationId === "string" && organizationId
			? organizationId
			: undefined;
	} catch {
		return undefined;
	}
}
