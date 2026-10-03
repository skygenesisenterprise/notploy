import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mirrors the payload of https://api.github.com/repos/skygenesisenterprise/notploy/releases */
const release = (tagName: string, extra: Record<string, unknown> = {}) => ({
	tag_name: tagName,
	draft: false,
	prerelease: false,
	...extra,
});

/** A release whose install assets are fully published. */
const completeRelease = (
	tagName: string,
	extra: Record<string, unknown> = {},
) =>
	release(tagName, {
		html_url: `https://github.com/skygenesisenterprise/notploy/releases/tag/${tagName}`,
		published_at: "2026-01-01T00:00:00Z",
		assets: [{ name: "install.sh" }, { name: "install-notploy.sh" }],
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

	describe("normalizeVersion", () => {
		it("normalizes every version-ish spelling to a clean version", async () => {
			const { normalizeVersion } = await importFresh();

			expect(normalizeVersion("1.0.1")).toBe("1.0.1");
			expect(normalizeVersion("v1.0.1")).toBe("1.0.1");
			expect(normalizeVersion("v1.0.1-app")).toBe("1.0.1");
			expect(normalizeVersion("release-v1.0.1")).toBe("1.0.1");
			expect(normalizeVersion("  1.0.1 ")).toBe("1.0.1");
		});

		it("keeps prerelease identifiers", async () => {
			const { normalizeVersion } = await importFresh();

			expect(normalizeVersion("v1.0.0-beta.1-app")).toBe("1.0.0-beta.1");
		});

		it("returns null for unparseable input", async () => {
			const { normalizeVersion } = await importFresh();

			expect(normalizeVersion("latest")).toBeNull();
			expect(normalizeVersion("")).toBeNull();
			expect(normalizeVersion("not-a-version")).toBeNull();
		});
	});

	describe("checkReleaseAssets", () => {
		it("reports missing assets", async () => {
			const { checkReleaseAssets } = await importFresh();

			expect(checkReleaseAssets([])).toEqual({
				available: false,
				reason: "missing_assets",
				assets: [],
				missing: ["install.sh"],
			});
		});

		it("accepts a release with every required asset", async () => {
			const { checkReleaseAssets } = await importFresh();

			const result = checkReleaseAssets([
				{ name: "install.sh" },
				{ name: "install-notploy.sh" },
			]);
			expect(result.available).toBe(true);
			expect(result.reason).toBeNull();
			expect(result.missing).toEqual([]);
		});

		it("ignores an unrelated asset that is not the expected artifact", async () => {
			const { checkReleaseAssets } = await importFresh();

			const result = checkReleaseAssets([{ name: "some-other-file.zip" }]);
			expect(result.available).toBe(false);
			expect(result.missing).toEqual(["install.sh"]);
		});

		it("handles undefined assets safely", async () => {
			const { checkReleaseAssets } = await importFresh();

			expect(checkReleaseAssets(undefined).available).toBe(false);
		});
	});

	describe("computeUpdateStatus", () => {
		it("is up_to_date when versions match", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.1",
					latestVersion: "1.0.1",
					assetsReady: true,
				}),
			).toBe("up_to_date");
		});

		it("is ready when a newer release has its assets", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.0",
					latestVersion: "1.0.1",
					assetsReady: true,
				}),
			).toBe("ready");
		});

		it("is waiting_for_assets when a newer release is incomplete", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.0",
					latestVersion: "1.0.1",
					assetsReady: false,
				}),
			).toBe("waiting_for_assets");
		});

		it("is release_detected while availability is unknown", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.0",
					latestVersion: "1.0.1",
				}),
			).toBe("release_detected");
		});

		it("is up_to_date when the installed version is ahead", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.2",
					latestVersion: "1.0.1",
					assetsReady: true,
				}),
			).toBe("up_to_date");
		});

		it("compares versions semantically, not lexically", async () => {
			const { computeUpdateStatus } = await importFresh();
			const ready = (currentVersion: string, latestVersion: string) =>
				computeUpdateStatus({ currentVersion, latestVersion, assetsReady: true });

			expect(ready("1.0.9", "1.0.10")).toBe("ready");
			expect(ready("1.0.10", "1.1.0")).toBe("ready");
			expect(ready("1.9.0", "2.0.0")).toBe("ready");
			expect(ready("1.0.10", "1.0.9")).toBe("up_to_date");
		});

		it("handles prereleases explicitly", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({
					currentVersion: "1.0.0",
					latestVersion: "1.0.0-rc.1",
					assetsReady: true,
				}),
			).toBe("up_to_date");
			expect(
				computeUpdateStatus({
					currentVersion: "1.0.0-beta.1",
					latestVersion: "1.0.0",
					assetsReady: true,
				}),
			).toBe("ready");
		});

		it("treats invalid input as up_to_date", async () => {
			const { computeUpdateStatus } = await importFresh();

			expect(
				computeUpdateStatus({ currentVersion: "nope", latestVersion: "1.0.1" }),
			).toBe("up_to_date");
			expect(
				computeUpdateStatus({ currentVersion: "1.0.0", latestVersion: null }),
			).toBe("up_to_date");
		});
	});

	describe("getUpdateStatus", () => {
		it("is up_to_date when the newest release is the running one", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([completeRelease("v1.0.1-app")]));

			const status = await getUpdateStatus("1.0.1");

			expect(status.status).toBe("up_to_date");
			expect(status.updateAvailable).toBe(false);
			expect(status.currentVersion).toBe("1.0.1");
			expect(status.latestNormalizedVersion).toBe("1.0.1");
		});

		it("is ready when a newer release has its assets", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(
				okResponse([completeRelease("v1.0.2-app")]),
			);

			const status = await getUpdateStatus("1.0.1");

			expect(status.status).toBe("ready");
			expect(status.assetsReady).toBe(true);
			expect(status.updateAvailable).toBe(true);
			expect(status.latestVersion).toBe("v1.0.2-app");
			expect(status.latestNormalizedVersion).toBe("1.0.2");
			expect(status.releaseUrl).toContain("v1.0.2-app");
		});

		it("is waiting_for_assets when the release has no assets yet", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v1.0.2-app")]));

			const status = await getUpdateStatus("1.0.1");

			expect(status.status).toBe("waiting_for_assets");
			expect(status.assetsReady).toBe(false);
			expect(status.missingAssets).toEqual(["install.sh"]);
			expect(status.updateAvailable).toBe(true);
		});

		it("is up_to_date when the installed version is ahead", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(okResponse([completeRelease("v1.0.1-app")]));

			const status = await getUpdateStatus("1.0.2");

			expect(status.status).toBe("up_to_date");
			expect(status.updateAvailable).toBe(false);
		});

		it("keeps the last known status when GitHub is unavailable", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(
				okResponse([completeRelease("v1.0.2-app")]),
			);
			const first = await getUpdateStatus("1.0.1");

			fetchMock.mockRejectedValue(new Error("network down"));
			const afterOutage = await getUpdateStatus("1.0.1");

			expect(first.status).toBe("ready");
			expect(afterOutage.status).toBe("ready");
		});

		it("is up_to_date for the canary and feature channels", async () => {
			const { getUpdateStatus } = await importFresh();

			const status = await getUpdateStatus("1.0.1", "canary");
			expect(status.status).toBe("up_to_date");
			expect(status.updateAvailable).toBe(false);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("coalesces concurrent lookups into a single GitHub request", async () => {
			const { getUpdateStatus } = await importFresh();
			fetchMock.mockResolvedValue(
				okResponse([completeRelease("v1.0.2-app")]),
			);

			await Promise.all([
				getUpdateStatus("1.0.1"),
				getUpdateStatus("1.0.1"),
				getUpdateStatus("1.0.1"),
			]);

			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("isUpdateInstallable", () => {
		it("only allows the ready status", async () => {
			const { getUpdateStatus, isUpdateInstallable, invalidateUpdateCache } =
				await importFresh();
			fetchMock.mockResolvedValue(okResponse([release("v1.0.2-app")]));

			const waiting = await getUpdateStatus("1.0.1");
			expect(waiting.status).toBe("waiting_for_assets");
			expect(isUpdateInstallable(waiting)).toBe(false);

			// A later check finds the assets published: same version, now installable.
			invalidateUpdateCache();
			fetchMock.mockResolvedValue(
				okResponse([completeRelease("v1.0.2-app")]),
			);
			const ready = await getUpdateStatus("1.0.1");
			expect(ready.status).toBe("ready");
			expect(isUpdateInstallable(ready)).toBe(true);
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
