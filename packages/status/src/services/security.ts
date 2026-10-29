/**
 * Credential administration.
 *
 * Tokens are the only machine-to-machine credential this platform accepts.
 * They are generated locally (CLI or admin API), returned exactly once, stored
 * as a hash and individually revocable. There is no "master key": a Console
 * integration holds a scoped token like any other client, so the status
 * platform never depends on a Console session.
 */

import {
	generateToken,
	hashSecret,
	parseScopes,
	parseToken,
	verifySecret,
} from "../auth/tokens";
import type { CreateTokenInput } from "../core/schemas";
import type { TokenScope } from "../core/types";
import { badRequest, notFound, unauthorized } from "../errors";
import type { Actor, StatusContext } from "./context";
import { adminTokenDto } from "./public";

export const createTokenRecord = (
	ctx: StatusContext,
	input: CreateTokenInput,
	actor: Actor,
) => {
	if (input.scopes.includes("admin") && input.scopes.length > 1) {
		throw badRequest("The admin scope already implies every other scope");
	}
	const generated = generateToken();
	const timestamp = ctx.now();
	ctx.repos.tokens.insert({
		id: generated.id,
		name: input.name,
		prefix: generated.prefix,
		hash: hashSecret(generated.value.slice(generated.prefix.length + 1)),
		scopes_json: JSON.stringify(input.scopes),
		created_at: timestamp,
		last_used_at: null,
		revoked_at: null,
	});
	ctx.audit(actor, {
		action: "token.create",
		subjectType: "token",
		subjectId: generated.id,
		detail: { name: input.name, scopes: input.scopes },
	});
	const row = ctx.repos.tokens.findById(generated.id);
	if (!row) {
		throw notFound("Token record disappeared");
	}
	return {
		token: adminTokenDto(row),
		/** Full bearer value — returned once, never stored in clear. */
		value: generated.value,
	};
};

export const listTokenRecords = (ctx: StatusContext) =>
	ctx.repos.tokens.list().map(adminTokenDto);

export const revokeTokenRecord = (
	ctx: StatusContext,
	tokenId: string,
	actor: Actor,
) => {
	const row = ctx.repos.tokens.findById(tokenId);
	if (!row) {
		throw notFound(`Token "${tokenId}" does not exist`);
	}
	if (row.revoked_at) {
		return adminTokenDto(row);
	}
	ctx.repos.tokens.revoke(tokenId, ctx.now());
	ctx.audit(actor, {
		action: "token.revoke",
		subjectType: "token",
		subjectId: tokenId,
		detail: { name: row.name },
	});
	const updated = ctx.repos.tokens.findById(tokenId);
	if (!updated) {
		throw notFound("Token disappeared during revocation");
	}
	return adminTokenDto(updated);
};

export interface AuthenticatedActor extends Actor {
	type: "token";
	id: string;
	scopes: TokenScope[];
}

/**
 * Verify a bearer credential.
 *
 * Returns the acting identity with its scopes, or `null` for anything that is
 * not a valid, non-revoked token. `last_used_at` is refreshed best-effort.
 */
export const verifyBearer = (
	ctx: StatusContext,
	authorization: string | undefined,
): AuthenticatedActor | null => {
	if (!authorization) {
		return null;
	}
	const [scheme, value] = authorization.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !value) {
		return null;
	}
	const parsed = parseToken(value);
	if (!parsed) {
		return null;
	}
	const row = ctx.repos.tokens.findById(parsed.id);
	if (!row || row.revoked_at) {
		return null;
	}
	if (!verifySecret(parsed.secret, row.hash)) {
		return null;
	}
	try {
		ctx.repos.tokens.touch(row.id, ctx.now());
	} catch {
		// Best effort: a failed touch must not reject a valid credential.
	}
	return {
		type: "token",
		id: row.id,
		label: row.name,
		scopes: parseScopes(row.scopes_json),
	};
};

export const requireScope = (
	actor: AuthenticatedActor | null,
	scope: TokenScope,
): AuthenticatedActor => {
	if (!actor) {
		throw unauthorized(
			"This endpoint requires a Notploy Status API token (Authorization: Bearer <token>)",
		);
	}
	if (!actor.scopes.includes(scope) && !actor.scopes.includes("admin")) {
		throw unauthorized(`This token is missing the "${scope}" scope`);
	}
	return actor;
};
