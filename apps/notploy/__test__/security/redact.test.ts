import { redactBackupError } from "@notploy/server/utils/backups/redact";
import { ExecError } from "@notploy/server/utils/process/ExecError";
import {
	createRedactingLineBuffer,
	redactObject,
	redactSecrets,
	redactSecretValues,
	safeErrorMessage,
} from "@notploy/server/utils/security/redact";
import { describe, expect, it } from "vitest";

const SENTINELS = {
	accessKey: "AKIAIOSFODNN7EXAMPLE",
	secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
	password: "S3ntinel-Passw0rd!",
	token: "ghp_1234567890abcdefghijklmnopqrstuvwx",
	jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZW50aW5lbCJ9.c2lnbmF0dXJlLXNlbnRpbmVs",
	privateKey:
		"-----BEGIN OPENSSH PRIVATE KEY-----\nSENTINELSSHKEYMATERIAL\n-----END OPENSSH PRIVATE KEY-----",
	yamlSecret: "Yaml Sentinel With Spaces!",
};

const ALL_SECRETS = [
	SENTINELS.accessKey,
	SENTINELS.secretKey,
	SENTINELS.password,
	SENTINELS.token,
	SENTINELS.jwt,
	"SENTINELSSHKEYMATERIAL",
	SENTINELS.yamlSecret,
];

const expectNoSecret = (output: string) => {
	for (const secret of ALL_SECRETS) {
		expect(output).not.toContain(secret);
	}
};

describe("redactSecrets", () => {
	it("redacts rclone/S3 credentials while keeping the command shape", () => {
		const command = `rclone rcat --s3-provider=AWS --s3-access-key-id="${SENTINELS.accessKey}" --s3-secret-access-key="${SENTINELS.secretKey}" :s3:bucket/file.sql.gz`;

		const output = redactSecrets(command);

		expectNoSecret(output);
		expect(output).toContain("rclone rcat");
		expect(output).toContain("--s3-provider=AWS");
		expect(output).toContain(":s3:bucket/file.sql.gz");
	});

	it("redacts environment-style and JSON key/value pairs", () => {
		const text = [
			`DATABASE_PASSWORD=${SENTINELS.password}`,
			`AWS_SECRET_ACCESS_KEY=${SENTINELS.secretKey}`,
			`"apiKey": "${SENTINELS.password}"`,
			`token: ${SENTINELS.token}`,
		].join("\n");

		const output = redactSecrets(text);

		expectNoSecret(output);
		expect(output).toContain("DATABASE_PASSWORD=");
		expect(output).toContain("AWS_SECRET_ACCESS_KEY=");
	});

	it("redacts authorization headers regardless of the scheme", () => {
		const text = [
			`Authorization: ApiKey ${SENTINELS.password}`,
			`Proxy-Authorization: SSWS ${SENTINELS.token}`,
		].join("\n");

		const output = redactSecrets(text);

		expectNoSecret(output);
		expect(output).toContain("Authorization: ");
	});

	it("redacts unquoted YAML values that contain spaces", () => {
		const output = redactSecrets(
			`password: ${SENTINELS.yamlSecret}\napiKey: ${SENTINELS.secretKey}\nregion: eu-west-1`,
		);

		expectNoSecret(output);
		expect(output).toContain("region: eu-west-1");
	});

	it("redacts URL credentials, auth headers, JWTs and provider tokens", () => {
		const text = [
			`postgres://app:${SENTINELS.password}@db.internal:5432/app`,
			`Authorization: Bearer ${SENTINELS.jwt}`,
			`clone token ${SENTINELS.token}`,
		].join("\n");

		const output = redactSecrets(text);

		expectNoSecret(output);
		expect(output).toContain("postgres://app:");
		expect(output).toContain("@db.internal:5432/app");
	});

	it("redacts PEM private key blocks", () => {
		const output = redactSecrets(
			`ssh key:\n${SENTINELS.privateKey}\ndone`,
		);
		expectNoSecret(output);
		expect(output).toContain("ssh key:");
		expect(output).toContain("done");
	});

	it("keeps non-sensitive diagnostics intact", () => {
		const output = redactSecrets(
			"Error: access denied for user app (exit code 1) on host db.internal",
		);
		expect(output).toBe(
			"Error: access denied for user app (exit code 1) on host db.internal",
		);
	});

	it("redacts exact runtime values even outside a key context", () => {
		const output = redactSecretValues(
			`upload failed with ${SENTINELS.secretKey}`,
			[SENTINELS.secretKey],
		);
		expect(output).not.toContain(SENTINELS.secretKey);
	});
});

describe("redactObject", () => {
	it("redacts nested credentials without mutating the source object", () => {
		const source = {
			destination: {
				accessKey: SENTINELS.accessKey,
				secretAccessKey: SENTINELS.secretKey,
				region: "eu-west-1",
			},
			command: `rclone --s3-secret-access-key="${SENTINELS.secretKey}" lsf :s3:bucket`,
			statusCode: 403,
		};

		const output = redactObject(source);

		expect(JSON.stringify(output)).not.toContain(SENTINELS.accessKey);
		expect(JSON.stringify(output)).not.toContain(SENTINELS.secretKey);
		expect(output.destination.region).toBe("eu-west-1");
		expect(output.statusCode).toBe(403);
		expect(source.destination.secretAccessKey).toBe(SENTINELS.secretKey);
	});
});

describe("redactBackupError", () => {
	it("masks destination keys even when the provider echoes only the value", () => {
		const message = `upload failed: value ${SENTINELS.accessKey} was rejected`;
		const output = redactBackupError(new Error(message), {
			accessKey: SENTINELS.accessKey,
			secretAccessKey: SENTINELS.secretKey,
		});
		expect(output).not.toContain(SENTINELS.accessKey);
		expect(output).toContain("upload failed");
	});
});

describe("ExecError", () => {
	it("never exposes command credentials in message or fields", () => {
		const error = new ExecError(
			`Command failed: rclone rcat --s3-secret-access-key="${SENTINELS.secretKey}" :s3:bucket`,
			{
				command: `rclone rcat --s3-secret-access-key="${SENTINELS.secretKey}" :s3:bucket`,
				stderr: `invalid credential --s3-secret-access-key="${SENTINELS.secretKey}"`,
				exitCode: 1,
			},
		);

		expect(error.message).not.toContain(SENTINELS.secretKey);
		expect(error.command).not.toContain(SENTINELS.secretKey);
		expect(error.stderr).not.toContain(SENTINELS.secretKey);
		expect(error.getDetailedMessage()).not.toContain(SENTINELS.secretKey);
	});
});

describe("safeErrorMessage", () => {
	it("redacts unknown thrown values", () => {
		expect(safeErrorMessage(`boom ${SENTINELS.token}`)).not.toContain(
			SENTINELS.token,
		);
		expect(
			safeErrorMessage(new Error(`boom password=${SENTINELS.password}`)),
		).not.toContain(SENTINELS.password);
	});
});

describe("createRedactingLineBuffer", () => {
	it("redacts a secret split across two chunks", () => {
		const buffer = createRedactingLineBuffer();
		expect(buffer.push("password=abc")).toBe("");
		expect(buffer.push("def\nnext line\n")).not.toContain("abcdef");
		expect(buffer.flush()).toBe("");
	});

	it("does not leak a private key split across several chunks", () => {
		const buffer = createRedactingLineBuffer();
		const begin = buffer.push("ssh key:\n-----BEGIN OPENSSH PRIVATE KEY-----\n");
		const middle = buffer.push("SENTINELSSHKEYMATERIAL\n");
		const end = buffer.push("-----END OPENSSH PRIVATE KEY-----\nnext line\n");

		expect(`${begin}${middle}${end}`).not.toContain("SENTINELSSHKEYMATERIAL");
		expect(`${begin}${middle}${end}`).toContain("next line");
		expect(buffer.flush()).toBe("");
	});

	it("redacts several consecutive secrets split across chunks", () => {
		const buffer = createRedactingLineBuffer();
		const first = buffer.push(`password=${SENTINELS.password.slice(0, 6)}`);
		const second = buffer.push(
			`${SENTINELS.password.slice(6)} token=${SENTINELS.token.slice(0, 4)}\n`,
		);
		const third = buffer.push(`${SENTINELS.token.slice(4)}\n`);
		const output = `${first}${second}${third}`;

		expect(output).not.toContain(SENTINELS.password);
		expect(output).not.toContain(SENTINELS.token);
	});

	it("flushes a trailing partial line on close", () => {
		const buffer = createRedactingLineBuffer();
		expect(buffer.push(`token=${SENTINELS.token}`)).toBe("");
		const remaining = buffer.flush();
		expect(remaining).not.toContain(SENTINELS.token);
		expect(remaining).toContain("token=");
	});
});
