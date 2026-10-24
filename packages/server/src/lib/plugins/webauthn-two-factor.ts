import { createHash, randomInt } from "node:crypto";
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
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	createAuthMiddleware,
	freshSessionMiddleware,
	getSessionFromCtx,
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
/** Better-auth model backed by the `security_key_backup_code` table. */
const BACKUP_CODE_MODEL = "securityKeyBackupCode";
/** Better-auth model backed by the `security_key_login_request` table. */
const LOGIN_REQUEST_MODEL = "securityKeyLoginRequest";
const MAX_SECURITY_KEYS_PER_USER = 10;
/** How long the phone has to approve the QR code shown after the password. */
const LOGIN_REQUEST_TTL_SECONDS = 10 * 60;

/** Values of `user.twoFactorMethod`. */
const TOTP_METHOD = "totp";
const SECURITY_KEY_METHOD = "securityKey";

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;
/** Ambiguity-free alphabet: no `0`/`O`, no `1`/`I`/`L`. */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const WEBAUTHN_TWO_FACTOR_NO_KEY_CODE = "NO_SECURITY_KEY";
export const WEBAUTHN_TWO_FACTOR_NO_KEY_MESSAGE =
	"No security key is registered for this account. Use an authenticator code instead.";
export const SECURITY_KEY_REQUIRED_CODE = "SECURITY_KEY_REQUIRED";
export const SECURITY_KEY_DISABLED_CODE = "SECURITY_KEY_DISABLED";
export const TOTP_SETUP_REQUIRED_CODE = "TOTP_SETUP_REQUIRED";
export const LAST_SECURITY_KEY_CODE = "LAST_SECURITY_KEY";
export const BACKUP_CODES_UNAVAILABLE_CODE = "BACKUP_CODES_UNAVAILABLE";
export const QR_LOGIN_UNAVAILABLE_CODE = "QR_LOGIN_UNAVAILABLE";
export const QR_LOGIN_REQUEST_INVALID_CODE = "QR_LOGIN_REQUEST_INVALID";

export type TwoFactorMethod = typeof TOTP_METHOD | typeof SECURITY_KEY_METHOD;

/** What the account must present after its password. */
export interface TwoFactorMethodSummary {
	/** `null` until the account explicitly picks a factor (legacy accounts). */
	method: TwoFactorMethod | null;
	hasSecurityKey: boolean;
	hasTotp: boolean;
	backupCodesRemaining: number;
}

const INVALID_CHALLENGE_MESSAGE =
	"This security key request expired. Start the sign-in again.";
const SECURITY_KEY_REQUIRED_MESSAGE =
	"This account signs in with a security key. Use your security key or a backup code.";

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
 *
 * WebAuthn scopes a credential to the host the browser opened, so the request
 * origin is authoritative: a dashboard reached through a reverse proxy, a
 * tunnel or `127.0.0.1` instead of the configured `BETTER_AUTH_URL` must still
 * be able to register and use security keys. A configured relying party ID is
 * honoured when it covers the origin.
 * Returns `null` when the request cannot be trusted: no origin, a missing
 * secure context (plain HTTP outside loopback), a pinned relying party that
 * does not cover the origin, or an unparsable origin.
 */
export const resolveWebAuthnRequestContext = (input: {
	configuredRpID?: string;
	requestOrigin?: string | null;
}): WebAuthnRequestContext | null => {
	if (!input.requestOrigin) return null;

	let origin: URL;
	try {
		origin = new URL(input.requestOrigin);
	} catch {
		return null;
	}

	// Browsers only expose WebAuthn on a secure context: HTTPS, or plain HTTP
	// on loopback (`localhost`, `127.0.0.1`, `[::1]`).
	if (origin.protocol !== "https:" && !isLoopbackHost(origin.hostname)) {
		return null;
	}

	const rpID = input.configuredRpID;
	if (rpID) {
		// A relying party ID may be the origin itself or one of its parents, so
		// a pinned ID keeps credentials usable across its subdomains.
		const matchesRp =
			origin.hostname === rpID || origin.hostname.endsWith(`.${rpID}`);
		if (!matchesRp) return null;
		return { rpID, origin: origin.origin };
	}

	return { rpID: origin.hostname, origin: origin.origin };
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

interface BackupCodeRow {
	id: string;
	codeHash: string;
	used: boolean;
	usedAt: Date | string | null;
}

interface LoginRequestRow {
	id: string;
	userId: string;
	status: string;
	expiresAt: Date | string;
}

const findLoginRequest = async (
	ctx: GenericEndpointContext,
	requestId: string,
) =>
	(await ctx.context.adapter.findOne({
		model: LOGIN_REQUEST_MODEL,
		where: [{ field: "id", value: requestId }],
	})) as LoginRequestRow | null;

const isExpired = (expiresAt: Date | string) =>
	new Date(expiresAt).getTime() <= Date.now();

const invalidLoginRequest = () =>
	new APIError("BAD_REQUEST", {
		code: QR_LOGIN_REQUEST_INVALID_CODE,
		message: "This sign-in request expired or was already used. Start again.",
	});

/** Removes formatting so `abcde-fghij` and `ABCDE FGHIJ` match the same code. */
const normalizeBackupCode = (code: string) =>
	code.replace(/[\s-]/g, "").toUpperCase();

const hashBackupCode = (code: string) =>
	createHash("sha256").update(normalizeBackupCode(code)).digest("hex");

/** Codes are shown once, in `XXXXX-XXXXX` form, and only their hash is stored. */
const generateBackupCodes = () =>
	Array.from({ length: BACKUP_CODE_COUNT }, () => {
		let raw = "";
		for (let index = 0; index < BACKUP_CODE_LENGTH; index++) {
			raw += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
		}
		return `${raw.slice(0, 5)}-${raw.slice(5)}`;
	});

const findBackupCodes = async (
	ctx: GenericEndpointContext,
	userId: string,
): Promise<BackupCodeRow[]> =>
	(await ctx.context.adapter.findMany({
		model: BACKUP_CODE_MODEL,
		where: [{ field: "userId", value: userId }],
	})) as BackupCodeRow[];

/** Replaces every code at once: the previous set stops working immediately. */
const replaceBackupCodes = async (
	ctx: GenericEndpointContext,
	userId: string,
) => {
	const codes = generateBackupCodes();
	await ctx.context.adapter.deleteMany({
		model: BACKUP_CODE_MODEL,
		where: [{ field: "userId", value: userId }],
	});
	for (const code of codes) {
		await ctx.context.adapter.create({
			model: BACKUP_CODE_MODEL,
			data: {
				userId,
				codeHash: hashBackupCode(code),
				createdAt: new Date(),
				used: false,
			},
		});
	}
	return codes;
};

const listSecurityKeys = async (ctx: GenericEndpointContext, userId: string) =>
	(await ctx.context.adapter.findMany({
		model: SECURITY_KEY_MODEL,
		where: [{ field: "userId", value: userId }],
	})) as SecurityKeyRow[];

/** Whether the account has a verified authenticator-app secret. */
const hasVerifiedTotp = async (
	ctx: GenericEndpointContext,
	userId: string,
) => {
	const record = (await ctx.context.adapter.findOne({
		model: "twoFactor",
		where: [{ field: "userId", value: userId }],
	})) as { verified?: boolean } | null;
	return !!record && record.verified !== false;
};

const readMethod = (user: unknown): TwoFactorMethod | null => {
	const method = (user as { twoFactorMethod?: string | null } | null)
		?.twoFactorMethod;
	return method === TOTP_METHOD || method === SECURITY_KEY_METHOD ? method : null;
};

/** The user a password step left pending, read from the signed 2FA cookie. */
const resolvePendingTwoFactorUser = async (ctx: GenericEndpointContext) => {
	const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME);
	const token = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
	if (!token) return null;
	const pending = await ctx.context.internalAdapter.findVerificationValue(token);
	if (!pending) return null;
	const user = await ctx.context.internalAdapter.findUserById(pending.value);
	return user ? { user, token } : null;
};

/**
 * Makes the security key the account's second factor. Called when the first key
 * is registered, so choosing "security key" during setup needs no extra step,
 * and when an account switches from authenticator codes. Backup codes are
 * issued with it: losing the only key must not lock the account out.
 */
const enableSecurityKeyTwoFactor = async (
	ctx: GenericEndpointContext,
	userId: string,
	/** Codes are reissued only when two-factor was off. */
	issueBackupCodes = true,
) => {
	await ctx.context.internalAdapter.updateUser(userId, {
		twoFactorEnabled: true,
		twoFactorMethod: SECURITY_KEY_METHOD,
	});
	return issueBackupCodes ? replaceBackupCodes(ctx, userId) : undefined;
};

/**
 * Reads the method straight from the database: the user snapshot on the session
 * is not refreshed by every update, and this decision must not be stale.
 */
const readStoredMethod = async (ctx: GenericEndpointContext, userId: string) =>
	readMethod(await ctx.context.internalAdapter.findUserById(userId));

/**
 * Ends the pending password step: consumes the single-use token, creates the
 * session and sets its cookie. Shared by the key assertion and the backup code
 * so both complete the exact same sign-in.
 */
const completeTwoFactorSignIn = async (
	ctx: GenericEndpointContext,
	userId: string,
	twoFactorToken: string,
) => {
	const pending =
		await ctx.context.internalAdapter.consumeVerificationValue(twoFactorToken);
	const twoFactorCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME);
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

	// Only the session token: the client reloads the session itself and the
	// user row carries credentials the browser must not receive.
	return ctx.json({ token: session.token }, { status: 200 });
};

/** Rejects the security-key endpoints when the account chose OTP codes. */
const assertSecurityKeyMethod = (user: unknown) => {
	if (readMethod(user) === TOTP_METHOD) {
		throw new APIError("BAD_REQUEST", {
			code: SECURITY_KEY_DISABLED_CODE,
			message:
				"This account signs in with authenticator codes. Change the two-factor method to use a security key.",
		});
	}
};

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

const resolveContext = (ctx: { headers?: Headers }) =>
	resolveWebAuthnRequestContext({
		// The origin the browser ran the ceremony for; the relying party ID is
		// derived from it unless the deployment pins one.
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
		// The factor the account must present after its password. Written by
		// this plugin only (`input: false`); better-auth exposes the field on the
		// user row so the adapter can read and update it.
		user: {
			fields: {
				twoFactorMethod: {
					type: "string",
					required: false,
					input: false,
				},
			},
		},
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
		securityKeyBackupCode: {
			fields: {
				userId: {
					type: "string",
					required: true,
					references: { model: "user", field: "id", onDelete: "cascade" },
				},
				codeHash: { type: "string", required: true },
				createdAt: { type: "date", required: false },
				used: { type: "boolean", required: false },
				usedAt: { type: "date", required: false },
			},
		},
		securityKeyLoginRequest: {
			fields: {
				userId: {
					type: "string",
					required: true,
					references: { model: "user", field: "id", onDelete: "cascade" },
				},
				status: { type: "string", required: false },
				createdAt: { type: "date", required: false },
				expiresAt: { type: "date", required: true },
				approvedAt: { type: "date", required: false },
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
				// The account may have switched to authenticator codes: its keys are
				// then no longer a valid second factor.
				assertSecurityKeyMethod(user);

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

				const pendingUser =
					await ctx.context.internalAdapter.findUserById(userId);
				if (!pendingUser) throw invalidChallenge();
				assertSecurityKeyMethod(pendingUser);

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

				// The pending token is consumed only once the assertion is valid, so a
				// failed attempt can be retried with another key.
				return completeTwoFactorSignIn(ctx, userId, twoFactorToken);
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

				// A first key makes the security key the account's second factor right
				// away, so choosing it during setup needs no extra switch. The backup
				// codes are returned exactly once, here, for the user to store.
				const currentUser =
					(await ctx.context.internalAdapter.findUserById(session.user.id)) as {
						twoFactorEnabled?: boolean | null;
					} | null;
				const alreadyEnabled = currentUser?.twoFactorEnabled === true;
				const backupCodes = await enableSecurityKeyTwoFactor(
					ctx,
					session.user.id,
					!alreadyEnabled,
				);

				return ctx.json(
					{
						...toSecurityKeySummary(created),
						twoFactorEnabled: alreadyEnabled || !!backupCodes,
						backupCodes,
					},
					{ status: 200 },
				);
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

				// Removing the last key of a key-only account would leave it with no
				// usable second factor: the backup codes alone are a recovery path,
				// not a factor the user can enrol again.
				if ((await readStoredMethod(ctx, session.user.id)) === SECURITY_KEY_METHOD) {
					const keys = await listSecurityKeys(ctx, session.user.id);
					if (keys.length <= 1) {
						throw new APIError("BAD_REQUEST", {
							code: LAST_SECURITY_KEY_CODE,
							message:
								"Register another security key before removing this one.",
						});
					}
				}

				await ctx.context.adapter.delete({
					model: SECURITY_KEY_MODEL,
					where: [{ field: "id", value: key.id }],
				});

				return ctx.json({ success: true }, { status: 200 });
			},
		),

		/**
		 * Reports the account's chosen second factor. Read with the session (settings
		 * page) or with the pending two-factor cookie (sign-in page, before a
		 * session exists), which is how the login form knows what to ask for.
		 */
		getTwoFactorMethod: createAuthEndpoint(
			"/webauthn-2fa/method",
			{ method: "GET" },
			async (ctx) => {
				const session = await getSessionFromCtx(ctx);
				let user = session?.user ?? null;
				if (!user) {
					const pending = await resolvePendingTwoFactorUser(ctx);
					user = pending?.user ?? null;
				}
				if (!user) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in to read your two-factor method.",
					});
				}

				const [keys, backupCodes, hasTotp] = await Promise.all([
					listSecurityKeys(ctx, user.id),
					findBackupCodes(ctx, user.id),
					hasVerifiedTotp(ctx, user.id),
				]);

				const summary: TwoFactorMethodSummary = {
					method: await readStoredMethod(ctx, user.id),
					hasSecurityKey: keys.length > 0,
					hasTotp,
					backupCodesRemaining: backupCodes.filter((code) => !code.used)
						.length,
				};
				return ctx.json(summary, { status: 200 });
			},
		),

		/**
		 * Switches the second factor. Choosing the security key requires a
		 * registered key; choosing authenticator codes requires a completed TOTP
		 * setup, otherwise the settings page runs that setup first.
		 */
		setTwoFactorMethod: createAuthEndpoint(
			"/webauthn-2fa/method",
			{
				method: "POST",
				use: [freshSessionMiddleware],
				body: z.object({
					method: z.enum([TOTP_METHOD, SECURITY_KEY_METHOD]),
				}),
			},
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in again to change your two-factor method.",
					});
				}
				const userId = session.user.id;

				if (ctx.body.method === SECURITY_KEY_METHOD) {
					const keys = await listSecurityKeys(ctx, userId);
					if (keys.length === 0) {
						throw new APIError("BAD_REQUEST", {
							code: WEBAUTHN_TWO_FACTOR_NO_KEY_CODE,
							message:
								"Register a security key before making it your second factor.",
						});
					}

					const stored =
						(await ctx.context.internalAdapter.findUserById(userId)) as {
							twoFactorEnabled?: boolean | null;
						} | null;
					const alreadyEnabled = stored?.twoFactorEnabled === true;
					// Switching from authenticator codes needs a fresh set: those codes
					// belong to better-auth and no longer complete the sign-in.
					const unused = (await findBackupCodes(ctx, userId)).filter(
						(row) => !row.used,
					);
					const backupCodes = await enableSecurityKeyTwoFactor(
						ctx,
						userId,
						!alreadyEnabled || unused.length === 0,
					);

					return ctx.json(
						{ method: SECURITY_KEY_METHOD, backupCodes },
						{ status: 200 },
					);
				}

				if (!(await hasVerifiedTotp(ctx, userId))) {
					throw new APIError("BAD_REQUEST", {
						code: TOTP_SETUP_REQUIRED_CODE,
						message:
							"Set up an authenticator app before making it your second factor.",
					});
				}
				await ctx.context.internalAdapter.updateUser(userId, {
					twoFactorEnabled: true,
					twoFactorMethod: TOTP_METHOD,
				});
				return ctx.json({ method: TOTP_METHOD }, { status: 200 });
			},
		),

		countSecurityKeyBackupCodes: createAuthEndpoint(
			"/webauthn-2fa/backup-codes",
			{ method: "GET", use: [sessionMiddleware] },
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in to view your backup codes.",
					});
				}

				const codes = await findBackupCodes(ctx, session.user.id);
				return ctx.json(
					{ remaining: codes.filter((code) => !code.used).length },
					{ status: 200 },
				);
			},
		),

		/** Replaces the whole set: the codes shown before stop working. */
		generateSecurityKeyBackupCodes: createAuthEndpoint(
			"/webauthn-2fa/backup-codes",
			{ method: "POST", use: [freshSessionMiddleware] },
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in again to regenerate your backup codes.",
					});
				}
				if ((await readStoredMethod(ctx, session.user.id)) !== SECURITY_KEY_METHOD) {
					throw new APIError("BAD_REQUEST", {
						code: BACKUP_CODES_UNAVAILABLE_CODE,
						message:
							"Backup codes exist only while a security key is your second factor.",
					});
				}

				const backupCodes = await replaceBackupCodes(ctx, session.user.id);
				return ctx.json({ backupCodes }, { status: 200 });
			},
		),

		/**
		 * Completes a pending sign-in with a recovery code. Like the key itself it
		 * only works after the password, and each code is single use.
		 */
		verifySecurityKeyBackupCode: createAuthEndpoint(
			"/webauthn-2fa/backup-codes/verify",
			{ method: "POST", body: z.object({ code: z.string().min(1) }) },
			async (ctx) => {
				const pending = await resolvePendingTwoFactorUser(ctx);
				if (!pending) throw invalidChallenge();

				const codeHash = hashBackupCode(ctx.body.code);
				const row = (await ctx.context.adapter.findOne({
					model: BACKUP_CODE_MODEL,
					where: [
						{ field: "userId", value: pending.user.id },
						{ field: "codeHash", value: codeHash },
						{ field: "used", value: false },
					],
				})) as BackupCodeRow | null;
				if (!row) {
					throw new APIError("UNAUTHORIZED", {
						code: "INVALID_BACKUP_CODE",
						message: "This backup code is invalid or was already used.",
					});
				}

				// Conditional on `used: false` so two parallel requests cannot both
				// redeem the same code.
				const redeemed = await ctx.context.adapter.incrementOne({
					model: BACKUP_CODE_MODEL,
					where: [
						{ field: "id", value: row.id },
						{ field: "used", value: false },
					],
					increment: {},
					set: { used: true, usedAt: new Date() },
				});
				if (!redeemed) {
					throw new APIError("CONFLICT", {
						code: "BACKUP_CODE_ALREADY_USED",
						message: "This backup code was already used. Try another one.",
					});
				}

				return completeTwoFactorSignIn(
					ctx,
					pending.user.id,
					pending.token,
				);
			},
		),

		/**
		 * Starts the QR sign-in shown in security-key mode. The QR encodes the
		 * `/approve/<id>` page; a phone already signed in as the same account opens
		 * it and approves, and the waiting browser completes its session.
		 */
		startSecurityKeyQrLogin: createAuthEndpoint(
			"/webauthn-2fa/qr",
			{ method: "POST" },
			async (ctx) => {
				const pending = await resolvePendingTwoFactorUser(ctx);
				if (!pending) throw invalidChallenge();
				if (readMethod(pending.user) !== SECURITY_KEY_METHOD) {
					throw new APIError("BAD_REQUEST", {
						code: QR_LOGIN_UNAVAILABLE_CODE,
						message:
							"QR approval is only available when a security key is the second factor.",
					});
				}

				const expiresAt = new Date(
					Date.now() + LOGIN_REQUEST_TTL_SECONDS * 1000,
				);
				// The adapter owns id generation: its warning makes clear that an `id`
				// passed in `data` is ignored, so the request id is the created row's.
				const created = (await ctx.context.adapter.create({
					model: LOGIN_REQUEST_MODEL,
					data: {
						userId: pending.user.id,
						status: "pending",
						createdAt: new Date(),
						expiresAt,
					},
				})) as { id: string };
				const requestId = created.id;

				// Prefer the origin the browser used: a phone on the LAN must reach the
				// same address, while `baseURL` may be localhost.
				const origin = (
					ctx.headers?.get("origin") ?? ctx.context.baseURL
				).replace(/\/$/, "");

				return ctx.json(
					{
						requestId,
						url: `${origin}/approve/${requestId}`,
						expiresAt: expiresAt.toISOString(),
					},
					{ status: 200 },
				);
			},
		),

		/** Polled by the waiting browser; finishing here sets its session cookie. */
		getSecurityKeyQrLoginStatus: createAuthEndpoint(
			"/webauthn-2fa/qr/status",
			{ method: "POST", body: z.object({ requestId: z.string().min(1) }) },
			async (ctx) => {
				const pending = await resolvePendingTwoFactorUser(ctx);
				if (!pending) throw invalidChallenge();

				const request = await findLoginRequest(ctx, ctx.body.requestId);
				if (!request || request.userId !== pending.user.id) {
					throw invalidLoginRequest();
				}
				if (request.status === "consumed") throw invalidLoginRequest();

				if (request.status !== "approved" && isExpired(request.expiresAt)) {
					await ctx.context.adapter.update({
						model: LOGIN_REQUEST_MODEL,
						where: [{ field: "id", value: request.id }],
						update: { status: "expired" },
					});
					return ctx.json({ status: "expired" }, { status: 200 });
				}
				if (request.status !== "approved") {
					return ctx.json({ status: "pending" }, { status: 200 });
				}

				await ctx.context.adapter.update({
					model: LOGIN_REQUEST_MODEL,
					where: [{ field: "id", value: request.id }],
					update: { status: "consumed" },
				});
				return completeTwoFactorSignIn(
					ctx,
					pending.user.id,
					pending.token,
				);
			},
		),

		/** Called by the signed-in phone that scanned the QR code. */
		approveSecurityKeyQrLogin: createAuthEndpoint(
			"/webauthn-2fa/qr/approve",
			{
				method: "POST",
				use: [sessionMiddleware],
				body: z.object({ requestId: z.string().min(1) }),
			},
			async (ctx) => {
				const session = ctx.context.session;
				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						code: "SESSION_REQUIRED",
						message: "Sign in on this device to approve a sign-in.",
					});
				}

				const request = await findLoginRequest(ctx, ctx.body.requestId);
				if (
					!request ||
					request.status === "consumed" ||
					isExpired(request.expiresAt)
				) {
					throw invalidLoginRequest();
				}
				if (request.userId !== session.user.id) {
					throw new APIError("FORBIDDEN", {
						code: "QR_LOGIN_NOT_OWNER",
						message: "This sign-in request belongs to another account.",
					});
				}
				if (request.status === "approved") {
					return ctx.json({ status: "approved" }, { status: 200 });
				}

				await ctx.context.adapter.update({
					model: LOGIN_REQUEST_MODEL,
					where: [{ field: "id", value: request.id }],
					update: { status: "approved", approvedAt: new Date() },
				});
				return ctx.json({ status: "approved" }, { status: 200 });
			},
		),
	},
	hooks: {
		before: [
			{
				matcher: (ctx) =>
					ctx.path === "/two-factor/verify-totp" ||
					ctx.path === "/two-factor/verify-backup-code",
				handler: createAuthMiddleware(async (ctx) => {
					// A signed-in user verifying a factor from the settings page is not
					// signing in: only the pending password step follows the mode.
					if (await getSessionFromCtx(ctx)) return;
					const pending = await resolvePendingTwoFactorUser(ctx);

					if (!pending) return;
					if (readMethod(pending.user) !== SECURITY_KEY_METHOD) return;
					throw new APIError("UNAUTHORIZED", {
						code: SECURITY_KEY_REQUIRED_CODE,
						message: SECURITY_KEY_REQUIRED_MESSAGE,
					});
				}),
			},
		],
		after: [
			{
				matcher: (ctx) => ctx.path === "/two-factor/verify-totp",
				handler: createAuthMiddleware(async (ctx) => {
					// Completing a TOTP setup while signed in makes authenticator codes
					// the account's chosen factor.
					const session = await getSessionFromCtx(ctx);
					if (!session) return;
					await ctx.context.internalAdapter.updateUser(session.user.id, {
						twoFactorEnabled: true,
						twoFactorMethod: TOTP_METHOD,
					});
				}),
			},
			{
				matcher: (ctx) => ctx.path === "/two-factor/disable",
				handler: createAuthMiddleware(async (ctx) => {
					// better-auth clears `twoFactorEnabled` and its TOTP record; the
					// chosen method and this plugin's recovery codes go with it.
					const session = await getSessionFromCtx(ctx);
					if (!session) return;
					await ctx.context.internalAdapter.updateUser(session.user.id, {
						twoFactorMethod: null,
					});
					await ctx.context.adapter.deleteMany({
						model: BACKUP_CODE_MODEL,
						where: [{ field: "userId", value: session.user.id }],
					});
				}),
			},
		],
	},
});
