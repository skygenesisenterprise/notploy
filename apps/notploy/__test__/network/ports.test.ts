import {
	findPortConflict,
	isValidPortNumber,
	normalizePortMappings,
} from "@notploy/server/utils/network/ports";
import { describe, expect, it } from "vitest";

describe("isValidPortNumber", () => {
	it.each([1, 80, 443, 65535])("accepts %i", (port) => {
		expect(isValidPortNumber(port)).toBe(true);
	});

	it.each([0, -1, 65536, 80.5, Number.NaN])("rejects %s", (port) => {
		expect(isValidPortNumber(port)).toBe(false);
	});
});

describe("findPortConflict", () => {
	const existing = [
		{ publishedPort: 8080, targetPort: 80, protocol: "tcp" as const },
		{ publishedPort: 8443, targetPort: 443, protocol: "tcp" as const },
	];

	it("accepts a distinct mapping", () => {
		expect(
			findPortConflict(
				{ publishedPort: 8081, targetPort: 80, protocol: "tcp" },
				existing,
			),
		).toBeNull();
	});

	it("allows the same published port on a different protocol", () => {
		expect(
			findPortConflict(
				{ publishedPort: 8080, targetPort: 53, protocol: "udp" },
				existing,
			),
		).toBeNull();
	});

	it("rejects a duplicate published port + protocol", () => {
		const conflict = findPortConflict(
			{ publishedPort: 8080, targetPort: 3000, protocol: "tcp" },
			existing,
		);
		expect(conflict?.type).toBe("duplicate-published-port");
		expect(conflict?.message).toContain("8080/tcp");
	});

	it("rejects an exact duplicate mapping", () => {
		const conflict = findPortConflict(
			{ publishedPort: 8080, targetPort: 80, protocol: "tcp" },
			existing,
		);
		expect(conflict?.type).toBe("duplicate-mapping");
	});

	it("rejects out-of-range ports", () => {
		expect(
			findPortConflict(
				{ publishedPort: 0, targetPort: 80, protocol: "tcp" },
				existing,
			)?.type,
		).toBe("invalid-range");
		expect(
			findPortConflict(
				{ publishedPort: 8080, targetPort: 70000, protocol: "tcp" },
				existing,
			)?.type,
		).toBe("invalid-range");
	});
});

describe("normalizePortMappings", () => {
	it("drops invalid rows and duplicate published/protocol pairs", () => {
		const result = normalizePortMappings([
			{ publishedPort: 8080, targetPort: 80, protocol: "tcp" as const },
			{ publishedPort: 8080, targetPort: 3000, protocol: "tcp" as const },
			{ publishedPort: 0, targetPort: 80, protocol: "tcp" as const },
			{ publishedPort: 8080, targetPort: 53, protocol: "udp" as const },
		]);
		expect(result).toEqual([
			{ publishedPort: 8080, targetPort: 80, protocol: "tcp" },
			{ publishedPort: 8080, targetPort: 53, protocol: "udp" },
		]);
	});
});
