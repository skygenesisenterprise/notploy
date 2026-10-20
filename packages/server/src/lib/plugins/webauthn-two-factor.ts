import { base64 } from "@better-auth/utils/base64";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type WebAuthnCredential,
} from "@simplewebauthn/server";
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	freshSessionMiddleware,
	sessionMiddleware,
} from "better-auth/api";
import { expireCookie, setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { z } from "zod";

/**
 * Name of the cookie the two-factor plugin sets after the password step. Its
 * value is a single-use verification token pointing at the pending user.
 */
const TWO_FACTOR_COOKIE_NAME = "two_factor";
/** Challenge cookie for the sign-in ceremony (single use, five minutes). */
const CHALLENGE_COOKIE_NAME = "webauthn_2fa_challenge";
/** Challenge cookie for registering a new key (single use, five minutes). */
const REGISTRATION_COOKIE_NAME = "webauthn_registration_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60;

/** Better-auth model backed by the `security_key` table. */
const SECURITY_KEY_MODEL = "securityKey";
const MAX_SECURITY_KEYS_PER_USER = 10;

export const WEBAUTHN_TWO_FACTOR_NO_KEY_CODE = "NO_SECURITY_KEY";
export const WEBAUTHN_TWO_FACTOR_NO_KEY_MESSAGE =
	"No security key is registered for this account. Use an authenticator code instead.";

const INVALID_CHALLENGE_MESSAGE =
	"This security key request expired. Start the sign-in again.";

export interface WebAuthnRequestContext {
	/** Relying party ID: the host the credential is scoped to. */
	rpID: string;
	/** Exact origin the browser assertion must have been produced for. */
	origin: string;
}

/** Safe projection of a security key, never the public key or counter. */
export interface SecurityKeySummary {
	id: string;
	name: string | null;
	deviceType: string;
	backedUp: boolean;
	createdAt: string | null;
	aaguid: string | null;
}

interface SecurityKeyRow {
	id: string;
	userId: string;
	name: string | null;
	credentialID: string;
	publicKey: string;
	counter: number;
	deviceType: string;
	backedUp: boolean;
	transports: string | null;
	createdAt: Date | string | null;
	aaguid: string | null;
}

const isLoopbackHost = (hostname: string) =>
	hostname === "localhost" ||
	hostname.endsWith(".localhost") ||
	hostname === "127.0.0.1" ||
	hostname === "[::1]";

/**
 * Resolves the relying party ID and the origin an assertion must match.
 * Returns `null` when the request cannot be trusted: no origin, a host outside
 * the relying party, plain HTTP outside loopback, or an unparsable base URL.
 */
export const resolveWebAuthnRequestContext = (input: {
	baseURL?: string;
	configuredRpID?: string;
	requestOrigin?: string | null;
}): WebAuthnRequestContext | null => {
	let rpID = input.configuredRpID;
	if (!rpID && input.baseURL) {
		try {
			rpID = new URL(input.baseURL).hostname;
		} catch {
			return null;
		}
	}
	if (!rpID || !input.requestOrigin) return null;

	try {
		const origin = new URL(input.requestOrigin);
		if (origin.hostname !== rpID) return null;
		if (origin.protocol !== "https:" && !isLoopbackHost(origin.hostname)) {
			return null;
		}
		return { rpID, origin: origin.origin };
	} catch {
		return null;
	}
};

/** Splits the comma-separated `transports` column stored on the credential. */
export const parseCredentialTransports = (
	value: string | null,
): WebAuthnCredential["transports"] => {
	const transports = (value ?? "")
		.split(",")
		.map((transport) => transport.trim())
		.filter(Boolean);
	return transports.length > 0
		? (transports as WebAuthnCredential["transports"])
		: undefined;
};

export const toWebAuthnCredential = (row: {
	credentialID: string;
	publicKey: string;
	counter: number;
	transports: string | null;
}): WebAuthnCredential => ({
	id: row.credentialID,
	publicKey: base64.decode(row.publicKey),
	counter: row.counter,
	transports: parseCredentialTransports(row.transports),
});

export const toSecurityKeySummary = (
	row: SecurityKeyRow,
): SecurityKeySummary => ({
	id: row.id,
	name: row.name,
	deviceType: row.deviceType,
	backedUp: row.backedUp,
	createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
	aaguid: row.aaguid,
});

const invalidChallenge = () =>
	new APIError("UNAUTHORIZED", {
		code: "INVALID_TWO_FACTOR_CHALLENGE",
		message: INVALID_CHALLENGE_MESSAGE,
	});

const invalidRegistrationChallenge = () =>
	new APIError("BAD_REQUEST", {
		code: "SECURITY_KEY_REGISTRATION_EXPIRED",
		message: "This security key registration expired. Try again.",
	});

const contextInvalid = () =>
	new APIError("BAD_REQUEST", {
		code: "WEBAUTHN_CONTEXT_INVALID",
		message: "Security keys are not available for this origin.",
	});

const resolveContext = (ctx: {
	context: { baseURL?: string };
	headers?: Headers;
}) =>
	resolveWebAuthnRequestContext({
		baseURL: ctx.context.baseURL,
		requestOrigin: ctx.headers?.get("origin"),
	});

/**
 * Security keys as a second factor.
 *
 * `/two-factor/verify-totp` accepts a short code; this plugin adds
 * `/webauthn-2fa/generate-options` and `/webauthn-2fa/verify`, which reuse the
 * same pending two-factor cookie, so either factor completes the same password
 * step. Keys are registered here too (`/webauthn-2fa/keys/*`): there is no
 * passwordless sign-in path, so a credential can only be used after the
 * password.
 */
export const webauthnTwoFactor = (): BetterAuthPlugin => ({
	id: "webauthn-two-factor",
	schema: {
		securityKey: {
			fields: {
				name: { type: "string", required: false },
				publicKey: { type: "string", required: true },
				userId: {
					type: "string",
					required: true,
					references: { model: "user", field: "id", onDelete: "cascade" },
				},
				credentialID: { type: "string", required: true },
				counter: { type: "number", required: true },
				deviceType: { type: "string", required: true },
				backedUp: { type: "boolean", required: true },
				transports: { type: "string", required: false },
				createdAt: { type: "date", required: false },
				aaguid: { type: "string", required: false },
			},
		},
	},
	endpoints: {
		generateWebAuthnTwoFactorOptions: createAuthEndpoint(
			"/webauthn-2fa/generate-options",
			{ method: "POST" },
			async (ctx) => {
				const twoFactorCookie = ctx.context.createAuthCookie(
					TWO_FACTOR_COOKIE_NAME,
				);
				const twoFactorToken = await ctx.getSignedCookie(
					twoFactorCookie.name,
					ctx.context.secret,
				);
				if (!twoFactorToken) throw invalidChallenge();

				const pending =
					await ctx.context.internalAdapter.findVerificationValue(
						twoFactorToken,
					);
				if (!pending) throw invalidChallenge();

				const user = await ctx.context.internalAdapter.findUserById(
					pending.value,
				);
				if (!user) throw invalidChallenge();

				const credentials = (await ctx.context.adapter.findMany({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "userId", value: user.id }],
				})) as SecurityKeyRow[];

				if (credentials.length === 0) {
					throw new APIError("BAD_REQUEST", {
						code: WEBAUTHN_TWO_FACTOR_NO_KEY_CODE,
						message: WEBAUTHN_TWO_FACTOR_NO_KEY_MESSAGE,
					});
				}

				const webAuthnContext = resolveContext(ctx);
				if (!webAuthnContext) throw contextInvalid();

				const options = await generateAuthenticationOptions({
					rpID: webAuthnContext.rpID,
					timeout: CHALLENGE_TTL_SECONDS * 1000,
					userVerification: "preferred",
					allowCredentials: credentials.map((credential) => ({
						id: credential.credentialID,
						transports: parseCredentialTransports(credential.transports),
					})),
				});

				// The challenge is bound to the pending two-factor token, so a
				// challenge issued for one sign-in cannot complete another.
				const challengeToken = generateRandomString(32);
				const challengeCookie = ctx.context.createAuthCookie(
					CHALLENGE_COOKIE_NAME,
				);
				await ctx.setSignedCookie(
					challengeCookie.name,
					challengeToken,
					ctx.context.secret,
					{
						...challengeCookie.attributes,
						maxAge: CHALLENGE_TTL_SECONDS,
					},
				);
				await ctx.context.internalAdapter.createVerificationValue({
					identifier: challengeToken,
					value: JSON.stringify({
						challenge: options.challenge,
						userId: user.id,
						twoFactorToken,
					}),
					expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
				});

				return ctx.json(options, { status: 200 });
			},
		),

		verifyWebAuthnTwoFactor: createAuthEndpoint(
			"/webauthn-2fa/verify",
			{
				method: "POST",
				body: z.object({ response: z.record(z.any(), z.any()) }),
			},
			async (ctx) => {
				const twoFactorCookie = ctx.context.createAuthCookie(
					TWO_FACTOR_COOKIE_NAME,
				);
				const twoFactorToken = await ctx.getSignedCookie(
					twoFactorCookie.name,
					ctx.context.secret,
				);
				const challengeCookie = ctx.context.createAuthCookie(
					CHALLENGE_COOKIE_NAME,
				);
				const challengeToken = await ctx.getSignedCookie(
					challengeCookie.name,
					ctx.context.secret,
				);
				if (!twoFactorToken || !challengeToken) throw invalidChallenge();

				const stored =
					await ctx.context.internalAdapter.consumeVerificationValue(
						challengeToken,
					);
				expireCookie(ctx, challengeCookie);
				if (!stored) throw invalidChallenge();

				let challenge: string;
				let userId: string;
				let boundToken: string;
				try {
					const data = JSON.parse(stored.value) as {
						challenge?: string;
						userId?: string;
						twoFactorToken?: string;
					};
					challenge = data.challenge ?? "";
					userId = data.userId ?? "";
					boundToken = data.twoFactorToken ?? "";
				} catch {
					throw invalidChallenge();
				}
				if (!challenge || !userId || boundToken !== twoFactorToken) {
					throw invalidChallenge();
				}

				const response = ctx.body
					.response as unknown as AuthenticationResponseJSON;
				if (typeof response?.id !== "string" || !response.id) {
					throw new APIError("BAD_REQUEST", {
						code: "SECURITY_KEY_RESPONSE_INVALID",
						message: "The security key response is invalid.",
					});
				}

				const storedKey = (await ctx.context.adapter.findOne({
					model: SECURITY_KEY_MODEL,
					where: [
						{ field: "userId", value: userId },
						{ field: "credentialID", value: response.id },
					],
				})) as SecurityKeyRow | null;
				if (!storedKey) {
					throw new APIError("UNAUTHORIZED", {
						code: "SECURITY_KEY_NOT_FOUND",
						message: "This security key is not registered on the account.",
					});
				}

				const webAuthnContext = resolveContext(ctx);
				if (!webAuthnContext) throw contextInvalid();

				let newCounter: number;
				try {
					const verification = await verifyAuthenticationResponse({
						response,
						expectedChallenge: challenge,
						expectedOrigin: webAuthnContext.origin,
						expectedRPID: webAuthnContext.rpID,
						credential: toWebAuthnCredential(storedKey),
						requireUserVerification: false,
					});
					if (!verification.verified) {
						throw new APIError("UNAUTHORIZED", {
							code: "SECURITY_KEY_VERIFICATION_FAILED",
							message: "The security key could not be verified.",
						});
					}
					newCounter = verification.authenticationInfo.newCounter;
				} catch (error) {
					if (error instanceof APIError) throw error;
					ctx.context.logger.error(
						"WebAuthn two-factor verification failed",
						error,
					);
					throw new APIError("UNAUTHORIZED", {
						code: "SECURITY_KEY_VERIFICATION_FAILED",
						message: "The security key could not be verified.",
					});
				}

				await ctx.context.adapter.update({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "id", value: storedKey.id }],
					update: { counter: newCounter },
				});

				// Consume the pending two-factor token only once the assertion is
				// valid, so a failed attempt can be retried with another key.
				const pending =
					await ctx.context.internalAdapter.consumeVerificationValue(
						twoFactorToken,
					);
				if (!pending || pending.value !== userId) {
					expireCookie(ctx, twoFactorCookie);
					throw invalidChallenge();
				}

				const user = await ctx.context.internalAdapter.findUserById(userId);
				if (!user) throw invalidChallenge();

				const dontRememberMe = await ctx.getSignedCookie(
					ctx.context.authCookies.dontRememberToken.name,
					ctx.context.secret,
				);
				const session = await ctx.context.internalAdapter.createSession(
					userId,
					!!dontRememberMe,
				);
				if (!session) {
					throw new APIError("INTERNAL_SERVER_ERROR", {
						code: "FAILED_TO_CREATE_SESSION",
						message: "The session could not be created.",
					});
				}
				await setSessionCookie(ctx, { session, user });
				expireCookie(ctx, twoFactorCookie);

				// Only the session token: the client reloads the session itself and
				// the user row carries credentials the browser must not receive.
				return ctx.json({ token: session.token }, { status: 200 });
			},
		),

		generateSecurityKeyRegistrationOptions: createAuthEndpoint(
			"/webauthn-2fa/keys/options",
			{ method: "POST", use: [freshSessionMiddleware] },
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in again to register a security key.",
					});
				}

				const existing = (await ctx.context.adapter.findMany({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "userId", value: session.user.id }],
				})) as SecurityKeyRow[];
				if (existing.length >= MAX_SECURITY_KEYS_PER_USER) {
					throw new APIError("BAD_REQUEST", {
						code: "TOO_MANY_SECURITY_KEYS",
						message: `An account can hold at most ${MAX_SECURITY_KEYS_PER_USER} security keys.`,
					});
				}

				const webAuthnContext = resolveContext(ctx);
				if (!webAuthnContext) throw contextInvalid();

				const options = await generateRegistrationOptions({
					rpName: ctx.context.appName,
					rpID: webAuthnContext.rpID,
					userID: new TextEncoder().encode(session.user.id),
					userName: session.user.email,
					userDisplayName: session.user.name || session.user.email,
					attestationType: "none",
					excludeCredentials: existing.map((key) => ({
						id: key.credentialID,
						transports: parseCredentialTransports(key.transports),
					})),
					authenticatorSelection: {
						// A second factor does not need a discoverable credential.
						residentKey: "discouraged",
						userVerification: "preferred",
					},
				});

				const challengeToken = generateRandomString(32);
				const challengeCookie = ctx.context.createAuthCookie(
					REGISTRATION_COOKIE_NAME,
				);
				await ctx.setSignedCookie(
					challengeCookie.name,
					challengeToken,
					ctx.context.secret,
					{
						...challengeCookie.attributes,
						maxAge: CHALLENGE_TTL_SECONDS,
					},
				);
				await ctx.context.internalAdapter.createVerificationValue({
					identifier: challengeToken,
					value: JSON.stringify({
						challenge: options.challenge,
						userId: session.user.id,
						purpose: "registration",
					}),
					expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
				});

				return ctx.json(options, { status: 200 });
			},
		),

		verifySecurityKeyRegistration: createAuthEndpoint(
			"/webauthn-2fa/keys/register",
			{
				method: "POST",
				use: [freshSessionMiddleware],
				body: z.object({
					response: z.record(z.any(), z.any()),
					name: z.string().trim().max(64).optional(),
				}),
			},
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in again to register a security key.",
					});
				}

				const challengeCookie = ctx.context.createAuthCookie(
					REGISTRATION_COOKIE_NAME,
				);
				const challengeToken = await ctx.getSignedCookie(
					challengeCookie.name,
					ctx.context.secret,
				);
				if (!challengeToken) throw invalidRegistrationChallenge();

				const stored =
					await ctx.context.internalAdapter.consumeVerificationValue(
						challengeToken,
					);
				expireCookie(ctx, challengeCookie);
				if (!stored) throw invalidRegistrationChallenge();

				let challenge: string;
				let userId: string;
				try {
					const data = JSON.parse(stored.value) as {
						challenge?: string;
						userId?: string;
						purpose?: string;
					};
					challenge = data.challenge ?? "";
					userId = data.userId ?? "";
					if (data.purpose !== "registration") throw new Error("purpose");
				} catch {
					throw invalidRegistrationChallenge();
				}
				if (!challenge || userId !== session.user.id) {
					throw invalidRegistrationChallenge();
				}

				const webAuthnContext = resolveContext(ctx);
				if (!webAuthnContext) throw contextInvalid();

				const response = ctx.body
					.response as unknown as RegistrationResponseJSON;

				let registrationInfo: Awaited<
					ReturnType<typeof verifyRegistrationResponse>
				>["registrationInfo"];
				try {
					const verification = await verifyRegistrationResponse({
						response,
						expectedChallenge: challenge,
						expectedOrigin: webAuthnContext.origin,
						expectedRPID: webAuthnContext.rpID,
						requireUserVerification: false,
					});
					if (!verification.verified || !verification.registrationInfo) {
						throw new APIError("BAD_REQUEST", {
							code: "SECURITY_KEY_REGISTRATION_FAILED",
							message: "The security key could not be registered.",
						});
					}
					registrationInfo = verification.registrationInfo;
				} catch (error) {
					if (error instanceof APIError) throw error;
					ctx.context.logger.error(
						"Security key registration verification failed",
						error,
					);
					throw new APIError("BAD_REQUEST", {
						code: "SECURITY_KEY_REGISTRATION_FAILED",
						message: "The security key could not be registered.",
					});
				}

				const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
					registrationInfo;

				// A credential belongs to a single account: refuse to bind one that
				// is already registered somewhere else.
				const duplicate = (await ctx.context.adapter.findOne({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "credentialID", value: credential.id }],
				})) as SecurityKeyRow | null;
				if (duplicate) {
					throw new APIError("CONFLICT", {
						code: "SECURITY_KEY_ALREADY_REGISTERED",
						message: "This security key is already registered.",
					});
				}

				const transports = Array.isArray(response.response?.transports)
					? response.response.transports.join(",")
					: null;

				const created = (await ctx.context.adapter.create({
					model: SECURITY_KEY_MODEL,
					data: {
						name: ctx.body.name?.trim() || null,
						userId: session.user.id,
						credentialID: credential.id,
						publicKey: base64.encode(credential.publicKey),
						counter: credential.counter,
						deviceType: credentialDeviceType,
						backedUp: credentialBackedUp,
						transports,
						createdAt: new Date(),
						aaguid,
					},
				})) as SecurityKeyRow;

				return ctx.json(toSecurityKeySummary(created), { status: 200 });
			},
		),

		listSecurityKeys: createAuthEndpoint(
			"/webauthn-2fa/keys",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in to view your security keys.",
					});
				}

				const keys = (await ctx.context.adapter.findMany({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "userId", value: session.user.id }],
				})) as SecurityKeyRow[];

				const summaries = keys
					.map(toSecurityKeySummary)
					.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

				return ctx.json(summaries, { status: 200 });
			},
		),

		deleteSecurityKey: createAuthEndpoint(
			"/webauthn-2fa/keys/delete",
			{
				method: "POST",
				use: [sessionMiddleware],
				body: z.object({ id: z.string().min(1) }),
			},
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in to remove a security key.",
					});
				}

				const key = (await ctx.context.adapter.findOne({
					model: SECURITY_KEY_MODEL,
					where: [
						{ field: "id", value: ctx.body.id },
						{ field: "userId", value: session.user.id },
					],
				})) as SecurityKeyRow | null;
				if (!key) {
					throw new APIError("NOT_FOUND", {
						code: "SECURITY_KEY_NOT_FOUND",
						message: "This security key is not registered on the account.",
					});
				}

				await ctx.context.adapter.delete({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "id", value: key.id }],
				});

				return ctx.json({ success: true }, { status: 200 });
			},
		),
	},
});
