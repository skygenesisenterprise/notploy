import { execSync } from "node:child_process";
import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs";
import {
	getLibsqlBackupCommand,
	getMariadbBackupCommand,
	getMongoBackupCommand,
	getMysqlBackupCommand,
	getPostgresBackupCommand,
} from "@notploy/server/utils/backups/utils";
import {
	getMariadbRestoreCommand,
	getMongoRestoreCommand,
	getMysqlRestoreCommand,
	getPostgresRestoreCommand,
} from "@notploy/server/utils/restore/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A stub replacing the real `docker` binary. It ignores exec/-i/$CONTAINER_ID,
// exports the -e VAR=val pairs, then runs either the legacy inner `sh -c` script
// or the structured argv directly. Production no longer needs a shell inside
// the container, so both shapes are exercised.
const stub = `/tmp/docker_stub_${process.pid}`;
const MARK = `/tmp/notploy_dbbk_pwned_${process.pid}`;

beforeAll(() => {
	writeFileSync(
		stub,
		`#!/bin/bash
shift # exec
envs=()
while [ "$1" = "-e" ]; do envs+=("$2"); shift 2; done
shift 2 # -i CONTAINER
if [ "$1" = "bash" ] || [ "$1" = "sh" ]; then
  shell="$1"; shift
  shift # -c
  env "\${envs[@]}" "$shell" -c "$1" </dev/null 2>/dev/null || true
else
  env "\${envs[@]}" "$@" </dev/null 2>/dev/null || true
fi
`,
	);
	chmodSync(stub, 0o755);
});

afterAll(() => {
	if (existsSync(stub)) rmSync(stub);
	if (existsSync(MARK)) rmSync(MARK);
});

// Run a builder-produced command with `docker` pointed at the stub; return true
// if no injected command fired.
const runsSafely = (command: string) => {
	if (existsSync(MARK)) rmSync(MARK);
	const withStub = command.replace(/^docker /, `${stub} `);
	try {
		execSync(withStub, {
			shell: "/bin/bash",
			stdio: "ignore",
			env: { ...process.env, CONTAINER_ID: "test" },
		});
	} catch {}
	const fired = existsSync(MARK);
	if (existsSync(MARK)) rmSync(MARK);
	return !fired;
};

// Payloads that try to break out of every quoting style used in the builders.
const p = (mark: string) => [
	`$(touch ${mark})`,
	"`touch " + mark + "`",
	`x'; touch ${mark}; '`,
	`x"; touch ${mark}; echo "`,
	`x; touch ${mark}`,
];

describe("database backup/restore command injection", () => {
	const cases: Array<[string, (v: string) => string]> = [
		["postgres backup (database)", (v) => getPostgresBackupCommand(v, "u")],
		["postgres backup (user)", (v) => getPostgresBackupCommand("db", v)],
		["mariadb backup (password)", (v) => getMariadbBackupCommand("db", "u", v)],
		["mysql backup (database)", (v) => getMysqlBackupCommand(v, "pw")],
		["mongo backup (user)", (v) => getMongoBackupCommand("db", v, "pw")],
		["libsql backup (database)", (v) => getLibsqlBackupCommand(v)],
		["postgres restore (database)", (v) => getPostgresRestoreCommand(v, "u")],
		[
			"mariadb restore (password)",
			(v) => getMariadbRestoreCommand("db", "u", v),
		],
		["mysql restore (database)", (v) => getMysqlRestoreCommand(v, "pw")],
		["mongo restore (user)", (v) => getMongoRestoreCommand("db", v, "pw")],
	];

	for (const [label, build] of cases) {
		it(`${label} is not injectable`, () => {
			for (const payload of p(MARK)) {
				expect(runsSafely(build(payload))).toBe(true);
			}
		});
	}

	it("preserves a legitimate database name as a structured argv entry", () => {
		const cmd = getPostgresBackupCommand("my-db_prod", "app_user");
		expect(cmd).toContain("-U app_user");
		expect(cmd).toContain("pg_dump -Fc --no-acl --no-owner");
		expect(cmd).toContain(" --no-password my-db_prod");
	});

	it("does not require a shell or gzip inside the container", () => {
		const builders = [
			getPostgresBackupCommand("db", "user"),
			getMariadbBackupCommand("db", "user", "pw"),
			getMysqlBackupCommand("db", "pw"),
			getMongoBackupCommand("db", "user", "pw"),
			getLibsqlBackupCommand("db"),
			getPostgresRestoreCommand("db", "user"),
			getMariadbRestoreCommand("db", "user", "pw"),
			getMysqlRestoreCommand("db", "pw"),
			getMongoRestoreCommand("db", "user", "pw"),
		];
		for (const cmd of builders) {
			expect(cmd).not.toMatch(/\b(?:bash|sh)\b\s+-c/);
			expect(cmd).not.toContain("| gzip");
		}
	});
});
