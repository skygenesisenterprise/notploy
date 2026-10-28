import type { BackupSchedule } from "@notploy/server/services/backup";
import { getBackupCommand } from "@notploy/server/utils/backups/utils";
import { describe, expect, it } from "vitest";

const buildBackup = (
	overrides: Partial<BackupSchedule> = {},
): BackupSchedule =>
	({
		backupType: "database",
		databaseType: "postgres",
		database: "app_db",
		appName: "my-postgres",
		prefix: "daily",
		postgres: {
			appName: "my-postgres",
			databaseUser: "app_user",
		},
		...overrides,
	}) as BackupSchedule;

const buildCommand = (backup: BackupSchedule) =>
	getBackupCommand(
		backup,
		['--s3-access-key-id="key"', '--s3-secret-access-key="secret"'],
		":s3:bucket/path.sql.gz",
		"/tmp/backup.log",
	);

describe("getBackupCommand", () => {
	it("dumps with the native tool and compresses on the host", () => {
		const command = buildCommand(buildBackup());

		expect(command).toContain("pg_dump -Fc");
		expect(command).toContain("| gzip | rclone rcat");
		expect(command).not.toMatch(/\b(?:bash|sh)\b\s+-c/);
	});

	it("does not double-compress MongoDB archives", () => {
		const command = buildCommand(
			buildBackup({
				databaseType: "mongo",
				postgres: undefined as never,
				mongo: {
					appName: "my-mongo",
					databaseUser: "app_user",
					databasePassword: "pw",
				} as never,
			}),
		);

		expect(command).toContain("mongodump");
		expect(command).toContain("--gzip");
		expect(command).not.toContain("| gzip | rclone");
	});

	it("uses pipefail and deletes the remote object on failure", () => {
		const command = buildCommand(buildBackup());

		expect(command).toContain("set -eo pipefail");
		expect(command).toContain("rclone deletefile");
		expect(command).toContain("exit 1");
	});
});
