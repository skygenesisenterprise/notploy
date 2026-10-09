import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	getInstallation,
	validateInstallation,
} from "@notploy/server/services/instance-identity";
import {
	evaluateCapabilities,
	hasCapability,
} from "@notploy/server/utils/pki/capabilities";
import {
	ENTITLEMENT_TOKEN_PREFIX,
	signEntitlement,
	verifyEntitlementForInstance,
	verifyEntitlementToken,
} from "@notploy/server/utils/pki/entitlement";
import {
	generateLocalInstanceIdentity,
	identityFiles,
	loadInstanceIdentity,
	rotateLocalInstanceIdentity,
	writeEntitlementToken,
} from "@notploy/server/utils/pki/instance";
import type { EntitlementPayload } from "@notploy/server/utils/pki/types";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

const tempDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notploy-pki-"));
	tempDirs.push(dir);
	return dir;
};

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

const entitlementKeyPair = () => {
	const { privateKey, publicKey } = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});
	return { privateKey, publicKey };
};

const basePayload = (
	overrides: Partial<EntitlementPayload> = {},
): EntitlementPayload => ({
	version: 1,
	instanceId: "instance-1",
	product: "cloud",
	capabilities: ["cloud.control-plane", "cloud.fleet"],
	subjectKeyFingerprint: "abc123",
	issuedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
	expiresAt: new Date("2030-01-01T00:00:00Z").toISOString(),
	issuer: "Notploy",
	...overrides,
});

describe("signed entitlements", () => {
	it("signs and verifies a payload", () => {
		const { privateKey, publicKey } = entitlementKeyPair();
		const token = signEntitlement(basePayload(), privateKey);

		expect(token.startsWith(ENTITLEMENT_TOKEN_PREFIX)).toBe(true);
		const verified = verifyEntitlementToken(token, publicKey);
		expect(verified.valid).toBe(true);
		if (verified.valid) {
			expect(verified.payload.capabilities).toEqual([
				"cloud.control-plane",
				"cloud.fleet",
			]);
		}
	});

	it("rejects a token whose payload was tampered with", () => {
		const { privateKey, publicKey } = entitlementKeyPair();
		const token = signEntitlement(basePayload(), privateKey);
		const [prefix, , signature] = token.split(".");
		const forgedPayload = Buffer.from(
			JSON.stringify(basePayload({ capabilities: ["cloud.control-plane"] })),
		)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		const forged = `${prefix}.${forgedPayload}.${signature}`;
		const verified = verifyEntitlementToken(forged, publicKey);
		expect(verified.valid).toBe(false);
	});

	it("rejects a token signed by another key", () => {
		const signer = entitlementKeyPair();
		const other = entitlementKeyPair();
		const token = signEntitlement(basePayload(), signer.privateKey);
		const verified = verifyEntitlementToken(token, other.publicKey);
		expect(verified.valid).toBe(false);
	});

	it("detects an expired entitlement", () => {
		const { privateKey, publicKey } = entitlementKeyPair();
		const token = signEntitlement(
			basePayload({ expiresAt: new Date("2026-02-01T00:00:00Z").toISOString() }),
			privateKey,
		);
		const verified = verifyEntitlementForInstance(token, publicKey, {
			subjectKeyFingerprint: "abc123",
			now: new Date("2026-03-01T00:00:00Z"),
		});
		expect(verified.valid).toBe(false);
		if (!verified.valid) expect(verified.reason).toContain("expired");
	});

	it("refuses an entitlement bound to another instance key", () => {
		const { privateKey, publicKey } = entitlementKeyPair();
		const token = signEntitlement(basePayload(), privateKey);
		const verified = verifyEntitlementForInstance(token, publicKey, {
			subjectKeyFingerprint: "different",
		});
		expect(verified.valid).toBe(false);
		if (!verified.valid) expect(verified.reason).toContain("different instance key");
	});
});

describe("capability evaluation", () => {
	it("grants a self-hosted instance its built-in capabilities", () => {
		const evaluation = evaluateCapabilities({ product: "self" });
		expect(evaluation.has("self.hosted")).toBe(true);
		expect(evaluation.has("self.offline")).toBe(true);
		expect(evaluation.has("cloud.fleet")).toBe(false);
		expect(evaluation.entitlementRequired).toBe(false);
	});

	it("refuses cloud capabilities without an entitlement", () => {
		const evaluation = evaluateCapabilities({ product: "cloud" });
		expect(evaluation.capabilities).toEqual([]);
		expect(evaluation.entitlementRequired).toBe(true);
	});

	it("grants only the capabilities declared for the product", () => {
		const evaluation = evaluateCapabilities({
			product: "cloud",
			entitlement: basePayload({
				// console.remote-management is not a declared cloud capability.
				capabilities: ["cloud.control-plane", "console.remote-management"],
			}),
		});
		expect(evaluation.has("cloud.control-plane")).toBe(true);
		expect(evaluation.has("console.remote-management")).toBe(false);
	});

	it("never grants an unknown capability", () => {
		expect(hasCapability(["cloud.fleet"], "cloud.fleet")).toBe(true);
		expect(hasCapability(["cloud.fleet"], "does.not.exist")).toBe(false);
	});
});

describe("local instance identity", () => {
	const now = new Date("2026-06-01T00:00:00Z");

	it("bootstraps a valid identity with secure file permissions", () => {
		const identityDir = tempDir();
		const generated = generateLocalInstanceIdentity({ identityDir, now });
		const files = identityFiles(identityDir);

		expect(generated.identity.status).toBe("active");
		expect(generated.identity.product).toBe("self");
		expect(fs.existsSync(files.privateKeyPath)).toBe(true);
		expect(fs.existsSync(files.caKeyPath)).toBe(true);

		expect(fs.statSync(files.privateKeyPath).mode & 0o777).toBe(0o600);
		expect(fs.statSync(files.caKeyPath).mode & 0o777).toBe(0o600);

		const loaded = loadInstanceIdentity(identityDir, { now });
		expect(loaded.identity?.instanceId).toBe(generated.identity.instanceId);
		expect(
			loaded.diagnostics.some((d) => d.code === "identity.provisioned"),
		).toBe(true);
	});

	it("reports an invalid chain when the certificate is tampered with", () => {
		const identityDir = tempDir();
		generateLocalInstanceIdentity({ identityDir, now });
		const files = identityFiles(identityDir);
		fs.writeFileSync(files.certificatePath, "-----BEGIN CERTIFICATE-----\nNOPE\n-----END CERTIFICATE-----");

		const loaded = loadInstanceIdentity(identityDir, { now });
		expect(loaded.identity).toBeNull();
		expect(
			loaded.diagnostics.some((d) =>
				["identity.certificate_invalid", "identity.chain_invalid"].includes(
					d.code,
				),
			),
		).toBe(true);
	});

	it("rotates the certificate while preserving the instance id", () => {
		const identityDir = tempDir();
		const generated = generateLocalInstanceIdentity({ identityDir, now });
		const before = generated.identity.certificate.fingerprint;

		const rotated = rotateLocalInstanceIdentity({
			identityDir,
			now: new Date("2027-06-01T00:00:00Z"),
		});

		expect(rotated.identity.instanceId).toBe(generated.identity.instanceId);
		expect(rotated.identity.certificate.fingerprint).not.toBe(before);
		expect(
			fs.existsSync(`${identityFiles(identityDir).certificatePath}.previous`),
		).toBe(true);
	});

	it("loads a certificate without the X.509 extension via identity.json", () => {
		const identityDir = tempDir();
		// The shell installer signs the certificate with openssl, which cannot
		// emit the Notploy extension, and writes identity.json instead.
		const generated = generateLocalInstanceIdentity({
			identityDir,
			now,
			includeIdentityExtension: false,
		});

		const loaded = loadInstanceIdentity(identityDir, { now });
		expect(loaded.identity?.instanceId).toBe(generated.identity.instanceId);
		expect(loaded.identity?.product).toBe("self");
		expect(
			loaded.diagnostics.some((d) => d.code === "identity.provisioned"),
		).toBe(true);
	});

	it("reports a missing identity instead of throwing", () => {
		const identityDir = tempDir();
		const loaded = loadInstanceIdentity(identityDir, { now });
		expect(loaded.identity).toBeNull();
		expect(loaded.diagnostics[0]?.code).toBe("identity.missing");
	});
});

describe("runtime installation", () => {
	const now = new Date("2026-06-01T00:00:00Z");

	it("reports an unprovisioned installation with a clear diagnostic", () => {
		const identityDir = tempDir();
		const installation = getInstallation({ identityDir, now });
		expect(installation.identity).toBeNull();
		expect(
			installation.diagnostics.some((d) => d.code === "identity.missing"),
		).toBe(true);
	});

	it("exposes self-hosted capabilities through hasCapability", () => {
		const identityDir = tempDir();
		generateLocalInstanceIdentity({ identityDir, now });

		const installation = getInstallation({ identityDir, now });
		expect(installation.product).toBe("self");
		expect(installation.hasCapability("self.offline")).toBe(true);
		expect(installation.hasCapability("cloud.fleet")).toBe(false);
		expect(validateInstallation({ identityDir, now }).healthy).toBe(true);
	});

	it("fails a cloud installation without a signed entitlement", () => {
		const identityDir = tempDir();
		generateLocalInstanceIdentity({ identityDir, product: "cloud", now });

		const validation = validateInstallation({ identityDir, now });
		expect(validation.healthy).toBe(false);
		expect(
			validation.diagnostics.some(
				(d) => d.code === "entitlement.missing" && d.severity === "error",
			),
		).toBe(true);
	});

	it("allows an unlicensed cloud installation in development mode", () => {
		const identityDir = tempDir();
		generateLocalInstanceIdentity({ identityDir, product: "cloud", now });

		const installation = getInstallation({
			identityDir,
			now,
			allowUnlicensed: true,
		});
		expect(installation.product).toBe("cloud");
		expect(installation.hasCapability("cloud.control-plane")).toBe(true);
		expect(installation.hasCapability("cloud.fleet")).toBe(true);
		expect(
			installation.diagnostics.some((d) => d.severity === "error"),
		).toBe(false);
		expect(
			installation.diagnostics.find((d) => d.code === "entitlement.missing")
				?.severity,
		).toBe("warning");
		expect(
			validateInstallation({ identityDir, now, allowUnlicensed: true })
				.healthy,
		).toBe(true);
	});

	it("authorizes a cloud installation with a valid entitlement", () => {
		const identityDir = tempDir();
		const generated = generateLocalInstanceIdentity({
			identityDir,
			product: "cloud",
			now,
		});
		const { privateKey, publicKey } = entitlementKeyPair();
		const token = signEntitlement(
			basePayload({
				instanceId: generated.identity.instanceId,
				subjectKeyFingerprint:
					generated.identity.certificate.subjectKeyFingerprint,
			}),
			privateKey,
		);
		writeEntitlementToken(identityDir, token);

		const installation = getInstallation({
			identityDir,
			now,
			entitlementPublicKey: publicKey,
		});
		expect(installation.product).toBe("cloud");
		expect(installation.hasCapability("cloud.control-plane")).toBe(true);
		expect(
			installation.diagnostics.some((d) => d.severity === "error"),
		).toBe(false);
	});

	it("marks a revoked certificate as revoked", () => {
		const identityDir = tempDir();
		const generated = generateLocalInstanceIdentity({ identityDir, now });
		fs.writeFileSync(
			identityFiles(identityDir).revocationsPath,
			JSON.stringify([generated.identity.certificate.fingerprint]),
		);

		const installation = getInstallation({ identityDir, now });
		expect(installation.identity?.status).toBe("revoked");
		expect(
			installation.diagnostics.some((d) => d.code === "identity.revoked"),
		).toBe(true);
	});
});
