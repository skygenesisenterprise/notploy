import { describe, expect, it } from "vitest";
import {
	normalizeCatalog,
	toCertificate,
	toDestination,
	toRegistry,
	toSshKey,
	toTag,
} from "@/shared/domain";

/**
 * These normalizers are the last point at which credential material can be
 * dropped before it reaches the renderer, so the tests check two things: that a
 * real payload is read correctly, and that **nothing secret survives** — asserted
 * on the serialized object, which is what would actually cross the bridge.
 */

/** Every string here would be a serious leak if it reached the UI. */
const SECRETS = [
	"-----BEGIN OPENSSH PRIVATE KEY-----",
	"-----BEGIN PRIVATE KEY-----",
	"correct-horse-battery-staple",
	"AKIAIOSFODNN7EXAMPLE",
	"wJalrXUtnFEMI-K7MDENG-bPxRfiCYEXAMPLEKEY",
];

function expectNoSecrets(value: unknown): void {
	const serialized = JSON.stringify(value);
	for (const secret of SECRETS) {
		expect(serialized, secret).not.toContain(secret);
	}
}

describe("toTag", () => {
	it("reads the stored record", () => {
		expect(
			toTag({
				tagId: "tag_1",
				name: "production",
				color: "#00bc7d",
				createdAt: "2026-09-01T10:00:00.000Z",
				organizationId: "org_1",
			}),
		).toEqual({
			tagId: "tag_1",
			name: "production",
			color: "#00bc7d",
			createdAt: "2026-09-01T10:00:00.000Z",
		});
	});

	it("keeps the organisation out of the payload", () => {
		// The credential is scoped to one organization; repeating its id in the
		// renderer serves no purpose.
		const tag = toTag({ tagId: "t", name: "n", organizationId: "org_1" });
		expect(tag).not.toHaveProperty("organizationId");
	});

	it("falls back to the identifier when the name is missing", () => {
		expect(toTag({ tagId: "tag_2" })?.name).toBe("tag_2");
	});

	it("returns undefined for a value with no identifier", () => {
		for (const input of [null, undefined, 42, "tag", [], { name: "n" }]) {
			expect(toTag(input), String(input)).toBeUndefined();
		}
	});
});

describe("toSshKey", () => {
	it("keeps the public half and reduces the private half to a boolean", () => {
		const key = toSshKey({
			sshKeyId: "key_1",
			name: "deploy",
			description: "CI",
			publicKey: "ssh-ed25519 AAAAC3Nz notploy",
			privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
			createdAt: "2026-09-02T10:00:00.000Z",
			lastUsedAt: "2026-09-20T10:00:00.000Z",
		});

		expect(key).toEqual({
			sshKeyId: "key_1",
			name: "deploy",
			description: "CI",
			publicKey: "ssh-ed25519 AAAAC3Nz notploy",
			createdAt: "2026-09-02T10:00:00.000Z",
			lastUsedAt: "2026-09-20T10:00:00.000Z",
			hasPrivateKey: true,
		});
		expectNoSecrets(key);
	});

	it("reports an empty key as absent rather than as present", () => {
		// `privateKey` defaults to `""` for a key created without one.
		expect(
			toSshKey({ sshKeyId: "k", name: "n", privateKey: "" })?.hasPrivateKey,
		).toBe(false);
	});
});

describe("toCertificate", () => {
	it("reports whether both halves are present, and nothing else", () => {
		const complete = toCertificate({
			certificateId: "cert_1",
			name: "example.com",
			certificatePath: "/etc/notploy/certs/certificate_abc",
			certificateData: "-----BEGIN CERTIFICATE-----",
			privateKey: "-----BEGIN PRIVATE KEY-----",
			autoRenew: true,
			serverId: "srv_1",
		});

		expect(complete).toEqual({
			certificateId: "cert_1",
			name: "example.com",
			certificatePath: "/etc/notploy/certs/certificate_abc",
			autoRenew: true,
			serverId: "srv_1",
			hasCertificateData: true,
			hasPrivateKey: true,
		});
		expectNoSecrets(complete);

		const incomplete = toCertificate({
			certificateId: "cert_2",
			name: "half",
			certificateData: "-----BEGIN CERTIFICATE-----",
			privateKey: "",
		});
		expect(incomplete?.hasCertificateData).toBe(true);
		expect(incomplete?.hasPrivateKey).toBe(false);
	});

	it("reads a missing auto-renew flag as unknown, not as false", () => {
		// `autoRenew` is a nullable column: absent means "not recorded", which
		// the UI shows differently from an explicit "no".
		expect(
			toCertificate({ certificateId: "c", name: "n" })?.autoRenew,
		).toBeNull();
		expect(
			toCertificate({ certificateId: "c", name: "n", autoRenew: false })
				?.autoRenew,
		).toBe(false);
	});
});

describe("toRegistry", () => {
	it("drops the password", () => {
		const registry = toRegistry({
			registryId: "reg_1",
			registryName: "GHCR",
			username: "skygenesis",
			password: "correct-horse-battery-staple",
			registryUrl: "ghcr.io",
			imagePrefix: "ghcr.io/skygenesis",
			registryType: "cloud",
			createdAt: "2026-09-03T10:00:00.000Z",
		});

		expect(registry).toEqual({
			registryId: "reg_1",
			registryName: "GHCR",
			username: "skygenesis",
			registryUrl: "ghcr.io",
			imagePrefix: "ghcr.io/skygenesis",
			registryType: "cloud",
			createdAt: "2026-09-03T10:00:00.000Z",
		});
		expectNoSecrets(registry);
		expect(registry).not.toHaveProperty("password");
	});
});

describe("toDestination", () => {
	it("drops both access keys", () => {
		const destination = toDestination({
			destinationId: "dst_1",
			name: "Backups",
			provider: "AWS",
			accessKey: "AKIAIOSFODNN7EXAMPLE",
			secretAccessKey: "wJalrXUtnFEMI-K7MDENG-bPxRfiCYEXAMPLEKEY",
			bucket: "notploy-backups",
			region: "eu-west-3",
			endpoint: "https://s3.eu-west-3.amazonaws.com",
			additionalFlags: ["--s3-no-check-bucket"],
			createdAt: new Date("2026-09-04T10:00:00.000Z"),
		});

		expect(destination).toEqual({
			destinationId: "dst_1",
			name: "Backups",
			provider: "AWS",
			bucket: "notploy-backups",
			region: "eu-west-3",
			endpoint: "https://s3.eu-west-3.amazonaws.com",
			createdAt: "2026-09-04T10:00:00.000Z",
		});
		expectNoSecrets(destination);
	});

	it("serializes a timestamp column as an ISO string", () => {
		// `destinations.createdAt` is the one date column in this group, and an
		// instance may hand it over as a `Date` or as a string.
		expect(
			toDestination({
				destinationId: "d",
				createdAt: "2026-09-04T10:00:00.000Z",
			})?.createdAt,
		).toBe("2026-09-04T10:00:00.000Z");
		expect(
			toDestination({ destinationId: "d", createdAt: 42 })?.createdAt,
		).toBe(undefined);
	});
});

describe("normalizeCatalog", () => {
	it("reads a bare array", () => {
		expect(
			normalizeCatalog(
				[
					{ tagId: "a", name: "A" },
					{ tagId: "b", name: "B" },
				],
				toTag,
			),
		).toHaveLength(2);
	});

	it("reads a paginated envelope", () => {
		// The routers mix both conventions; a page must not come out empty
		// because an instance changed which one a procedure uses.
		expect(
			normalizeCatalog({ items: [{ tagId: "a", name: "A" }], total: 1 }, toTag),
		).toEqual([{ tagId: "a", name: "A", color: null, createdAt: undefined }]);
	});

	it("skips entries it cannot read instead of failing the list", () => {
		const result = normalizeCatalog(
			[{ tagId: "a" }, null, "nonsense", { name: "no id" }, { tagId: "b" }],
			toTag,
		);
		expect(result.map((tag) => tag.tagId)).toEqual(["a", "b"]);
	});

	it("returns an empty list for anything else", () => {
		for (const input of [
			null,
			undefined,
			42,
			"not a list",
			{},
			{ items: null },
		]) {
			expect(normalizeCatalog(input, toTag), String(input)).toEqual([]);
		}
	});
});
