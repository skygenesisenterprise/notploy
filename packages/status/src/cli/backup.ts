/**
 * `pnpm backup`            create a consistent backup of the status database
 * `pnpm backup -- --list`  list existing backups (newest first)
 *
 * Restore is manual on purpose (see README.md): stop the application, replace
 * `<dataDir>/status.db` with the backup file, restart.
 */
import { loadConfig } from "../config";
import { createBackup, listBackups } from "../operations/backup";

const config = loadConfig();
const args = process.argv.slice(2);

if (args.includes("--list")) {
	const names = listBackups(config);
	if (names.length === 0) {
		process.stdout.write(`No backups in ${config.backupDir}\n`);
	} else {
		process.stdout.write(`${names.join("\n")}\n`);
	}
	process.exit(0);
}

const result = createBackup(config);
process.stdout.write(
	`Backup created: ${result.file} (${result.bytes} bytes)\n` +
		`Retention keeps the last ${config.backupRetention} backups.\n`,
);
