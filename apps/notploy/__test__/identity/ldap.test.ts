import { describe, expect, it } from "vitest";
import {
	getIdentityProviderHealth,
	resolveIdentityProviderProtocol,
} from "@notploy/server/services/identity-provider";
import {
	escapeLdapFilter,
	parseLdapConfig,
} from "@notploy/server/utils/identity/ldap";

describe("escapeLdapFilter", () => {
	it("escapes LDAP filter metacharacters (RFC 4515)", () => {
		expect(escapeLdapFilter("a*b(c)d\\e")).toBe("a\\2ab\\28c\\29d\\5ce");
	});

	it("leaves a plain identifier untouched", () => {
		expect(escapeLdapFilter("john.doe")).toBe("john.doe");
	});
});

describe("parseLdapConfig", () => {
	it("parses a stored config and applies schema defaults", () => {
		const config = parseLdapConfig(
			JSON.stringify({ url: "ldap://dir:389", baseDn: "ou=users,dc=x" }),
		);
		expect(config).not.toBeNull();
		expect(config?.directoryType).toBe("ldap");
		expect(config?.emailAttribute).toBe("mail");
		expect(config?.userSearchFilter).toBe("(mail={{username}})");
	});

	it("returns null for invalid JSON", () => {
		expect(parseLdapConfig("not json")).toBeNull();
	});

	it("returns null when required fields are missing", () => {
		expect(parseLdapConfig(JSON.stringify({ url: "ldap://x" }))).toBeNull();
	});
});

describe("resolveIdentityProviderProtocol - directory", () => {
	it("detects the Active Directory flavor", () => {
		expect(
			resolveIdentityProviderProtocol({
				oidcConfig: null,
				samlConfig: null,
				ldapConfig: JSON.stringify({
					directoryType: "active-directory",
					url: "ldaps://dc:636",
					baseDn: "dc=corp,dc=x",
				}),
			}),
		).toBe("active-directory");
	});

	it("defaults to LDAP when the flavor is absent", () => {
		expect(
			resolveIdentityProviderProtocol({
				oidcConfig: null,
				samlConfig: null,
				ldapConfig: JSON.stringify({
					url: "ldap://dir:389",
					baseDn: "dc=x",
				}),
			}),
		).toBe("ldap");
	});
});

describe("getIdentityProviderHealth - LDAP", () => {
	it("reports misconfigured when the stored config cannot be read", async () => {
		const health = await getIdentityProviderHealth({
			providerId: "corp-directory",
			issuer: "ldap://dir:389",
			domain: "x.com",
			oidcConfig: null,
			samlConfig: null,
			ldapConfig: "not json",
		});
		expect(health.protocol).toBe("ldap");
		expect(health.status).toBe("misconfigured");
	});
});
