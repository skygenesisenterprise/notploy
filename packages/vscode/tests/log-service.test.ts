import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogService, type LogTarget } from "../src/services/log-service";
import { testLogger } from "./helpers/services";
import {
	channelOutput,
	env,
	resetMockState,
	setConfiguration,
} from "./helpers/vscode-mock";

beforeEach(() => {
	resetMockState();
	setConfiguration({});
	env.clipboard.text = "";
});

function target(
	fetch: () => Promise<string>,
	key = "application:a1",
): LogTarget {
	return { key, label: "Notploy: website", fetch };
}

describe("LogService", () => {
	it("writes log content into an output channel named after the target", async () => {
		const service = new LogService(testLogger());
		await service.open(target(async () => "first\nsecond\n"));
		expect(channelOutput("Notploy: website")).toContain("first");
		expect(channelOutput("Notploy: website")).toContain("second");
	});

	it("only appends the delta when the payload grows", async () => {
		const service = new LogService(testLogger());
		const fetcher = vi
			.fn<() => Promise<string>>()
			.mockResolvedValueOnce("a\n")
			.mockResolvedValueOnce("a\nb\n");

		await service.open(target(fetcher));
		await service.refreshKey("application:a1");

		const output = channelOutput("Notploy: website");
		expect(output.match(/^a$/gm)).toHaveLength(1);
		expect(output).toContain("b");
	});

	it("repeats the payload when the log window rotated", async () => {
		const service = new LogService(testLogger());
		const fetcher = vi
			.fn<() => Promise<string>>()
			.mockResolvedValueOnce("a\n")
			.mockResolvedValueOnce("z\n");

		await service.open(target(fetcher));
		await service.refreshKey("application:a1");
		expect(channelOutput("Notploy: website")).toContain("z");
	});

	it("starts and stops following without polling during the test", async () => {
		const service = new LogService(testLogger());
		const logTarget = target(async () => "hello\n");

		await service.follow(logTarget);
		expect(service.isFollowing(logTarget.key)).toBe(true);

		await service.unfollow(logTarget.key);
		expect(service.isFollowing(logTarget.key)).toBe(false);
		expect(channelOutput("Notploy: website")).toContain(
			"Stopped following logs.",
		);
	});

	it("bounds the buffer used by Copy", async () => {
		setConfiguration({ "notploy.logMaxLines": 100 });
		const service = new LogService(testLogger());
		const lines = Array.from({ length: 250 }, (_, index) => `line ${index}`);
		await service.open(target(async () => `${lines.join("\n")}\n`));

		await service.copy("application:a1");
		const copied = env.clipboard.text.split("\n");
		expect(copied).toHaveLength(100);
		expect(copied[0]).toBe("line 150");
		expect(copied[99]).toBe("line 249");
	});

	it("clears a channel and keeps following afterwards", async () => {
		const service = new LogService(testLogger());
		const logTarget = target(async () => "content\n");
		await service.follow(logTarget);

		await service.clear(logTarget.key);
		expect(channelOutput("Notploy: website")).toContain("content");
		expect(service.isFollowing(logTarget.key)).toBe(true);
		await service.unfollow(logTarget.key);
	});

	it("reports a failure in the channel instead of throwing at the user", async () => {
		const service = new LogService(testLogger());
		await expect(
			service.open(
				target(async () => {
					throw Object.assign(new Error("denied"), { status: 403 });
				}),
			),
		).rejects.toThrow("denied");
		expect(channelOutput("Notploy: website")).toContain("⚠");
	});

	it("stops following when the credential is rejected", async () => {
		const service = new LogService(testLogger());
		const logTarget = target(async () => "seed\n");
		await service.follow(logTarget);
		expect(service.isFollowing(logTarget.key)).toBe(true);

		logTarget.fetch = async () => {
			throw Object.assign(new Error("unauthorized"), { status: 401 });
		};
		await expect(service.refreshKey(logTarget.key)).rejects.toThrow();
	});

	it("disposes every channel it created", async () => {
		const service = new LogService(testLogger());
		await service.open(target(async () => "x\n"));
		service.dispose();
		expect(service.hasSession("application:a1")).toBe(false);
	});
});
