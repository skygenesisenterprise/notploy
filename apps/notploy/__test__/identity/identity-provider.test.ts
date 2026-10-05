import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getIdentityCapabilities,
	getIdentityProviderHealth,
	listIdentityProviderDescriptors,
} from "@notploy/server/services/identity-provider";
import type { IdentityProviderRecord } from "@notploy/server/services/identity-provider";

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) =>
	({
		ok,
		status,
		json: async () => body,
	}) as Response;

const oidcProvider = (
	overrides: Partial<IdentityProviderRecord> = {},
): IdentityProviderRecord => ({
	providerId: "okta",
	issuer: "https://idp.example.com",
	domain: "example.com",
	oidcConfig: JSON.stringify({
		clientId: "client-id",
		clientSecret: "super-secret-value",
		scopes: ["openid", "email"],
	}),
	samlConfig: null,
	...overrides,
});

beforeEach(() => {
	mockFetch.mockReset();
});

describe("listIdentityProviderDescriptors", () => {
	it("describes every supported protocol with capabilities", () => {
		const descriptors = listIdentityProviderDescriptors();
		const protocols = descriptors.map((d) => d.providerType);
		expect(protocols).toEqual([
			"oidc",
			"saml",
			"ldap",
			"active-directory",
			"custom",
		]);

		const oidc = descriptors.find((d) => d.providerType === "oidc");
		expect(oidc?.category).toBe("federated");
		expect(oidc?.capabilities.singleSignOn).toBe(true);
		expect(oidc?.capabilities.pkce).toBe(true);
		// A directory capability OIDC does not provide stays disabled.
		expect(oidc?.capabilities.directorySearch).toBe(false);
	});

	it("marks LDAP as a directory provider", () => {
		expect(getIdentityCapabilities("ldap").directorySearch).toBe(true);
		expect(getIdentityCapabilities("saml").directorySearch).toBe(false);
		expect(getIdentityCapabilities("saml").certificateRotation).toBe(true);
	});
});

describe("getIdentityProviderHealth - OIDC", () => {
	it("reports connected and validates discovery metadata", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				issuer: "https://idp.example.com",
				authorization_endpoint: "https://idp.example.com/authorize",
				token_endpoint: "https://idp.example.com/token",
				jwks_uri: "https://idp.example.com/jwks",
				userinfo_endpoint: "https://idp.example.com/userinfo",
				scopes_supported: ["openid", "email"],
			}),
		);

		const health = await getIdentityProviderHealth(oidcProvider());

		expect(health.status).toBe("connected");
		expect(health.protocol).toBe("oidc");
		expect(health.capabilities.singleSignOn).toBe(true);
		expect(health.identity?.jwksUri).toBe("https://idp.example.com/jwks");
		expect(typeof health.latencyMs).toBe("number");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://idp.example.com/.well-known/openid-configuration",
			expect.anything(),
		);
	});

	it("never returns the stored client secret", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				issuer: "https://idp.example.com",
				authorization_endpoint: "https://idp.example.com/authorize",
				token_endpoint: "https://idp.example.com/token",
				jwks_uri: "https://idp.example.com/jwks",
			}),
		);

		const health = await getIdentityProviderHealth(oidcProvider());
		expect(JSON.stringify(health)).not.toContain("super-secret-value");
	});

	it("flags an issuer mismatch as misconfigured", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				issuer: "https://other.example.com",
				authorization_endpoint: "https://other.example.com/authorize",
				token_endpoint: "https://other.example.com/token",
				jwks_uri: "https://other.example.com/jwks",
			}),
		);

		const health = await getIdentityProviderHealth(oidcProvider());
		expect(health.status).toBe("misconfigured");
		expect(health.message).toContain("does not match");
	});

	it("flags missing discovery endpoints as misconfigured", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ issuer: "https://idp.example.com" }));
		const health = await getIdentityProviderHealth(oidcProvider());
		expect(health.status).toBe("misconfigured");
	});

	it("reports unreachable when the probe fails", async () => {
		mockFetch.mockRejectedValue(new Error("fetch failed"));
		const health = await getIdentityProviderHealth(oidcProvider());
		expect(health.status).toBe("unreachable");
	});

	it("skips discovery when configured and validates endpoints instead", async () => {
		const health = await getIdentityProviderHealth(
			oidcProvider({
				oidcConfig: JSON.stringify({
					clientId: "client-id",
					clientSecret: "secret",
					skipDiscovery: true,
					authorizationEndpoint: "https://idp.example.com/authorize",
					tokenEndpoint: "https://idp.example.com/token",
					jwksEndpoint: "https://idp.example.com/jwks",
				}),
			}),
		);

		expect(health.status).toBe("connected");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("flags a missing client id as misconfigured", async () => {
		const health = await getIdentityProviderHealth(
			oidcProvider({
				oidcConfig: JSON.stringify({ clientSecret: "secret" }),
			}),
		);
		expect(health.status).toBe("misconfigured");
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe("getIdentityProviderHealth - SAML", () => {
	const samlProvider = (
		samlConfig: Record<string, unknown>,
	): IdentityProviderRecord =>
		oidcProvider({ oidcConfig: null, samlConfig: JSON.stringify(samlConfig) });

	it("validates a complete SAML configuration structurally", async () => {
		const health = await getIdentityProviderHealth(
			samlProvider({
				entryPoint: "https://idp.example.com/sso",
				cert: "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----",
				callbackUrl: "https://app.example.com/api/auth/sso/saml2/callback/okta",
				mapping: { id: "nameID", email: "email", name: "displayName" },
			}),
		);

		expect(health.status).toBe("connected");
		expect(health.protocol).toBe("saml");
		expect(health.identity?.ssoUrl).toBe("https://idp.example.com/sso");
		// SAML is validated structurally, not over the network.
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("flags a missing certificate as misconfigured", async () => {
		const health = await getIdentityProviderHealth(
			samlProvider({
				entryPoint: "https://idp.example.com/sso",
				cert: "",
				callbackUrl: "https://app.example.com/callback",
			}),
		);
		expect(health.status).toBe("misconfigured");
		expect(health.message).toContain("signing certificate");
	});

	it("flags a non-PEM certificate as misconfigured", async () => {
		const health = await getIdentityProviderHealth(
			samlProvider({
				entryPoint: "https://idp.example.com/sso",
				cert: "not-a-certificate",
				callbackUrl: "https://app.example.com/callback",
			}),
		);
		expect(health.status).toBe("misconfigured");
	});
});
