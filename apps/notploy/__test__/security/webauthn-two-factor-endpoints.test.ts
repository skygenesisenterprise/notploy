import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { twoFactor } from "better-auth/plugins";
import { webauthnTwoFactor } from "@notploy/server/lib/plugins/webauthn-two-factor";
import { beforeEach, describe, expect, it } from "vitest";

const BASE_URL = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-staple";
const EMAIL = "security-key@example.com";
const OTHER_EMAIL = "other-security-key@example.com";

const createAuth = () => {
	// The memory adapter only knows the models it is given up front.
	const database: Record<string, unknown[]> = {
		user: [],
		session: [],
		account: [],
		verification: [],
		twoFactor: [],
		securityKey: [],
	};

	return betterAuth({
		baseURL: BASE_URL,
		secret: "test-secret-for-webauthn-two-factor-0123456789",
		database: memoryAdapter(database),
		emailAndPassword: { enabled: true },
		trustedOrigins: [ORIGIN],
		plugins: [twoFactor(), webauthnTwoFactor()],
	});
};

type Auth = ReturnType<typeof createAuth>;

/** Minimal browser-like cookie jar for `auth.handler` requests. */
class CookieJar {
	private readonly values = new Map<string, string>();

	absorb(response: Response) {
		for (const header of response.headers.getSetCookie()) {
			const pair = header.split(";")[0] ?? "";
			const separator = pair.indexOf("=");
			if (separator === -1) continue;
			const name = pair.slice(0, separator);
			const value = pair.slice(separator + 1);
			if (value === "") {
				this.values.delete(name);
			} else {
				this.values.set(name, value);
			}
		}
		return this;
	}

	header() {
		return [...this.values]
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}

	names() {
		return [...this.values.keys()];
	}
}

const request = (
	auth: Auth,
	path: string,
	options: { body?: unknown; method?: string; cookie?: string } = {},
) =>
	auth.handler(
		new Request(`${BASE_URL}/api/auth${path}`, {
			method: options.method ?? "POST",
			headers: {
				"content-type": "application/json",
				origin: ORIGIN,
				...(options.cookie ? { cookie: options.cookie } : {}),
			},
			body:
				options.body === undefined ? undefined : JSON.stringify(options.body),
		}),
	);

const signUp = async (auth: Auth, email: string) => {
	const jar = new CookieJar();
	const response = await request(auth, "/sign-up/email", {
		body: { email, password: PASSWORD, name: "Security Key" },
	});
	jar.absorb(response);
	const { user } = (await response.json()) as { user: { id: string } };
	return { userId: user.id, jar };
};

/**
 * Signs a user up, enables two-factor, then signs in again so the returned jar
 * holds a pending two-factor token (no session, by design).
 */
const createUserWithPendingTwoFactor = async (auth: Auth) => {
	const { userId, jar: sessionJar } = await signUp(auth, EMAIL);

	const context = await auth.$context;
	await context.adapter.update({
		model: "user",
		where: [{ field: "id", value: userId }],
		update: { twoFactorEnabled: true },
	});

	const pendingJar = new CookieJar();
	const signIn = await request(auth, "/sign-in/email", {
		body: { email: EMAIL, password: PASSWORD },
	});
	pendingJar.absorb(signIn);
	const signInBody = (await signIn.json()) as { twoFactorRedirect?: boolean };

	return { userId, sessionJar, jar: pendingJar, signInBody };
};

const createSecurityKeyRow = async (
	auth: Auth,
	userId: string,
	overrides: { credentialID?: string; name?: string } = {},
) => {
	const context = await auth.$context;
	return (await context.adapter.create({
		model: "securityKey",
		data: {
			name: overrides.name ?? "Bitwarden vault",
			userId,
			credentialID:
				overrides.credentialID ?? "credential-id-from-the-authenticator",
			publicKey: Buffer.from([1, 2, 3, 4]).toString("base64"),
			counter: 0,
			deviceType: "multiDevice",
			backedUp: true,
			transports: "internal,hybrid",
			createdAt: new Date("2026-01-02T03:04:05.000Z"),
			aaguid: "00000000-0000-0000-0000-000000000000",
		},
	})) as { id: string };
};

const assertionBody = (credentialID: string) => ({
	response: {
		id: credentialID,
		rawId: credentialID,
		type: "public-key",
		clientExtensionResults: {},
		response: {
			clientDataJSON: "e30",
			authenticatorData: "e30",
			signature: "e30",
		},
	},
});

describe("WebAuthn two-factor endpoints", () => {
	let auth: Auth;
	let userId: string;
	let sessionJar: CookieJar;
	let jar: CookieJar;

	beforeEach(async () => {
		auth = createAuth();
		const setup = await createUserWithPendingTwoFactor(auth);
		userId = setup.userId;
		sessionJar = setup.sessionJar;
		jar = setup.jar;
		expect(setup.signInBody.twoFactorRedirect).toBe(true);
	});

	it("rejects a challenge request with no pending two-factor token", async () => {
		const response = await request(auth, "/webauthn-2fa/generate-options");
		expect(response.status).toBe(401);
		const body = (await response.json()) as { code?: string };
		expect(body.code).toBe("INVALID_TWO_FACTOR_CHALLENGE");
	});

	it("reports NO_SECURITY_KEY when the account has no registered key", async () => {
		const response = await request(auth, "/webauthn-2fa/generate-options", {
			cookie: jar.header(),
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as { code?: string; message?: string };
		expect(body.code).toBe("NO_SECURITY_KEY");
		expect(body.message).toContain("No security key");
	});

	it("issues a challenge restricted to the account's key", async () => {
		await createSecurityKeyRow(auth, userId);

		const response = await request(auth, "/webauthn-2fa/generate-options", {
			cookie: jar.header(),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			challenge: string;
			rpId: string;
			allowCredentials: { id: string; type: string }[];
		};
		expect(body.rpId).toBe("localhost");
		expect(body.challenge.length).toBeGreaterThan(20);
		expect(body.allowCredentials).toEqual([
			expect.objectContaining({
				id: "credential-id-from-the-authenticator",
				type: "public-key",
			}),
		]);

		jar.absorb(response);
		expect(
			jar.names().some((name) => name.endsWith("webauthn_2fa_challenge")),
		).toBe(true);
	});

	it("rejects an assertion for an unknown credential", async () => {
		await createSecurityKeyRow(auth, userId);
		const challenge = await request(auth, "/webauthn-2fa/generate-options", {
			cookie: jar.header(),
		});
		jar.absorb(challenge);

		const response = await request(auth, "/webauthn-2fa/verify", {
			cookie: jar.header(),
			body: assertionBody("unknown-credential"),
		});
		expect(response.status).toBe(401);
		const body = (await response.json()) as { code?: string };
		expect(body.code).toBe("SECURITY_KEY_NOT_FOUND");
		expect(jar.names().some((name) => name.includes("session_token"))).toBe(
			false,
		);
	});

	it("keeps the pending factor usable after a failed assertion", async () => {
		await createSecurityKeyRow(auth, userId);
		const challenge = await request(auth, "/webauthn-2fa/generate-options", {
			cookie: jar.header(),
		});
		jar.absorb(challenge);

		const failed = await request(auth, "/webauthn-2fa/verify", {
			cookie: jar.header(),
			body: assertionBody("credential-id-from-the-authenticator"),
		});
		expect(failed.status).toBe(401);
		const failedBody = (await failed.json()) as { code?: string };
		expect(failedBody.code).toBe("SECURITY_KEY_VERIFICATION_FAILED");
		expect(jar.names().some((name) => name.includes("session_token"))).toBe(
			false,
		);

		// The two-factor token is only consumed by a valid assertion.
		const retry = await request(auth, "/webauthn-2fa/generate-options", {
			cookie: jar.header(),
		});
		expect(retry.status).toBe(200);
	});

	it("rejects a verify request without a challenge cookie", async () => {
		await createSecurityKeyRow(auth, userId);
		const response = await request(auth, "/webauthn-2fa/verify", {
			cookie: jar.header(),
			body: assertionBody("credential-id-from-the-authenticator"),
		});
		expect(response.status).toBe(401);
		const body = (await response.json()) as { code?: string };
		expect(body.code).toBe("INVALID_TWO_FACTOR_CHALLENGE");
	});
});

describe("Security key management endpoints", () => {
	let auth: Auth;
	let userId: string;
	let sessionJar: CookieJar;

	beforeEach(async () => {
		auth = createAuth();
		const setup = await createUserWithPendingTwoFactor(auth);
		userId = setup.userId;
		sessionJar = setup.sessionJar;
	});

	it("requires a session to list or register keys", async () => {
		const list = await request(auth, "/webauthn-2fa/keys", { method: "GET" });
		expect(list.status).toBe(401);

		const options = await request(auth, "/webauthn-2fa/keys/options");
		expect(options.status).toBe(401);
	});

	it("lists the account's keys without exposing key material", async () => {
		await createSecurityKeyRow(auth, userId);

		const response = await request(auth, "/webauthn-2fa/keys", {
			method: "GET",
			cookie: sessionJar.header(),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>[];
		expect(body).toEqual([
			{
				id: expect.any(String),
				name: "Bitwarden vault",
				deviceType: "multiDevice",
				backedUp: true,
				createdAt: "2026-01-02T03:04:05.000Z",
				aaguid: "00000000-0000-0000-0000-000000000000",
			},
		]);
		expect(body[0]).not.toHaveProperty("publicKey");
		expect(body[0]).not.toHaveProperty("credentialID");
	});

	it("issues registration options excluding the keys already registered", async () => {
		await createSecurityKeyRow(auth, userId);

		const response = await request(auth, "/webauthn-2fa/keys/options", {
			cookie: sessionJar.header(),
		});
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			challenge: string;
			rp: { id: string };
			excludeCredentials: { id: string }[];
			authenticatorSelection: { residentKey: string };
		};
		expect(body.rp.id).toBe("localhost");
		expect(body.excludeCredentials).toEqual([
			expect.objectContaining({
				id: "credential-id-from-the-authenticator",
			}),
		]);
		expect(body.authenticatorSelection.residentKey).toBe("discouraged");

		sessionJar.absorb(response);
		expect(
			sessionJar
				.names()
				.some((name) => name.endsWith("webauthn_registration_challenge")),
		).toBe(true);
	});

	it("rejects a registration payload that is not a valid attestation", async () => {
		const options = await request(auth, "/webauthn-2fa/keys/options", {
			cookie: sessionJar.header(),
		});
		sessionJar.absorb(options);

		const response = await request(auth, "/webauthn-2fa/keys/register", {
			cookie: sessionJar.header(),
			body: {
				name: "Broken key",
				response: {
					id: "broken",
					rawId: "broken",
					type: "public-key",
					clientExtensionResults: {},
					response: {
						clientDataJSON: "e30",
						attestationObject: "e30",
					},
				},
			},
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as { code?: string };
		expect(body.code).toBe("SECURITY_KEY_REGISTRATION_FAILED");

		const keys = await request(auth, "/webauthn-2fa/keys", {
			method: "GET",
			cookie: sessionJar.header(),
		});
		expect(await keys.json()).toEqual([]);
	});

	it("removes only keys belonging to the account", async () => {
		const key = await createSecurityKeyRow(auth, userId);
		const other = await signUp(auth, OTHER_EMAIL);
		const otherKey = await createSecurityKeyRow(auth, other.userId, {
			credentialID: "other-credential",
			name: "Other vault",
		});

		const foreign = await request(auth, "/webauthn-2fa/keys/delete", {
			cookie: sessionJar.header(),
			body: { id: otherKey.id },
		});
		expect(foreign.status).toBe(404);

		const removed = await request(auth, "/webauthn-2fa/keys/delete", {
			cookie: sessionJar.header(),
			body: { id: key.id },
		});
		expect(removed.status).toBe(200);
		expect(await removed.json()).toEqual({ success: true });

		const keys = await request(auth, "/webauthn-2fa/keys", {
			method: "GET",
			cookie: sessionJar.header(),
		});
		expect(await keys.json()).toEqual([]);
	});
});
