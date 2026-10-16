import {
	apiCreateOnionService,
	apiDeleteOnionService,
	apiFindOnionService,
	apiFindOnionServicesByCompose,
	apiUpdateOnionService,
	onionServiceStatus,
	onionServices,
} from "@notploy/server/db/schema";
import { describe, expect, it } from "vitest";

const validInput = {
	name: "Public wiki",
	composeId: "compose1",
	serviceName: "web",
	targetPort: 3000,
};

describe("apiCreateOnionService", () => {
	it("accepts a valid target", () => {
		const parsed = apiCreateOnionService.safeParse(validInput);

		expect(parsed.success).toBe(true);
		expect(parsed.data?.virtualPort).toBeUndefined();
	});

	it("accepts an explicit virtual port", () => {
		const parsed = apiCreateOnionService.safeParse({
			...validInput,
			virtualPort: 443,
		});

		expect(parsed.success).toBe(true);
		expect(parsed.data?.virtualPort).toBe(443);
	});

	it.each([0, -1, 65536, 3000.5])("rejects the target port %s", (targetPort) => {
		expect(
			apiCreateOnionService.safeParse({ ...validInput, targetPort }).success,
		).toBe(false);
	});

	it.each([0, 65536])("rejects the virtual port %s", (virtualPort) => {
		expect(
			apiCreateOnionService.safeParse({ ...validInput, virtualPort }).success,
		).toBe(false);
	});

	it.each([
		"web; rm -rf /",
		"web && curl evil",
		"web$(id)",
		"web`id`",
		" web",
		"-web",
		"",
		"a".repeat(64),
	])("rejects the service name %j", (serviceName) => {
		expect(
			apiCreateOnionService.safeParse({ ...validInput, serviceName }).success,
		).toBe(false);
	});

	it("requires a name and a compose project", () => {
		expect(
			apiCreateOnionService.safeParse({ ...validInput, name: "" }).success,
		).toBe(false);
		expect(
			apiCreateOnionService.safeParse({ ...validInput, composeId: "" }).success,
		).toBe(false);
	});
});

describe("apiUpdateOnionService", () => {
	it("only requires the id", () => {
		const parsed = apiUpdateOnionService.safeParse({
			onionServiceId: "onion1",
		});

		expect(parsed.success).toBe(true);
	});

	it("still validates the fields that are provided", () => {
		expect(
			apiUpdateOnionService.safeParse({
				onionServiceId: "onion1",
				targetPort: 70000,
			}).success,
		).toBe(false);
		expect(
			apiUpdateOnionService.safeParse({
				onionServiceId: "onion1",
				serviceName: "web; rm",
			}).success,
		).toBe(false);
	});
});

describe("apiDeleteOnionService", () => {
	it("keeps the identity unless it is asked for explicitly", () => {
		const parsed = apiDeleteOnionService.safeParse({
			onionServiceId: "onion1",
		});

		expect(parsed.success).toBe(true);
		expect(parsed.data?.deleteIdentity).toBe(false);
	});

	it("accepts an explicit identity deletion", () => {
		const parsed = apiDeleteOnionService.safeParse({
			onionServiceId: "onion1",
			deleteIdentity: true,
		});

		expect(parsed.data?.deleteIdentity).toBe(true);
	});
});

describe("find schemas", () => {
	it("require a non-empty id", () => {
		expect(apiFindOnionService.safeParse({ onionServiceId: "" }).success).toBe(
			false,
		);
		expect(
			apiFindOnionServicesByCompose.safeParse({ composeId: "compose1" }).success,
		).toBe(true);
	});
});

describe("table", () => {
	it("stores the address and the identity path, never a key", () => {
		const columns = Object.keys(onionServices);

		expect(columns).toContain("onionAddress");
		expect(columns).toContain("identityPath");
		expect(columns.some((column) => /secret|privatekey/i.test(column))).toBe(
			false,
		);
		expect(onionServices.composeId.name).toBe("composeId");
	});

	it("exposes the documented lifecycle states", () => {
		expect(onionServiceStatus.enumValues).toEqual([
			"idle",
			"deploying",
			"running",
			"stopped",
			"error",
		]);
	});
});
