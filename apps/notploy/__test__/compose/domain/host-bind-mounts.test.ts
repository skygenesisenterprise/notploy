import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";

import { toDockerHostPath } from "@notploy/server/utils/docker/host-path";

// Simulate a development stack whose configuration tree lives in a Docker
// volume: every container path handed to the daemon is rebased under the
// volume's host directory.
vi.mock("@notploy/server/utils/docker/host-path", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@notploy/server/utils/docker/host-path")
	>()),
	toDockerHostPath: vi.fn(async (containerPath: string) => `/host-tree${containerPath}`),
}));

import { writeDomainsToCompose } from "@notploy/server/utils/docker/domain";

const baseCompose = {
	appName: "my-app",
	serverId: null,
	composeType: "docker-compose",
	sourceType: "raw",
	composePath: "docker-compose.yml",
	composeFile: `services:
  prometheus:
    image: prom/prometheus:v3.3.1
    volumes:
      - ../files/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
      - /:/host:ro,rslave
      - type: bind
        source: ../files/notploy-alerts.yml
        target: /etc/prometheus/notploy-alerts.yml
      - type: volume
        source: grafana-storage
        target: /var/lib/grafana
volumes:
  prometheus-data:
  grafana-storage:
`,
	isolatedDeployment: false,
	randomize: false,
	suffix: "",
} as any;

const decodeWrittenCompose = (command: string) => {
	const match = command.match(/echo "([A-Za-z0-9+/=]+)" \| base64 -d/);
	expect(match).not.toBeNull();
	return parse(Buffer.from(match?.[1] ?? "", "base64").toString("utf8"));
};

describe("writeDomainsToCompose local bind-mount remapping", () => {
	it("rewrites config-tree bind sources to daemon host paths", async () => {
		const result = await writeDomainsToCompose(baseCompose, []);
		const written = decodeWrittenCompose(result);
		const volumes = written.services.prometheus.volumes;

		// Relative bind source resolving inside the config tree → host path.
		expect(volumes[0]).toMatch(/^\/host-tree\/.*\/files\/prometheus\.yml:\/etc\/prometheus\/prometheus\.yml$/);
		// Named volume → untouched.
		expect(volumes[1]).toBe("prometheus-data:/prometheus");
		// Absolute host path outside the config tree → untouched.
		expect(volumes[2]).toBe("/:/host:ro,rslave");
		// Long-syntax bind → source rewritten.
		expect(volumes[3].source).toMatch(/^\/host-tree\/.*\/files\/notploy-alerts\.yml$/);
		expect(volumes[3].target).toBe("/etc/prometheus/notploy-alerts.yml");
		// Long-syntax named volume → untouched.
		expect(volumes[4]).toEqual({
			type: "volume",
			source: "grafana-storage",
			target: "/var/lib/grafana",
		});

		expect(vi.mocked(toDockerHostPath)).toHaveBeenCalled();
	});

	it("leaves remote-server composes untouched", async () => {
		vi.mocked(toDockerHostPath).mockClear();
		const result = await writeDomainsToCompose(
			{ ...baseCompose, serverId: "remote-server" },
			[],
		);
		const written = decodeWrittenCompose(result);
		const volumes = written.services.prometheus.volumes;

		expect(volumes[0]).toBe(
			"../files/prometheus.yml:/etc/prometheus/prometheus.yml",
		);
		expect(volumes[3].source).toBe("../files/notploy-alerts.yml");
		expect(vi.mocked(toDockerHostPath)).not.toHaveBeenCalled();
	});
});
