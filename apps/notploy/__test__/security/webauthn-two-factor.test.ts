import {
	parseCredentialTransports,
	resolveWebAuthnRequestContext,
	toSecurityKeySummary,
} from "@notploy/server/lib/plugins/webauthn-two-factor";
import { describe, expect, it } from "vitest";

describe("resolveWebAuthnRequestContext", () => {
	it("derives the relying party from the auth base URL", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://notploy.example.com/api/auth",
				requestOrigin: "https://notploy.example.com",
			}),
		).toEqual({
			rpID: "notploy.example.com",
			origin: "https://notploy.example.com",
		});
	});

	it("keeps the port in the expected origin", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "http://localhost:3000",
				requestOrigin: "http://localhost:3000",
			}),
		).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
	});

	it("prefers an explicitly configured relying party ID", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://internal.notploy.local",
				configuredRpID: "notploy.example.com",
				requestOrigin: "https://notploy.example.com",
			}),
		).toEqual({
			rpID: "notploy.example.com",
			origin: "https://notploy.example.com",
		});
	});

	it("rejects an origin outside the relying party", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://notploy.example.com",
				requestOrigin: "https://evil.example.net",
			}),
		).toBeNull();
	});

	it("rejects a subdomain that is not the relying party", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://notploy.example.com",
				requestOrigin: "https://app.notploy.example.com",
			}),
		).toBeNull();
	});

	it("rejects plain HTTP outside loopback", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "http://notploy.example.com",
				requestOrigin: "http://notploy.example.com",
			}),
		).toBeNull();
	});

	it("rejects a missing or malformed request origin", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://notploy.example.com",
			}),
		).toBeNull();
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "https://notploy.example.com",
				requestOrigin: "not a url",
			}),
		).toBeNull();
	});

	it("rejects an unusable base URL", () => {
		expect(
			resolveWebAuthnRequestContext({
				baseURL: "not a url",
				requestOrigin: "https://notploy.example.com",
			}),
		).toBeNull();
	});
});

describe("parseCredentialTransports", () => {
	it("splits the stored transport list", () => {
		expect(parseCredentialTransports("usb,nfc,hybrid")).toEqual([
			"usb",
			"nfc",
			"hybrid",
		]);
	});

	it("returns undefined when no transport was stored", () => {
		expect(parseCredentialTransports(null)).toBeUndefined();
		expect(parseCredentialTransports("")).toBeUndefined();
		expect(parseCredentialTransports(" , ,")).toBeUndefined();
	});
});

describe("toSecurityKeySummary", () => {
	it("exposes only display fields", () => {
		expect(
			toSecurityKeySummary({
				id: "key-1",
				userId: "user-1",
				name: "Bitwarden vault",
				credentialID: "credential-1",
				publicKey: "c2VjcmV0",
				counter: 4,
				deviceType: "multiDevice",
				backedUp: true,
				transports: "internal",
				createdAt: "2026-01-02T03:04:05.000Z",
				aaguid: null,
			}),
		).toEqual({
			id: "key-1",
			name: "Bitwarden vault",
			deviceType: "multiDevice",
			backedUp: true,
			createdAt: "2026-01-02T03:04:05.000Z",
			aaguid: null,
		});
	});
});
