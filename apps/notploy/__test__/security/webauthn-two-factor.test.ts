import {
	parseCredentialTransports,
	resolveWebAuthnRequestContext,
	toSecurityKeySummary,
} from "@notploy/server/lib/plugins/webauthn-two-factor";
import { describe, expect, it } from "vitest";

describe("resolveWebAuthnRequestContext", () => {
	it("derives the relying party from the request origin", () => {
		expect(
			resolveWebAuthnRequestContext({
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
				requestOrigin: "http://localhost:3000",
			}),
		).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
	});

	it("accepts a host that differs from BETTER_AUTH_URL", () => {
		// The dashboard proxied through a tunnel or reached as 127.0.0.1 still
		// runs the ceremony on that host, so it is the relying party.
		expect(
			resolveWebAuthnRequestContext({
				requestOrigin: "https://notploy.ngrok-free.app",
			}),
		).toEqual({
			rpID: "notploy.ngrok-free.app",
			origin: "https://notploy.ngrok-free.app",
		});
		expect(
			resolveWebAuthnRequestContext({
				requestOrigin: "http://127.0.0.1:3000",
			}),
		).toEqual({ rpID: "127.0.0.1", origin: "http://127.0.0.1:3000" });
	});

	it("keeps an explicitly configured relying party ID", () => {
		expect(
			resolveWebAuthnRequestContext({
				configuredRpID: "notploy.example.com",
				requestOrigin: "https://notploy.example.com",
			}),
		).toEqual({
			rpID: "notploy.example.com",
			origin: "https://notploy.example.com",
		});
	});

	it("accepts a pinned relying party that covers a subdomain", () => {
		expect(
			resolveWebAuthnRequestContext({
				configuredRpID: "notploy.example.com",
				requestOrigin: "https://app.notploy.example.com",
			}),
		).toEqual({
			rpID: "notploy.example.com",
			origin: "https://app.notploy.example.com",
		});
	});

	it("rejects a pinned relying party that does not cover the origin", () => {
		expect(
			resolveWebAuthnRequestContext({
				configuredRpID: "notploy.example.com",
				requestOrigin: "https://evil.example.net",
			}),
		).toBeNull();
	});

	it("rejects plain HTTP outside loopback", () => {
		expect(
			resolveWebAuthnRequestContext({
				requestOrigin: "http://notploy.example.com",
			}),
		).toBeNull();
	});

	it("rejects a missing or malformed request origin", () => {
		expect(resolveWebAuthnRequestContext({})).toBeNull();
		expect(
			resolveWebAuthnRequestContext({ requestOrigin: "not a url" }),
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
