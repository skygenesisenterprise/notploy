import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mirrors the payload of https://api.github.com/repos/skygenesisenterprise/notploy/releases */
const release = (tagName: string, extra: Record<string, unknown> = {}) => ({
	tag_name: tagName,
	draft: false,
	prerelease: false,
	...extra,
});

const okResponse = (releases: unknown[]) =>
	({
		ok: true,
		status: 200,
		json: async () => releases,
	}) as Response;

/**
 * The module caches the releases in memory, so every test needs a fresh copy of
 * it or the cache of the previous test would answer for this one.
 */
const importFresh = async () => {
	vi.resetModules();
	return await import("@notploy/server/services/settings");
};

describe("update check", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.doUnmock("@notploy/server/utils/process/execAsync");
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("toReleaseTag", () => {
		it("turns a bare version into the published release tag", async () => {
			const { toReleaseTag } = await importFresh();

			expect(toReleaseTag("0.30.6")).toBe("v0.30.6-app");
			expect(toReleaseTag("v0.30.6")).toBe("v0.30.6-app");
		});

		it("leaves an already suffixed release tag untouched", async () => {
			const { toReleaseTag } = await importFresh();

			expect(toReleaseTag("v0.30.6-app")).toBe("v0.30.6-app");
		});

		it("leaves channels and branch tags untouched", async () => {
			const { toReleaseTag } = await importFresh();

			expect(toReleaseTag("latest")).toBe("latest");
			expect(toReleaseTag("canary")).toBe("canary");
			expect(toReleaseTag("feature")).toBe("feature");
			expect(toReleaseTag("a1b2c3d")).toBe("a1b2c3d");
		});
	});

	describe("getUpdateData", () => {
		it("offers the highest self-hosted release when it is newer", async () => {
			const { getUpdateData } = await importFresh();
			fetchMock.mockResolvedValue(
				okResponse([
					release("v0.30.6-app"),
					release("v0.30.7-app"),
					release("v0.31.0-app"),
				]),
			);

			const data = await getUpdateData("0.30.6");

			expect(data).toEqual({
				latestVersion: "v0.31.0-app",
				updateAvailable: true,
			});
			expect(fetchMock).toHaveBeenCalledWith(
				"https://api.github.com/repos/skygenesisenterprise/notploy/releases?per_page=100",
				expect.objectContaining({ method: "GET" }),
			);
		});

		it("reports no update when the newest release is the running one", async () => {
			const { getUpdateData } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v0.30.6-app")]));

			expect(await getUpdateData("0.30.6")).toEqual({
				latestVersion: "v0.30.6-app",
				updateAvailable: false,
			});
		});

		it("reports no update when the installed version is ahead", async () => {
			const { getUpdateData } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v0.30.6-app")]));

			expect(await getUpdateData("0.31.0")).toEqual({
				latestVersion: "v0.30.6-app",
				updateAvailable: false,
			});
		});

		it("ignores the other images of the publish matrix, drafts and prereleases", async () => {
			const { getUpdateData } = await importFresh();
			fetchMock.mockResolvedValue(
				okResponse([
					release("v9.9.9-cloud"),
					release("v9.9.9-mcp"),
					release("v9.9.9-app", { draft: true }),
					release("v8.8.8-app", { prerelease: true }),
					release("v0.30.7-app"),
				]),
			);

			expect(await getUpdateData("0.30.6")).toEqual({
				latestVersion: "v0.30.7-app",
				updateAvailable: true,
			});
		});

		it("returns no update data when no self-hosted release exists", async () => {
			const { getUpdateData, DEFAULT_UPDATE_DATA } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v1.0.0-cloud")]));

			expect(await getUpdateData("0.30.6")).toEqual(DEFAULT_UPDATE_DATA);
		});

		it("skips the GitHub request on the canary and feature channels", async () => {
			const { getUpdateData, DEFAULT_UPDATE_DATA } = await importFresh();

			expect(await getUpdateData("0.30.6", "canary")).toEqual(
				DEFAULT_UPDATE_DATA,
			);
			expect(await getUpdateData("0.30.6", "feature")).toEqual(
				DEFAULT_UPDATE_DATA,
			);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("returns no update data for an unparseable version", async () => {
			const { getUpdateData, DEFAULT_UPDATE_DATA } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v0.30.7-app")]));

			expect(await getUpdateData("not-a-version")).toEqual(
				DEFAULT_UPDATE_DATA,
			);
		});

		it("caches the releases so the dashboard polling does not exhaust the rate limit", async () => {
			const { getUpdateData } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v0.30.7-app")]));

			await getUpdateData("0.30.6");
			await getUpdateData("0.30.6");

			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("keeps serving the last known releases when GitHub rate limits the request", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
			const { getUpdateData } = await importFresh();

			fetchMock.mockResolvedValue(okResponse([release("v0.30.7-app")]));
			const first = await getUpdateData("0.30.6");

			// Past the cache lifetime, GitHub now answers with a rate limit.
			vi.advanceTimersByTime(16 * 60 * 1000);
			fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);
			const stale = await getUpdateData("0.30.6");

			expect(first.updateAvailable).toBe(true);
			expect(stale).toEqual(first);
		});

		it("survives a GitHub outage on a cold cache", async () => {
			const { getUpdateData, DEFAULT_UPDATE_DATA } = await importFresh();
			fetchMock.mockRejectedValue(new Error("network down"));

			expect(await getUpdateData("0.30.6")).toEqual(DEFAULT_UPDATE_DATA);
		});

		it("survives an unexpected GitHub payload", async () => {
			const { getUpdateData, DEFAULT_UPDATE_DATA } = await importFresh();
			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ message: "Not Found" }),
			} as Response);

			expect(await getUpdateData("0.30.6")).toEqual(DEFAULT_UPDATE_DATA);
		});
	});

	describe("reloadDockerResource", () => {
		it("updates the service to the GHCR image of the released tag", async () => {
			// First call answers the resource type lookup, second one the update.
			const execAsync = vi
				.fn()
				.mockResolvedValueOnce({ stdout: "service\n", stderr: "" })
				.mockResolvedValueOnce({ stdout: "", stderr: "" });
			vi.doMock("@notploy/server/utils/process/execAsync", () => ({
				execAsync,
				execAsyncRemote: vi.fn(),
			}));

			vi.resetModules();
			const { reloadDockerResource } = await import(
				"@notploy/server/services/settings"
			);

			await reloadDockerResource("notploy", undefined, "0.30.7");

			expect(execAsync).toHaveBeenLastCalledWith(
				"docker service update --force --image ghcr.io/skygenesisenterprise/notploy:v0.30.7-app notploy",
			);
		});
	});

	it("publishes the self-hosted image on the GitHub Container Registry", async () => {
		const { NOTPLOY_IMAGE } = await importFresh();

		expect(NOTPLOY_IMAGE).toBe("ghcr.io/skygenesisenterprise/notploy");
	});
});
