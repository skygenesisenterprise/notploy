/**
 * A small atomic JSON file store.
 *
 * Used for everything that is *not* secret: connection metadata and UI
 * preferences. Credentials never come near this class — they go through
 * `SecureStorage` (`src/main/security/secure-storage.ts`).
 *
 * Writes go to a temporary file and are renamed into place, so an interrupted
 * write cannot leave a half-written config behind, and the file is created with
 * owner-only permissions because it still holds instance URLs and tokens-free
 * but private operational details.
 */

import fs from "node:fs";
import path from "node:path";

export class JsonStore<T extends object> {
	private cache: T | undefined;

	constructor(
		private readonly file: string,
		private readonly defaults: T,
	) {}

	/** Reads the file, falling back to the defaults when it is absent/corrupt. */
	read(): T {
		if (this.cache) return this.cache;
		try {
			const raw = fs.readFileSync(this.file, "utf8");
			const parsed = JSON.parse(raw) as Partial<T>;
			if (!parsed || typeof parsed !== "object") {
				this.cache = { ...this.defaults };
				return this.cache;
			}
			this.cache = { ...this.defaults, ...parsed };
		} catch {
			this.cache = { ...this.defaults };
		}
		return this.cache;
	}

	/** Replaces the whole value. */
	write(value: T): T {
		const directory = path.dirname(this.file);
		fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
		const temporary = `${this.file}.tmp`;
		fs.writeFileSync(temporary, JSON.stringify(value, null, "\t"), {
			encoding: "utf8",
			mode: 0o600,
		});
		fs.renameSync(temporary, this.file);
		this.cache = value;
		return value;
	}

	/** Applies a pure transformation and persists the result. */
	update(mutator: (current: T) => T): T {
		return this.write(mutator(this.read()));
	}

	/** Drops the in-memory copy; the next read comes from disk. */
	invalidate(): void {
		this.cache = undefined;
	}
}
