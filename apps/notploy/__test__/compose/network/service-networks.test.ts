import type { Compose, ComposeSpecification } from "@notploy/server";
import {
	applyServiceNetworks,
	declareUsedNetworksInRoot,
	isolatedNetworkName,
	resolveServiceNetworks,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { getRemoteDocker } from "@notploy/server/utils/servers/remote-docker";
import { beforeEach, expect, test, vi } from "vitest";
import { parse } from "yaml";

// `resolveServiceNetworks` reaches the daemon to make sure a service's dedicated
// network exists, so the Docker client is stubbed for the isolation cases.
vi.mock("@notploy/server/utils/servers/remote-docker", () => ({
	getRemoteDocker: vi.fn(),
}));

const getRemoteDockerMock = getRemoteDocker as ReturnType<typeof vi.fn>;

const findManyMock = db.query.network.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
	findManyMock.mockReset();
	findManyMock.mockResolvedValue([]);
});

const baseCompose = {
	serverId: null,
	isolatedDeployment: false,
} as unknown as Compose;

const withServiceNetworks = (
	serviceNetworks: Compose["serviceNetworks"],
): Compose => ({ ...baseCompose, serviceNetworks });

test("applyServiceNetworks: no-op when serviceNetworks is empty", async () => {
	const result = parse(`
services:
  web:
    image: nginx
`) as ComposeSpecification;

	const injected = await applyServiceNetworks(result, withServiceNetworks([]));

	expect(injected.size).toBe(0);
	expect(result.services?.web?.networks).toBeUndefined();
	expect(findManyMock).not.toHaveBeenCalled();
});

test("applyServiceNetworks: injects assigned network by networkId", async () => {
	findManyMock.mockResolvedValue([{ networkId: "net-1", name: "shared-net" }]);

	const result = parse(`
services:
  web:
    image: nginx
`) as ComposeSpecification;

	const injected = await applyServiceNetworks(
		result,
		withServiceNetworks([
			{
				serviceName: "web",
				networkIds: ["net-1"],
				detachNotployNetwork: false,
			},
		]),
	);

	expect(injected.has("shared-net")).toBe(true);
	expect(result.services?.web?.networks).toContain("shared-net");
});

test("applyServiceNetworks: detach removes notploy-network and default", async () => {
	const result = parse(`
services:
  db:
    image: postgres
    networks:
      - notploy-network
      - default
`) as ComposeSpecification;

	const injected = await applyServiceNetworks(
		result,
		withServiceNetworks([
			{ serviceName: "db", networkIds: [], detachNotployNetwork: true },
		]),
	);

	expect(injected.size).toBe(0);
	expect(result.services?.db?.networks).not.toContain("notploy-network");
	expect(result.services?.db?.networks).not.toContain("default");
});

test("applyServiceNetworks: unknown networkId is skipped", async () => {
	findManyMock.mockResolvedValue([]);

	const result = parse(`
services:
  web:
    image: nginx
`) as ComposeSpecification;

	const injected = await applyServiceNetworks(
		result,
		withServiceNetworks([
			{
				serviceName: "web",
				networkIds: ["missing"],
				detachNotployNetwork: false,
			},
		]),
	);

	expect(injected.size).toBe(0);
});

test("applyServiceNetworks: skips services that don't exist in the compose", async () => {
	findManyMock.mockResolvedValue([{ networkId: "net-1", name: "shared-net" }]);

	const result = parse(`
services:
  web:
    image: nginx
`) as ComposeSpecification;

	const injected = await applyServiceNetworks(
		result,
		withServiceNetworks([
			{
				serviceName: "ghost",
				networkIds: ["net-1"],
				detachNotployNetwork: false,
			},
		]),
	);

	expect(injected.size).toBe(0);
	expect(result.services?.web?.networks).toBeUndefined();
});

test("declareUsedNetworksInRoot: declares notploy-network only when used", () => {
	const used = parse(`
services:
  web:
    image: nginx
    networks:
      - notploy-network
`) as ComposeSpecification;
	declareUsedNetworksInRoot(used, new Set());
	expect(used.networks).toHaveProperty("notploy-network");

	const unused = parse(`
services:
  web:
    image: nginx
    networks:
      - default
`) as ComposeSpecification;
	declareUsedNetworksInRoot(unused, new Set());
	expect(unused.networks ?? {}).not.toHaveProperty("notploy-network");
});

test("declareUsedNetworksInRoot: declares injected networks that are used", () => {
	const result = parse(`
services:
  web:
    image: nginx
    networks:
      - shared-net
`) as ComposeSpecification;

	declareUsedNetworksInRoot(result, new Set(["shared-net", "unused-net"]));

	expect(result.networks).toHaveProperty("shared-net");
	expect(result.networks ?? {}).not.toHaveProperty("unused-net");
});

test("resolveServiceNetworks: returns notploy-network by default", async () => {
	const resolved = await resolveServiceNetworks({});
	expect(resolved).toEqual([{ Target: "notploy-network" }]);
	expect(findManyMock).not.toHaveBeenCalled();
});

test("resolveServiceNetworks: omits notploy-network when detached", async () => {
	const resolved = await resolveServiceNetworks({ detachNotployNetwork: true });
	expect(resolved).toEqual([]);
});

test("resolveServiceNetworks: appends overlay networks by networkId", async () => {
	findManyMock.mockResolvedValue([{ name: "overlay-a" }]);

	const resolved = await resolveServiceNetworks({ networkIds: ["net-a"] });

	expect(resolved).toEqual([
		{ Target: "notploy-network" },
		{ Target: "overlay-a" },
	]);
});

test("resolveServiceNetworks: networkSwarm override takes precedence", async () => {
	const override = [{ Target: "custom-net" }];
	const resolved = await resolveServiceNetworks({ networkSwarm: override });

	expect(resolved).toBe(override);
	expect(findManyMock).not.toHaveBeenCalled();
});

test("isolatedNetworkName: prefixes the app name to avoid reserved networks", () => {
	expect(isolatedNetworkName("gitea")).toBe("notploy-iso-gitea");
});

test("resolveServiceNetworks: attaches a dedicated isolated network", async () => {
	const inspect = vi.fn().mockResolvedValue({});
	const createNetwork = vi.fn();
	getRemoteDockerMock.mockResolvedValue({
		getNetwork: () => ({ inspect }),
		createNetwork,
	});

	const resolved = await resolveServiceNetworks({
		isolatedNetwork: true,
		appName: "myapp",
	});

	// It stays on notploy-network so Traefik keeps serving the domain.
	expect(resolved).toEqual([
		{ Target: "notploy-network" },
		{ Target: "notploy-iso-myapp" },
	]);
	expect(createNetwork).not.toHaveBeenCalled();
});

test("resolveServiceNetworks: creates the isolated network when missing", async () => {
	const inspect = vi
		.fn()
		.mockRejectedValue(
			Object.assign(new Error("not found"), { statusCode: 404 }),
		);
	const createNetwork = vi.fn().mockResolvedValue({ id: "net" });
	getRemoteDockerMock.mockResolvedValue({
		getNetwork: () => ({ inspect }),
		createNetwork,
	});

	const resolved = await resolveServiceNetworks({
		isolatedNetwork: true,
		appName: "myapp",
	});

	expect(resolved).toEqual([
		{ Target: "notploy-network" },
		{ Target: "notploy-iso-myapp" },
	]);
	expect(createNetwork).toHaveBeenCalledWith(
		expect.objectContaining({
			Name: "notploy-iso-myapp",
			Driver: "overlay",
			Attachable: true,
		}),
	);
});

test("resolveServiceNetworks: no dedicated network when isolation is off", async () => {
	getRemoteDockerMock.mockReset();
	const resolved = await resolveServiceNetworks({ appName: "myapp" });

	expect(resolved).toEqual([{ Target: "notploy-network" }]);
	expect(getRemoteDockerMock).not.toHaveBeenCalled();
});
