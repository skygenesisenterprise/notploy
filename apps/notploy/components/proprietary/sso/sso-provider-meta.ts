/**
 * Presentation metadata for Identity & Access providers.
 *
 * Kept local (like the DNS provider meta) so the Console does not import the
 * server identity module into the client bundle. The protocol of a stored
 * provider is derived from which configuration it carries.
 */

export type ProviderProtocol =
	| "oidc"
	| "saml"
	| "ldap"
	| "active-directory"
	| "custom";

export const providerProtocolLabels: Record<ProviderProtocol, string> = {
	oidc: "OIDC",
	saml: "SAML 2.0",
	ldap: "LDAP",
	"active-directory": "Active Directory",
	custom: "Custom",
};

export const providerCategoryLabels: Record<string, string> = {
	federated: "Federated identity",
	directory: "Directory services",
	custom: "Custom",
};

export const identityCapabilityLabels: Record<string, string> = {
	singleSignOn: "Single sign-on",
	singleLogout: "Single logout",
	refreshTokens: "Refresh tokens",
	pkce: "PKCE",
	userProvisioning: "User provisioning",
	groupSync: "Group sync",
	roleMapping: "Role mapping",
	directorySearch: "Directory search",
	jitProvisioning: "JIT provisioning",
	certificateRotation: "Certificate rotation",
	connectionDiagnostics: "Connection diagnostics",
};

export const identityCapabilityOrder = [
	"singleSignOn",
	"singleLogout",
	"refreshTokens",
	"pkce",
	"userProvisioning",
	"groupSync",
	"roleMapping",
	"directorySearch",
	"jitProvisioning",
	"certificateRotation",
	"connectionDiagnostics",
] as const;

export const identityHealthLabels: Record<string, string> = {
	connected: "Connected",
	degraded: "Degraded",
	unreachable: "Unreachable",
	misconfigured: "Misconfigured",
	authenticationExpired: "Authentication expired",
};

export const protocolLabel = (protocol: string) =>
	providerProtocolLabels[protocol as ProviderProtocol] ?? protocol;

export const capabilityLabel = (capability: string) =>
	identityCapabilityLabels[capability] ?? capability;

/**
 * Which protocol a provider is configured with. A stored provider carries at
 * most one of `oidcConfig` / `samlConfig`; anything else is a custom provider.
 */
export const resolveProviderProtocol = (provider: {
	oidcConfig: string | null;
	samlConfig: string | null;
}): ProviderProtocol => {
	if (provider.samlConfig) return "saml";
	if (provider.oidcConfig) return "oidc";
	return "custom";
};
