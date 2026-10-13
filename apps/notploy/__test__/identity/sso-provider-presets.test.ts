import { describe, expect, it } from "vitest";
import {
	findProviderPreset,
	identityProviderPresets,
	presetForProvider,
	providerPresetGroups,
} from "@/components/proprietary/sso/sso-provider-presets";
import { providerCategoryOrder } from "@/components/proprietary/sso/sso-provider-meta";

describe("identityProviderPresets", () => {
	it("keeps a generic entry for every selectable protocol", () => {
		for (const protocol of [
			"oidc",
			"saml",
			"ldap",
			"active-directory",
		] as const) {
			expect(findProviderPreset(protocol)?.protocol).toBe(protocol);
		}
	});

	it("uses unique, URL-safe ids (they double as the suggested provider id)", () => {
		const ids = identityProviderPresets.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});

	it("only targets protocols the dialog can actually configure", () => {
		for (const preset of identityProviderPresets) {
			expect(preset.protocol).not.toBe("custom");
		}
	});

	it("describes every preset so the selector never renders a blank entry", () => {
		for (const preset of identityProviderPresets) {
			expect(preset.label.trim().length).toBeGreaterThan(0);
			expect(preset.description.trim().length).toBeGreaterThan(0);
		}
	});

	it("groups every preset under a known category, in presentation order", () => {
		const grouped = providerPresetGroups.flatMap((group) =>
			group.presets.map((preset) => preset.id),
		);
		expect(grouped.sort()).toEqual(
			identityProviderPresets.map((preset) => preset.id).sort(),
		);
		expect(
			providerPresetGroups.map((group) => group.category),
		).toEqual(
			providerCategoryOrder.filter((category) =>
				providerPresetGroups.some((group) => group.category === category),
			),
		);
	});
});

describe("presetForProvider", () => {
	it("recognises vendors from the stored issuer", () => {
		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://accounts.google.com",
			}),
		).toBe("google-workspace");

		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://login.microsoftonline.com/tenant-id/v2.0",
			}),
		).toBe("microsoft-entra-id");

		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://acme.okta.com/oauth2/default",
			}),
		).toBe("okta");

		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://sso.example.com/realms/acme",
			}),
		).toBe("keycloak");

		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://acme.eu.auth0.com/",
			}),
		).toBe("auth0");
	});

	it("falls back to the generic entry of the provider's protocol", () => {
		expect(
			presetForProvider({ protocol: "oidc", issuer: "https://idp.example.com" }),
		).toBe("oidc");
		expect(presetForProvider({ protocol: "oidc", issuer: null })).toBe("oidc");
		expect(presetForProvider({ protocol: "saml", issuer: null })).toBe("saml");
		expect(presetForProvider({ protocol: "ldap", issuer: null })).toBe("ldap");
		expect(
			presetForProvider({ protocol: "active-directory", issuer: null }),
		).toBe("active-directory");
	});

	it("does not treat a vendor host as a substring match", () => {
		expect(
			presetForProvider({
				protocol: "oidc",
				issuer: "https://notokta.example.com",
			}),
		).toBe("oidc");
	});
});

describe("findProviderPreset", () => {
	it("returns undefined for an unknown id", () => {
		expect(findProviderPreset("does-not-exist")).toBeUndefined();
	});
});
