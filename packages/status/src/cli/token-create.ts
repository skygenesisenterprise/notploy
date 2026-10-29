/**
 * `pnpm token:create -- --name "Console" --scopes write,publish,ingest`
 *
 * Bootstrapping requires local access to the data directory (which is the
 * strongest credential this platform knows). The plaintext value is printed
 * exactly once; only its hash is stored.
 */
import { loadConfig } from "../config";
import { createTokenSchema } from "../core/schemas";
import { createStatusContext } from "../services/context";
import { createTokenRecord } from "../services/security";

const args = process.argv.slice(2);
const readFlag = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

const name = readFlag("name");
const scopes = readFlag("scopes")
	?.split(",")
	.map((scope) => scope.trim());

if (!name || !scopes || scopes.length === 0) {
	process.stderr.write(
		'Usage: pnpm token:create -- --name "Console" --scopes write,publish,ingest\n' +
			"Scopes: read, write, publish, ingest, tokens, admin (comma-separated)\n",
	);
	process.exit(1);
}

const input = createTokenSchema.parse({ name, scopes });
const config = loadConfig();
const ctx = createStatusContext({ config });
try {
	const created = createTokenRecord(ctx, input, {
		type: "system",
		id: null,
		label: "cli:token-create",
	});
	process.stdout.write(
		[
			`Token "${created.token.name}" created (${created.token.id}).`,
			`Scopes: ${created.token.scopes.join(", ")}`,
			"",
			"Value (shown once, store it in a secret manager):",
			created.value,
			"",
		].join("\n"),
	);
} finally {
	ctx.db.close();
}
