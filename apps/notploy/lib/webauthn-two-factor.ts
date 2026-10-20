import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { authClient } from "@/lib/auth-client";

interface AuthFetchError {
	code?: string;
	message?: string;
	status?: number;
}

/** Safe projection returned by the security-key endpoints. */
export interface SecurityKey {
	id: string;
	name: string | null;
	deviceType: string;
	backedUp: boolean;
	createdAt: string | null;
	aaguid: string | null;
}

export type WebAuthnTwoFactorOptions = PublicKeyCredentialRequestOptionsJSON;
export type SecurityKeyRegistrationOptions =
	PublicKeyCredentialCreationOptionsJSON;

const asError = (error: unknown) => (error as AuthFetchError | null) ?? null;

/**
 * Requests a WebAuthn challenge for the pending two-factor sign-in. The server
 * answers 400/`NO_SECURITY_KEY` when the account has no registered key.
 */
export const requestWebAuthnTwoFactorOptions = async (): Promise<{
	options: WebAuthnTwoFactorOptions | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/generate-options",
		{ method: "POST" },
	);

	return {
		options: (data as WebAuthnTwoFactorOptions | null) ?? null,
		error: asError(error),
	};
};

/** Completes the second factor with the assertion produced by the browser. */
export const verifyWebAuthnTwoFactor = async (
	response: AuthenticationResponseJSON,
): Promise<{ token: string | null; error: AuthFetchError | null }> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/verify", {
		method: "POST",
		body: { response },
	});

	const token = (data as { token?: string } | null)?.token ?? null;
	return { token, error: asError(error) };
};

/** Starts the registration ceremony for a new security key. */
export const requestSecurityKeyRegistrationOptions = async (): Promise<{
	options: SecurityKeyRegistrationOptions | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/keys/options",
		{ method: "POST" },
	);

	return {
		options: (data as SecurityKeyRegistrationOptions | null) ?? null,
		error: asError(error),
	};
};

/** Stores the credential created by the browser's registration prompt. */
export const registerSecurityKey = async (
	response: RegistrationResponseJSON,
	name?: string,
): Promise<{ securityKey: SecurityKey | null; error: AuthFetchError | null }> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/keys/register", {
		method: "POST",
		body: { response, name },
	});

	return {
		securityKey: (data as SecurityKey | null) ?? null,
		error: asError(error),
	};
};

export const listSecurityKeys = async (): Promise<{
	securityKeys: SecurityKey[];
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/keys", {
		method: "GET",
	});

	return {
		securityKeys: (data as SecurityKey[] | null) ?? [],
		error: asError(error),
	};
};

export const removeSecurityKey = async (id: string) => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/keys/delete",
		{ method: "POST", body: { id } },
	);

	return {
		success: (data as { success?: boolean } | null)?.success ?? false,
		error: asError(error),
	};
};

export const isCeremonyCancellation = (error: unknown) =>
	error instanceof Error &&
	(error.name === "NotAllowedError" ||
		error.name === "AbortError" ||
		error.message.toLowerCase().includes("cancel"));
