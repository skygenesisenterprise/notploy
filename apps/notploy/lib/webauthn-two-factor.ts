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

/** The factor the account must present after its password. */
export type TwoFactorMethod = "totp" | "securityKey";

/**
 * `method` is `null` on accounts that never picked one: legacy TOTP accounts
 * and accounts whose two-factor is disabled. Both factors stay usable there.
 */
export interface TwoFactorMethodSummary {
	method: TwoFactorMethod | null;
	hasSecurityKey: boolean;
	hasTotp: boolean;
	backupCodesRemaining: number;
}

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

/**
 * Stores the credential created by the browser's registration prompt.
 *
 * Registering the first key also makes it the account's second factor, so the
 * response carries `twoFactorEnabled` and the one-time `backupCodes` to show.
 */
export const registerSecurityKey = async (
	response: RegistrationResponseJSON,
	name?: string,
): Promise<{
	securityKey: (SecurityKey & { twoFactorEnabled?: boolean }) | null;
	backupCodes: string[];
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/keys/register",
		{
			method: "POST",
			body: { response, name },
		},
	);

	const payload =
		(data as (SecurityKey & { backupCodes?: string[] }) | null) ?? null;
	return {
		securityKey: payload,
		backupCodes: payload?.backupCodes ?? [],
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

/** Reads the account's chosen second factor and what is enrolled. */
export const getTwoFactorMethod = async (): Promise<{
	summary: TwoFactorMethodSummary | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/method", {
		method: "GET",
	});

	return {
		summary: (data as TwoFactorMethodSummary | null) ?? null,
		error: asError(error),
	};
};

/**
 * Makes the security key (or authenticator codes) the account's second factor.
 * `TOTP_SETUP_REQUIRED` means the account must finish the OTP setup first.
 */
export const setTwoFactorMethod = async (
	method: TwoFactorMethod,
): Promise<{
	method: TwoFactorMethod | null;
	backupCodes: string[];
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/method", {
		method: "POST",
		body: { method },
	});

	const payload =
		(data as { method?: TwoFactorMethod; backupCodes?: string[] } | null) ??
		null;
	return {
		method: payload?.method ?? null,
		backupCodes: payload?.backupCodes ?? [],
		error: asError(error),
	};
};

export const countSecurityKeyBackupCodes = async (): Promise<{
	remaining: number | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/backup-codes",
		{ method: "GET" },
	);

	return {
		remaining: (data as { remaining?: number } | null)?.remaining ?? null,
		error: asError(error),
	};
};

/** Replaces the whole set: the previous codes stop working immediately. */
export const generateSecurityKeyBackupCodes = async (): Promise<{
	backupCodes: string[];
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/backup-codes",
		{ method: "POST" },
	);

	return {
		backupCodes: (data as { backupCodes?: string[] } | null)?.backupCodes ?? [],
		error: asError(error),
	};
};

/** Completes the pending two-factor step with a one-time recovery code. */
export const verifySecurityKeyBackupCode = async (
	code: string,
): Promise<{ token: string | null; error: AuthFetchError | null }> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/backup-codes/verify",
		{ method: "POST", body: { code } },
	);

	return {
		token: (data as { token?: string } | null)?.token ?? null,
		error: asError(error),
	};
};

export const removeSecurityKey = async (id: string) => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/keys/delete", {
		method: "POST",
		body: { id },
	});

	return {
		success: (data as { success?: boolean } | null)?.success ?? false,
		error: asError(error),
	};
};

/** Pending password step waiting for a phone to approve the QR code. */
export interface SecurityKeyQrLoginRequest {
	requestId: string;
	/** Absolute `/approve/<id>` URL encoded in the QR code. */
	url: string;
	expiresAt: string;
}

export type SecurityKeyQrLoginStatus = "pending" | "approved" | "expired";

/** Starts a QR approval for the pending two-factor step. */
export const startSecurityKeyQrLogin = async (): Promise<{
	request: SecurityKeyQrLoginRequest | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch("/webauthn-2fa/qr", {
		method: "POST",
	});

	return {
		request: (data as SecurityKeyQrLoginRequest | null) ?? null,
		error: asError(error),
	};
};

/**
 * Polls the request. When the phone approved it, the response also sets the
 * session cookie and returns its token.
 */
export const getSecurityKeyQrLoginStatus = async (
	requestId: string,
): Promise<{
	status: SecurityKeyQrLoginStatus | null;
	token: string | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/qr/status",
		{ method: "POST", body: { requestId } },
	);

	const payload = (data as
		| { status?: SecurityKeyQrLoginStatus; token?: string }
		| null) ?? null;
	return {
		status: payload?.status ?? null,
		token: payload?.token ?? null,
		error: asError(error),
	};
};

/** Called on the phone, from a session of the same account. */
export const approveSecurityKeyQrLogin = async (
	requestId: string,
): Promise<{
	status: SecurityKeyQrLoginStatus | null;
	error: AuthFetchError | null;
}> => {
	const { data, error } = await authClient.$fetch(
		"/webauthn-2fa/qr/approve",
		{ method: "POST", body: { requestId } },
	);

	return {
		status: (data as { status?: SecurityKeyQrLoginStatus } | null)?.status ?? null,
		error: asError(error),
	};
};

export const isCeremonyCancellation = (error: unknown) =>
	error instanceof Error &&
	(error.name === "NotAllowedError" ||
		error.name === "AbortError" ||
		error.message.toLowerCase().includes("cancel"));
