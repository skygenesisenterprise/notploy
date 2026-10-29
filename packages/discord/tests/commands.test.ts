import { describe, expect, it } from "vitest";
import { createCommands, serializeCommands } from "../src/commands/index.js";

describe("command registry", () => {
	it("contains the V1 community commands", () => {
		const commands = createCommands();
		expect([...commands.keys()]).toEqual(["about", "docs", "links", "status", "version", "help"]);
	});

	it("derives /help from the full registry, including itself", () => {
		const commands = createCommands();
		expect(commands.has("help")).toBe(true);
	});

	it("produces valid slash command payloads", () => {
		const body = serializeCommands(createCommands().values());
		expect(body.length).toBeGreaterThan(0);
		for (const payload of body) {
			expect(typeof payload.name).toBe("string");
			expect(payload.name.length).toBeGreaterThan(0);
			expect(typeof payload.description).toBe("string");
			expect(payload.description.length).toBeGreaterThan(0);
		}
	});

	it("names every payload after its registry key", () => {
		const commands = createCommands();
		const body = serializeCommands(commands.values());
		const names = new Set(body.map((payload) => payload.name));
		for (const key of commands.keys()) {
			expect(names.has(key)).toBe(true);
		}
	});
});
