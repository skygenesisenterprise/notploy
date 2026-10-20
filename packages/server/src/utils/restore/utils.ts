import { quote } from "shell-quote";
import {
	getComposeContainerCommand,
	getServiceContainerCommand,
} from "../backups/utils";

// Same constraint as backups: no shell is required inside the database image.
// Values are escaped for the outer shell and passed as structured argv.
export const getPostgresRestoreCommand = (
	database: string,
	databaseUser: string,
) => {
	return `docker exec -i $CONTAINER_ID pg_restore -U ${quote([databaseUser])} -d ${quote([database])} -O --clean --if-exists`;
};

export const getMariadbRestoreCommand = (
	database: string,
	databaseUser: string,
	databasePassword: string,
) => {
	return `docker exec -e MYSQL_PWD=${quote([databasePassword])} -i $CONTAINER_ID mariadb -u ${quote([databaseUser])} ${quote([database])}`;
};

export const getMysqlRestoreCommand = (
	database: string,
	databasePassword: string,
) => {
	return `docker exec -e MYSQL_PWD=${quote([databasePassword])} -i $CONTAINER_ID mysql -u root ${quote([database])}`;
};

export const getMongoRestoreCommand = (
	database: string,
	databaseUser: string,
	databasePassword: string,
) => {
	return `docker exec -i $CONTAINER_ID mongorestore --username ${quote([databaseUser])} --password ${quote([databasePassword])} --authenticationDatabase admin --db ${quote([database])} --archive --drop`;
};

export const getComposeSearchCommand = (
	appName: string,
	type: "stack" | "docker-compose" | "database",
	serviceName?: string,
) => {
	if (type === "database") {
		return getServiceContainerCommand(appName || "");
	}
	return getComposeContainerCommand(appName || "", serviceName || "", type);
};

interface DatabaseCredentials {
	database: string;
	databaseUser?: string;
	databasePassword?: string;
}

const generateRestoreCommand = (
	type: "postgres" | "mariadb" | "mysql" | "mongo",
	credentials: DatabaseCredentials,
) => {
	const { database, databaseUser, databasePassword } = credentials;
	switch (type) {
		case "postgres":
			return getPostgresRestoreCommand(database, databaseUser || "");
		case "mariadb":
			return getMariadbRestoreCommand(
				database,
				databaseUser || "",
				databasePassword || "",
			);
		case "mysql":
			return getMysqlRestoreCommand(database, databasePassword || "");
		case "mongo":
			return getMongoRestoreCommand(
				database,
				databaseUser || "",
				databasePassword || "",
			);
	}
};

// Dumps taken with `--databases` carry `USE`/`CREATE DATABASE` statements that
// would redirect the restore away from the database selected in the dialog.
export const stripDatabaseSwitchCommand = `grep -viE '^[[:space:]]*(use|create[[:space:]]+database)[[:space:]]'`;

const getMongoSpecificCommand = (
	rcloneCommand: string,
	restoreCommand: string,
	backupFile: string,
): string => {
	const tempDir = "/tmp/notploy-restore";
	const fileName = backupFile.split("/").pop() || "backup.sql.gz";
	const decompressedName = fileName.replace(".gz", "");
	return `
rm -rf ${tempDir} && \
mkdir -p ${tempDir} && \
${rcloneCommand} ${tempDir} && \
cd ${tempDir} && \
gunzip -f ${quote([fileName])} && \
${restoreCommand} < ${quote([decompressedName])} && \
rm -rf ${tempDir}
	`;
};

interface RestoreOptions {
	appName: string;
	type: "postgres" | "mariadb" | "mysql" | "mongo";
	restoreType: "stack" | "docker-compose" | "database";
	credentials: DatabaseCredentials;
	serviceName?: string;
	rcloneCommand: string;
	backupFile?: string;
}

export const getRestoreCommand = ({
	appName,
	type,
	restoreType,
	credentials,
	serviceName,
	rcloneCommand,
	backupFile,
}: RestoreOptions) => {
	const containerSearch = getComposeSearchCommand(
		appName,
		restoreType,
		serviceName,
	);
	const restoreCommand = generateRestoreCommand(type, credentials);
	let cmd = `CONTAINER_ID=$(${containerSearch})`;

	if (type === "mysql" || type === "mariadb") {
		cmd += ` && ${rcloneCommand} | ${stripDatabaseSwitchCommand} | ${restoreCommand}`;
	} else if (type !== "mongo") {
		cmd += ` && ${rcloneCommand} | ${restoreCommand}`;
	} else {
		cmd += ` && ${getMongoSpecificCommand(rcloneCommand, restoreCommand, backupFile || "")}`;
	}

	return cmd;
};
