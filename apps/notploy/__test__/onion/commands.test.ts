import { parse, quote } from "shell-quote";
import { getOnionServicePaths } from "@notploy/server/utils/onion/config";
import {
	assertDockerNetworkName,
	getInspectOnionNetworkCommand,
	getInspectOnionServiceStatusCommand,
	getProvisionOnionServiceCommand,
	getReadOnionHostnameCommand,
	getRemoveOnionStorageCommand,
	getRestartOnionServiceCommand,
	getStartOnionServiceCommand,
	getStopOnionServiceCommand,
} from "@notploy/server/utils/onion/commands";
import { describe, expect, it } from "vitest";

const paths = getOnionServicePaths("abc123");
/** Values are interpolated through `quote()`, so simple values stay bare. */
const q = (value: string) => quote([value]);

const startCommand = (
	overrides: Partial<Parameters<typeof getStartOnionServiceCommand>[0]> = {},
) =>
	getStartOnionServiceCommand({
		paths,
		bindSources: { dataDir: paths.dataDir, torrcPath: paths.torrcPath },
		image: "docker.io/dockurr/tor:latest",
		network: "myapp_default",
		onionServiceId: "abc123",
		composeId: "compose1",
		...overrides,
	});

/**
 * shell-quote reports operators (and glob patterns) as objects; a safe command
 * never gains one. Non-operator tokens are stringified so an unexpected glob or
 * comment shows up as a difference instead of being skipped.
 */
const operatorsOf = (command: string) =>
	parse(command).flatMap((token) =>
		typeof token === "string"
			? []
			: ["op" in token ? token.op : JSON.stringify(token)],
	);

describe("getStartOnionServiceCommand", () => {
	it("runs a replaceable container on the project network", () => {
		const command = startCommand();

		expect(command).toContain(`docker rm -f ${q(paths.containerName)}`);
		expect(command).toContain("docker run -d");
		expect(command).toContain(`--name ${q(paths.containerName)}`);
		expect(command).toContain("--restart unless-stopped");
		expect(command).toContain(`--network ${q("myapp_default")}`);
		expect(command).toContain(q("docker.io/dockurr/tor:latest"));
	});

	it("mounts the protected storage and the generated torrc", () => {
		const command = startCommand();

		expect(command).toContain(
			`-v ${q(`${paths.dataDir}:${paths.containerDataDir}`)}`,
		);
		expect(command).toContain(
			`-v ${q(`${paths.torrcPath}:${paths.containerConfigPath}`)}`,
		);
		// A read-only mount defeats the image's chown of /etc/tor, which leaves
		// the torrc unreadable by the unprivileged tor user.
		expect(command).not.toContain(`${paths.containerConfigPath}:ro`);
	});

	it("mounts the daemon-visible source of the storage", () => {
		// The daemon resolves a bind source on its own filesystem: when Notploy
		// keeps its configuration in a volume, the path it sees is not the one
		// the daemon would find.
		const command = startCommand({
			bindSources: {
				dataDir: "/var/lib/docker/volumes/notploy-config/_data/onion/abc123/data",
				torrcPath:
					"/var/lib/docker/volumes/notploy-config/_data/onion/abc123/torrc",
			},
		});

		expect(command).toContain(
			`-v ${q(
				`/var/lib/docker/volumes/notploy-config/_data/onion/abc123/data:${paths.containerDataDir}`,
			)}`,
		);
		expect(command).toContain(
			`-v ${q(
				`/var/lib/docker/volumes/notploy-config/_data/onion/abc123/torrc:${paths.containerConfigPath}`,
			)}`,
		);
		expect(command).not.toContain(`${paths.torrcPath}:`);
	});

	it("never publishes the target service on a host port", () => {
		const command = startCommand();

		expect(command).not.toContain(" -p ");
		expect(command).not.toContain("--publish");
		expect(operatorsOf(command).filter((op) => op === "&&")).toHaveLength(0);
	});

	it("labels the container so the runtime is traceable", () => {
		const command = startCommand();

		expect(command).toContain(q("notploy.onionServiceId=abc123"));
		expect(command).toContain(q("notploy.composeId=compose1"));
	});

	it("drops the image healthcheck that expects a control port", () => {
		// The generated torrc disables the control port, so the image's
		// healthcheck could only ever report a false failure.
		expect(startCommand()).toContain("--no-healthcheck");
	});

	it("quotes interpolated values instead of trusting them", () => {
		const command = startCommand({ onionServiceId: "x; rm -rf /tmp/onion" });

		// The payload stays a single argument: it is quoted, and the parsed
		// command gains no operator at all.
		expect(command).toContain(
			`--label ${q("notploy.onionServiceId=x; rm -rf /tmp/onion")}`,
		);
		expect(operatorsOf(command)).toEqual(operatorsOf(startCommand()));
	});

	it("refuses an injected image or network", () => {
		expect(() => startCommand({ image: "tor; rm -rf /" })).toThrow();
		expect(() => startCommand({ network: "net; rm -rf /" })).toThrow();
		expect(() => assertDockerNetworkName("$(id)")).toThrow();
		expect(assertDockerNetworkName(" myapp_default ")).toBe("myapp_default");
	});
});

describe("getProvisionOnionServiceCommand", () => {
	it("creates the protected storage and writes the torrc", () => {
		const command = getProvisionOnionServiceCommand({
			paths,
			torrc: "HiddenServicePort 80 web:3000\n",
		});

		expect(command).toContain("set -e;");
		expect(command).toContain(
			`install -d -m 0700 ${q(paths.root)} ${q(paths.dataDir)} ${q(paths.hiddenServiceDir)}`,
		);
		expect(command).toContain(`chmod 600 ${q(paths.torrcPath)}`);
		// No key material unless a new identity is written on purpose.
		expect(command).not.toContain(paths.secretKeyPath);
	});

	it("writes the identity as base64 with restrictive permissions", () => {
		const command = getProvisionOnionServiceCommand({
			paths,
			torrc: "HiddenServicePort 80 web:3000\n",
			files: {
				secretKey: Buffer.from("secret-bytes"),
				publicKey: Buffer.from("public-bytes"),
				hostname: Buffer.from("abc.onion\n"),
			},
		});

		expect(command).toContain("base64 -d");
		for (const file of [
			paths.secretKeyPath,
			paths.publicKeyPath,
			paths.hostnamePath,
		]) {
			expect(command).toContain(`chmod 600 ${q(file)}`);
		}

		const writes = command
			.split("\n")
			.filter((line) => line.includes("base64 -d"))
			.map((line) => {
				const match = line.match(/printf '%s' (?:'([^']+)'|(\S+))/);
				const payload = match?.[1] ?? match?.[2];
				if (!payload) {
					throw new Error(`Unexpected write command: ${line}`);
				}
				return Buffer.from(payload, "base64").toString();
			});

		expect(writes).toEqual([
			"HiddenServicePort 80 web:3000\n",
			"secret-bytes",
			"public-bytes",
			"abc.onion\n",
		]);
	});
});

describe("lifecycle commands", () => {
	it("tolerates stopping or removing a runtime that is already gone", () => {
		expect(getStopOnionServiceCommand(paths)).toContain("|| true");
		expect(getInspectOnionServiceStatusCommand(paths)).toContain(
			"|| echo missing",
		);
		expect(getRestartOnionServiceCommand(paths)).toBe(
			`docker restart ${q(paths.containerName)}`,
		);
	});

	it("reports the network and the published address", () => {
		expect(getInspectOnionNetworkCommand("myapp_default")).toContain(
			`docker network inspect -f '{{.Name}}' ${q("myapp_default")}`,
		);
		expect(getReadOnionHostnameCommand(paths)).toContain(
			`docker exec ${q(paths.containerName)} cat ${q(
				`${paths.containerHiddenServiceDir}/hostname`,
			)}`,
		);
	});
});

describe("getRemoveOnionStorageCommand", () => {
	it("keeps the identity by default", () => {
		const command = getRemoveOnionStorageCommand(paths, {
			deleteIdentity: false,
		});

		expect(command).toBe(`rm -f ${q(paths.torrcPath)}`);
		expect(command).not.toContain("rm -rf");
	});

	it("removes the whole protected storage on request", () => {
		expect(getRemoveOnionStorageCommand(paths, { deleteIdentity: true })).toBe(
			`rm -rf ${q(paths.root)}`,
		);
	});
});
