/**
 * Shared test helpers.
 *
 * `publishState` writes the last-known-public snapshot to `config.snapshotFile`,
 * so every test context is given a throwaway data directory: a test run must
 * never leave a `data/` folder (or a SQLite file) in the repository.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createStatusContext,
	loadConfig,
	openDatabase,
	type StatusContext,
} from "../src/index";

/** Config pointing at a fresh temporary data directory. */
export const testConfig = () =>
	loadConfig({
		STATUS_DATA_DIR: mkdtempSync(join(tmpdir(), "notploy-status-test-")),
	});

export interface Harness {
	ctx: StatusContext;
	setNow: (iso: string) => void;
}

/** In-memory database + frozen clock, isolated from the working directory. */
export const createHarness = (start = "2026-01-01T09:00:00.000Z"): Harness => {
	let current = start;
	const ctx = createStatusContext({
		db: openDatabase({ file: ":memory:" }),
		config: testConfig(),
		now: () => current,
	});
	return {
		ctx,
		setNow: (iso: string) => {
			current = iso;
		},
	};
};
