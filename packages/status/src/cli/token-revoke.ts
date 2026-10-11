/**
 * `pnpm token:revoke -- --id tok_xxxxxxxx`
 *
 * Revocation is immediate: every subsequent request presenting the matching
 * bearer value is rejected.
 */
import { loadConfig } from "../config";
import { createStatusContext } from "../services/context";
import { revokeTokenRecord } from "../services/security";

const args = process.argv.slice(2);
const index = args.indexOf("--id");
const tokenId = index >= 0 ? args[index + 1] : undefined;

if (!tokenId) {
	process.stderr.write("Usage: pnpm token:revoke -- --id tok_xxxxxxxx\n");
	process.exit(1);
}

const config = loadConfig();
const ctx = createStatusContext({ config });
try {
	const revoked = revokeTokenRecord(ctx, tokenId, {
		type: "system",
		id: null,
		label: "cli:token-revoke",
	});
	process.stdout.write(`Token ${revoked.id} revoked.\n`);
} finally {
	ctx.db.close();
}
