import { describe, expect, it } from "vitest";
import * as sdk from "../src/sdk.gen";

describe("sdk exports", () => {
	it("exports application functions", () => {
		expect(typeof sdk.applicationCreate).toBe("function");
		expect(typeof sdk.applicationOne).toBe("function");
		expect(typeof sdk.applicationDelete).toBe("function");
		expect(typeof sdk.applicationStart).toBe("function");
		expect(typeof sdk.applicationStop).toBe("function");
		expect(typeof sdk.applicationRedeploy).toBe("function");
	});

	it("exports project functions", () => {
		expect(typeof sdk.projectCreate).toBe("function");
		expect(typeof sdk.projectOne).toBe("function");
		expect(typeof sdk.projectRemove).toBe("function");
		expect(typeof sdk.projectUpdate).toBe("function");
	});

	it("exports database functions", () => {
		expect(typeof sdk.postgresCreate).toBe("function");
		expect(typeof sdk.mysqlCreate).toBe("function");
		expect(typeof sdk.redisCreate).toBe("function");
		expect(typeof sdk.mongoCreate).toBe("function");
		expect(typeof sdk.mariadbCreate).toBe("function");
	});

	it("exports server functions", () => {
		expect(typeof sdk.serverCreate).toBe("function");
		expect(typeof sdk.serverOne).toBe("function");
	});

	it("exports deployment functions", () => {
		expect(typeof sdk.deploymentAll).toBe("function");
		expect(typeof sdk.deploymentAllByType).toBe("function");
	});
});
