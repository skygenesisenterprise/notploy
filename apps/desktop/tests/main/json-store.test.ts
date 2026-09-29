import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonStore } from "@/main/store/json-store";
import { type TempContext, tempUserData } from "../helpers/harness";

interface State {
	items: string[];
	activeId?: string;
}

let context: TempContext;

beforeEach(() => {
	context = tempUserData();
});

afterEach(() => context.cleanup());

function store(): JsonStore<State> {
	return new JsonStore<State>(path.join(context.userDataPath, "state.json"), {
		items: [],
	});
}

describe("JsonStore", () => {
	it("returns the defaults when the file does not exist", () => {
		expect(store().read()).toEqual({ items: [] });
	});

	it("persists and reads back a value", () => {
		const first = store();
		first.write({ items: ["a"], activeId: "a" });
		expect(store().read()).toEqual({ items: ["a"], activeId: "a" });
	});

	it("applies an update to the current value", () => {
		const subject = store();
		subject.write({ items: ["a"] });
		subject.update((current) => ({
			...current,
			items: [...current.items, "b"],
		}));
		expect(subject.read().items).toEqual(["a", "b"]);
	});

	it("merges the stored value over the defaults", () => {
		fs.writeFileSync(
			path.join(context.userDataPath, "state.json"),
			JSON.stringify({ activeId: "x" }),
			"utf8",
		);
		expect(store().read()).toEqual({ items: [], activeId: "x" });
	});

	it("falls back to the defaults when the file is corrupt", () => {
		fs.writeFileSync(
			path.join(context.userDataPath, "state.json"),
			"{oops",
			"utf8",
		);
		expect(store().read()).toEqual({ items: [] });
	});

	it("never leaves a temporary file behind", () => {
		const subject = store();
		subject.write({ items: ["a"] });
		const leftovers = fs
			.readdirSync(context.userDataPath)
			.filter((entry) => entry.endsWith(".tmp"));
		expect(leftovers).toEqual([]);
	});

	it("re-reads from disk after invalidate", () => {
		const subject = store();
		subject.write({ items: ["a"] });
		fs.writeFileSync(
			path.join(context.userDataPath, "state.json"),
			JSON.stringify({ items: ["external"] }),
			"utf8",
		);
		subject.invalidate();
		expect(subject.read().items).toEqual(["external"]);
	});
});
