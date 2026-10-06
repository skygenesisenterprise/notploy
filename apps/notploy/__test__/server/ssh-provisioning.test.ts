import { EventEmitter } from "node:events";
import type { Client } from "ssh2";
import { describe, expect, it } from "vitest";
import {
	SshError,
	buildInstallPublicKeyCommand,
	buildRemovePublicKeyCommand,
	categorizeSshErrorLevel,
	computeHostKeyFingerprint,
	connectSsh,
	parsePrivilegeProbe,
	verifyKeyBasedConnection,
} from "@notploy/server/utils/ssh";

interface FakeStream extends EventEmitter {
	stderr: EventEmitter;
	close: () => void;
}

const createFakeStream = (): FakeStream => {
	const stream = new EventEmitter() as FakeStream;
	stream.stderr = new EventEmitter();
	stream.close = () => stream.emit("close", 1);
	return stream;
};

class FakeClient extends EventEmitter {
	connectConfig: Record<string, unknown> | undefined;
	ended = false;
	connectCalls = 0;
	/** Overridable exec behaviour used by the tests. */
	execHandler?: (
		command: string,
		callback: (error: Error | undefined, stream: FakeStream) => void,
	) => void;

	connect(config: Record<string, unknown>) {
		this.connectCalls += 1;
		this.connectConfig = config;
		const hostVerifier = config.hostVerifier as
			| ((key: Buffer) => boolean)
			| undefined;
		hostVerifier?.(Buffer.from("fake-host-key-material"));
		queueMicrotask(() => this.emit("ready"));
		return this;
	}

	exec(
		command: string,
		callback: (error: Error | undefined, stream: FakeStream) => void,
	) {
		this.execHandler?.(command, callback);
		return this;
	}

	end() {
		this.ended = true;
		return this;
	}
}

const asClient = (client: FakeClient) => client as unknown as Client;

const passwordAuth = { method: "password" as const, password: "hunter2" };
const baseTarget = { host: "10.0.0.5", port: 22, username: "root" };

describe("SSH failure categorization", () => {
	it("maps ssh2 levels to actionable categories", () => {
		expect(categorizeSshErrorLevel("client-dns")).toBe("network");
		expect(categorizeSshErrorLevel("client-socket")).toBe("network");
		expect(categorizeSshErrorLevel("client-timeout")).toBe("timeout");
		expect(categorizeSshErrorLevel("client-authentication")).toBe(
			"authentication",
		);
		expect(categorizeSshErrorLevel("client-keyboard-interactive")).toBe(
			"authentication",
		);
		expect(categorizeSshErrorLevel("whatever")).toBe("unknown");
	});

	it("never includes secrets in the safe diagnostics payload", () => {
		const error = new SshError({
			category: "authentication",
			host: "10.0.0.5",
			port: 22,
			username: "root",
			cause: new Error("password hunter2 rejected"),
		});
		const payload = error.toSafeJSON();
		expect(JSON.stringify(payload)).not.toContain("hunter2");
		expect(payload.category).toBe("authentication");
	});
});

describe("host key fingerprint", () => {
	it("is deterministic and OpenSSH formatted", () => {
		const key = Buffer.from("host-key-material");
		const first = computeHostKeyFingerprint(key);
		const second = computeHostKeyFingerprint(Buffer.from("host-key-material"));
		expect(first).toEqual(second);
		expect(first.sha256.startsWith("SHA256:")).toBe(true);
		expect(first.md5.startsWith("MD5:")).toBe(true);
		expect(first.sha256).not.toContain("=");
	});
});

describe("privilege probe parsing", () => {
	it("parses root, sudo and none modes with the home directory", () => {
		expect(parsePrivilegeProbe("root:/root\n")).toEqual({
			mode: "root",
			home: "/root",
		});
		expect(parsePrivilegeProbe("sudo:/home/deploy\n")).toEqual({
			mode: "sudo",
			home: "/home/deploy",
		});
		expect(parsePrivilegeProbe("none:/home/deploy\n")).toEqual({
			mode: "none",
			home: "/home/deploy",
		});
	});

	it("rejects unexpected probe output", () => {
		expect(() => parsePrivilegeProbe("garbage")).toThrow(SshError);
	});
});

describe("authorized_keys command builders", () => {
	const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 test notploy";

	it("installs idempotently without leaking the raw key", () => {
		const command = buildInstallPublicKeyCommand({
			publicKey,
			home: "/home/deploy",
			sudo: false,
		});
		// Uses grep -qxF to avoid duplicate lines (idempotent).
		expect(command).toContain("grep -qxF");
		expect(command).toContain('chmod 700 "$SSH_DIR"');
		expect(command).toContain('chmod 600 "$AUTH_KEYS"');
		// The key is base64-encoded, never inlined verbatim.
		expect(command).not.toContain(publicKey);
		expect(command).toContain(Buffer.from(publicKey).toString("base64"));
	});

	it("uses sudo when the account is not root", () => {
		const command = buildInstallPublicKeyCommand({
			publicKey,
			home: "/home/deploy",
			sudo: true,
		});
		expect(command).toContain("sudo mkdir -p");
		expect(command).toContain("sudo grep -qxF");
	});

	it("removes only the managed key", () => {
		const command = buildRemovePublicKeyCommand({
			publicKey,
			home: "/home/deploy",
			sudo: false,
		});
		expect(command).toContain("grep -vxF");
		expect(command).toContain("/home/deploy/.ssh/authorized_keys");
		expect(command).not.toContain(publicKey);
	});
});

describe("connectSsh", () => {
	it("resolves a session and exposes the negotiated host key", async () => {
		const fake = new FakeClient();
		const session = await connectSsh({
			...baseTarget,
			auth: passwordAuth,
			clientFactory: () => asClient(fake),
		});

		expect(fake.connectCalls).toBe(1);
		expect(fake.connectConfig?.host).toBe("10.0.0.5");
		expect(fake.connectConfig?.tryKeyboard).toBe(true);
		expect(session.hostKey?.sha256.startsWith("SHA256:")).toBe(true);

		fake.execHandler = (_command, callback) => {
			const stream = createFakeStream();
			callback(undefined, stream);
			stream.emit("data", "notploy-ssh-ok\n");
			stream.emit("close", 0);
		};
		const result = await session.exec("echo notploy-ssh-ok");
		expect(result.stdout).toContain("notploy-ssh-ok");
		expect(result.code).toBe(0);
		session.end();
		expect(fake.ended).toBe(true);
	});

	it("classifies authentication failures", async () => {
		const fake = new FakeClient();
		fake.connect = function (config: Record<string, unknown>) {
			this.connectConfig = config;
			const hostVerifier = config.hostVerifier as
				| ((key: Buffer) => boolean)
				| undefined;
			hostVerifier?.(Buffer.from("fake-host-key-material"));
			queueMicrotask(() =>
				this.emit(
					"error",
					Object.assign(new Error("All configured authentication methods failed"), {
						level: "client-authentication",
					}),
				),
			);
			return this;
		};

		await expect(
			connectSsh({
				...baseTarget,
				auth: passwordAuth,
				clientFactory: () => asClient(fake),
			}),
		).rejects.toMatchObject({ name: "SshError", category: "authentication" });
	});

	it("classifies network failures", async () => {
		const fake = new FakeClient();
		fake.connect = function () {
			queueMicrotask(() =>
				this.emit(
					"error",
					Object.assign(new Error("getaddrinfo ENOTFOUND"), {
						level: "client-dns",
					}),
				),
			);
			return this;
		};

		await expect(
			connectSsh({
				...baseTarget,
				auth: passwordAuth,
				clientFactory: () => asClient(fake),
			}),
		).rejects.toMatchObject({ category: "network" });
	});

	it("classifies an unanswered connection as a timeout and cleans up", async () => {
		const fake = new FakeClient();
		fake.connect = function () {
			return this;
		};

		await expect(
			connectSsh({
				...baseTarget,
				auth: passwordAuth,
				connectTimeoutMs: 20,
				clientFactory: () => asClient(fake),
			}),
		).rejects.toMatchObject({ category: "timeout" });
		expect(fake.ended).toBe(true);
	});

	it("rejects a changed host key when the policy is strict", async () => {
		const fake = new FakeClient();
		// Emit the ssh2 failure when the verifier rejects the host key.
		fake.connect = function (config: Record<string, unknown>) {
			this.connectConfig = config;
			const hostVerifier = config.hostVerifier as
				| ((key: Buffer) => boolean)
				| undefined;
			const accepted = hostVerifier?.(
				Buffer.from("fake-host-key-material"),
			);
			queueMicrotask(() =>
				accepted === false
					? this.emit(
							"error",
							Object.assign(new Error("Host verification failed"), {
								level: "client-authentication",
							}),
						)
					: this.emit("ready"),
			);
			return this;
		};

		await expect(
			connectSsh({
				...baseTarget,
				auth: passwordAuth,
				hostKey: {
					policy: "strict",
					knownFingerprintSha256: "SHA256:different-fingerprint",
				},
				clientFactory: () => asClient(fake),
			}),
		).rejects.toMatchObject({
			category: "host-key",
		});
	});

	it("accepts the trusted host key when the policy is strict", async () => {
		const known = computeHostKeyFingerprint(
			Buffer.from("fake-host-key-material"),
		);
		const fake = new FakeClient();
		fake.connect = function (config: Record<string, unknown>) {
			this.connectConfig = config;
			const hostVerifier = config.hostVerifier as
				| ((key: Buffer) => boolean)
				| undefined;
			const accepted = hostVerifier?.(
				Buffer.from("fake-host-key-material"),
			);
			queueMicrotask(() =>
				accepted === false
					? this.emit(
							"error",
							Object.assign(new Error("Host verification failed"), {
								level: "client-authentication",
							}),
						)
					: this.emit("ready"),
			);
			return this;
		};

		const session = await connectSsh({
			...baseTarget,
			auth: passwordAuth,
			hostKey: {
				policy: "strict",
				knownFingerprintSha256: known.sha256,
			},
			clientFactory: () => asClient(fake),
		});
		expect(session.hostKey?.sha256).toBe(known.sha256);
		session.end();
	});

	it("classifies a failing remote command", async () => {
		const fake = new FakeClient();
		const session = await connectSsh({
			...baseTarget,
			auth: passwordAuth,
			clientFactory: () => asClient(fake),
		});
		fake.execHandler = (_command, callback) => {
			const stream = createFakeStream();
			callback(undefined, stream);
			stream.stderr.emit("data", "Permission denied");
			stream.emit("close", 1);
		};

		await expect(session.exec("touch /root/x")).rejects.toMatchObject({
			category: "command",
		});
		session.end();
	});
});

describe("verifyKeyBasedConnection", () => {
	it("connects with the private key and confirms access", async () => {
		const fake = new FakeClient();
		fake.execHandler = (_command, callback) => {
			const stream = createFakeStream();
			callback(undefined, stream);
			stream.emit("data", "notploy-ssh-ok\n");
			stream.emit("close", 0);
		};

		const fingerprint = await verifyKeyBasedConnection({
			...baseTarget,
			privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
			clientFactory: () => asClient(fake),
		});

		expect(fake.connectConfig?.privateKey).toBe(
			"-----BEGIN OPENSSH PRIVATE KEY-----",
		);
		expect(fingerprint?.sha256.startsWith("SHA256:")).toBe(true);
	});

	it("fails when the key does not grant access", async () => {
		const fake = new FakeClient();
		fake.connect = function () {
			queueMicrotask(() =>
				this.emit(
					"error",
					Object.assign(new Error("authentication failed"), {
						level: "client-authentication",
					}),
				),
			);
			return this;
		};

		await expect(
			verifyKeyBasedConnection({
				...baseTarget,
				privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
				clientFactory: () => asClient(fake),
			}),
		).rejects.toMatchObject({ category: "authentication" });
	});
});
