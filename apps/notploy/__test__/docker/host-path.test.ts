import { mapPathToHostTree } from "@notploy/server/utils/docker/host-path";
import { describe, expect, it } from "vitest";

const BASE_PATH = "/etc/notploy";
const VOLUME_PATH = "/var/lib/docker/volumes/notploy-config/_data";

describe("mapPathToHostTree", () => {
	it("leaves a path outside the configuration tree alone", () => {
		expect(mapPathToHostTree("/srv/data", BASE_PATH, VOLUME_PATH)).toBe(
			"/srv/data",
		);
	});

	it("leaves a sibling directory that only shares the prefix alone", () => {
		expect(
			mapPathToHostTree("/etc/notploy-old/torrc", BASE_PATH, VOLUME_PATH),
		).toBe("/etc/notploy-old/torrc");
	});

	it("keeps the path when the tree is mounted at the same path", () => {
		expect(
			mapPathToHostTree("/etc/notploy/onion/abc/torrc", BASE_PATH, BASE_PATH),
		).toBe("/etc/notploy/onion/abc/torrc");
	});

	it("maps the path onto the source the daemon mounts", () => {
		expect(
			mapPathToHostTree(
				"/etc/notploy/onion/abc/torrc",
				BASE_PATH,
				VOLUME_PATH,
			),
		).toBe(`${VOLUME_PATH}/onion/abc/torrc`);
	});

	it("maps the configuration root itself", () => {
		expect(mapPathToHostTree(BASE_PATH, BASE_PATH, VOLUME_PATH)).toBe(
			VOLUME_PATH,
		);
	});
});
