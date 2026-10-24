import { findOwner } from "@notploy/server";
import { db } from "@notploy/server/db";
import {
	securityKey,
	securityKeyBackupCode,
	securityKeyLoginRequest,
	twoFactor,
	user,
} from "@notploy/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Removes every two-factor artifact of the owner and turns 2FA off, so the
 * account is back to a clean base and the factors can be enrolled again:
 *
 *   - the TOTP record (secret + better-auth backup codes);
 *   - the registered security keys and their recovery codes;
 *   - pending QR approval requests;
 *   - `twoFactorEnabled` / `twoFactorMethod` on the user.
 */
(async () => {
	try {
		const owner = await findOwner();

		await db.transaction(async (tx) => {
			await tx.delete(twoFactor).where(eq(twoFactor.userId, owner.userId));
			await tx
				.delete(securityKeyBackupCode)
				.where(eq(securityKeyBackupCode.userId, owner.userId));
			await tx
				.delete(securityKeyLoginRequest)
				.where(eq(securityKeyLoginRequest.userId, owner.userId));
			await tx.delete(securityKey).where(eq(securityKey.userId, owner.userId));
			await tx
				.update(user)
				.set({ twoFactorEnabled: false, twoFactorMethod: null })
				.where(eq(user.id, owner.userId));
		});

		console.log(
			"2FA reset successful: TOTP record, security keys, recovery codes and QR requests removed",
		);
		process.exit(0);
	} catch (error) {
		console.error("Error resetting 2FA", error);
		process.exit(1);
	}
})();
