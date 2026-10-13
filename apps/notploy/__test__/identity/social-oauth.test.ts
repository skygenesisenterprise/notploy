import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildSocialAuthorizeUrl,
	exchangeSocialCode,
	fetchSocialUser,
	parseOauthConfig,
	testSocialConnection,
} from "@notploy/server/utils/identity/oauth";

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) =>
	({
		ok,
		status,
		json: async () => body,
	}) as Response;

const githubConfig = {
	provider: "github" as const,
	clientId: "client-id",
	clientSecret: "client-secret",
};

beforeEach(() => {
	mockFetch.mockReset();
});

describe("parseOauthConfig", () => {
	it("returns null for a missing or unreadable configuration", () => {
		expect(parseOauthConfig(null)).toBeNull();
		expect(parseOauthConfig("not-json")).toBeNull();
		// A client id is mandatory, so an incomplete config is rejected.
		expect(parseOauthConfig(JSON.stringify({ clientSecret: "x" }))).toBeNull();
	});

	it("defaults the source to GitHub and keeps the scopes", () => {
		const parsed = parseOauthConfig(
			JSON.stringify({
				clientId: "client-id",
				clientSecret: "client-secret",
				scopes: ["read:user"],
			}),
		);
		expect(parsed?.provider).toBe("github");
		expect(parsed?.scopes).toEqual(["read:user"]);
	});
});

describe("buildSocialAuthorizeUrl", () => {
	it("sends the client id, redirect, state and the default scopes", () => {
		const url = new URL(
			buildSocialAuthorizeUrl({
				config: githubConfig,
				redirectUri: "https://app.example.com/api/auth/sign-in/social-sso/callback",
				state: "signed-state",
			}),
		);

		expect(`${url.origin}${url.pathname}`).toBe(
			"https://github.com/login/oauth/authorize",
		);
		expect(url.searchParams.get("client_id")).toBe("client-id");
		expect(url.searchParams.get("state")).toBe("signed-state");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("scope")).toBe("read:user user:email");
		expect(url.searchParams.get("redirect_uri")).toBe(
			"https://app.example.com/api/auth/sign-in/social-sso/callback",
		);
		// The secret never leaves the server.
		expect(url.toString()).not.toContain("client-secret");
	});

	it("honours custom scopes", () => {
		const url = new URL(
			buildSocialAuthorizeUrl({
				config: { ...githubConfig, scopes: ["read:user"] },
				redirectUri: "https://app.example.com/callback",
				state: "s",
			}),
		);
		expect(url.searchParams.get("scope")).toBe("read:user");
	});
});

describe("exchangeSocialCode", () => {
	it("returns the access token and posts the secret in the body", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ access_token: "gho_token" }));

		const token = await exchangeSocialCode({
			config: githubConfig,
			code: "code-123",
			redirectUri: "https://app.example.com/callback",
		});

		expect(token).toBe("gho_token");
		const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(init.method).toBe("POST");
		expect(String(init.body)).toContain("client_secret=client-secret");
		expect(String(init.body)).toContain("code=code-123");
	});

	it("returns null when the source rejects the exchange", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ error: "bad_verification_code" }));

		await expect(
			exchangeSocialCode({
				config: githubConfig,
				code: "code-123",
				redirectUri: "https://app.example.com/callback",
			}),
		).resolves.toBeNull();
	});

	it("returns null when the response carries no token", async () => {
		mockFetch.mockResolvedValue(jsonResponse({}));

		await expect(
			exchangeSocialCode({
				config: githubConfig,
				code: "code-123",
				redirectUri: "https://app.example.com/callback",
			}),
		).resolves.toBeNull();
	});
});

describe("fetchSocialUser", () => {
	it("falls back to the verified primary email of a private profile", async () => {
		mockFetch.mockImplementation(async (url: string) => {
			if (String(url).endsWith("/user")) {
				return jsonResponse({
					id: 42,
					login: "octocat",
					name: null,
					email: null,
				});
			}
			if (String(url).endsWith("/user/emails")) {
				return jsonResponse([
					{ email: "secondary@example.com", primary: false, verified: true },
					{ email: "Primary@Example.com", primary: true, verified: true },
				]);
			}
			return jsonResponse({}, false, 404);
		});

		const user = await fetchSocialUser({
			config: githubConfig,
			accessToken: "gho_token",
		});

		expect(user).toEqual({
			id: "42",
			email: "primary@example.com",
			name: "octocat",
		});
	});

	it("returns null when the source rejects the token", async () => {
		mockFetch.mockResolvedValue(jsonResponse({}, false, 401));

		await expect(
			fetchSocialUser({ config: githubConfig, accessToken: "revoked" }),
		).resolves.toBeNull();
	});
});

describe("testSocialConnection", () => {
	it("reports the source as connected", async () => {
		mockFetch.mockResolvedValue(jsonResponse({}));
		await expect(testSocialConnection(githubConfig)).resolves.toEqual({
			connected: true,
			message: "Connected to GitHub.",
		});
	});

	it("reports the failure message when the source cannot be reached", async () => {
		mockFetch.mockRejectedValue(new Error("fetch failed"));
		const result = await testSocialConnection(githubConfig);
		expect(result.connected).toBe(false);
		expect(result.message).toBe("fetch failed");
	});
});
