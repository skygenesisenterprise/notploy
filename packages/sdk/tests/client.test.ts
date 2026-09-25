import { describe, expect, it } from "vitest";
import { client } from "../src/client.gen";

describe("client", () => {
	it("has a default baseUrl", () => {
		const config = client.getConfig();
		expect(config.baseUrl).toBe("https://your-dokploy-instance.com/api");
	});

	it("can override baseUrl", () => {
		client.setConfig({ baseUrl: "https://my-instance.dokploy.com/api" });
		expect(client.getConfig().baseUrl).toBe(
			"https://my-instance.dokploy.com/api",
		);
		// reset
		client.setConfig({ baseUrl: "https://your-dokploy-instance.com/api" });
	});

	it("can set auth headers", () => {
		client.setConfig({
			headers: { Authorization: "Bearer test-token" },
		});
		const headers = client.getConfig().headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer test-token");
	});
});
