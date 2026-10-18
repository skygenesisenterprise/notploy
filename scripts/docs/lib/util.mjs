import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function readJsonFile(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

export function readTextFile(path) {
	return readFileSync(path, "utf8");
}

export function isDirectory(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

export function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * Recursively lists files under `dir`, sorted by path so every consumer gets
 * the same order on every filesystem.
 */
export function listFiles(dir, options = {}) {
	const { extensions, skipDirectories = new Set() } = options;
	const files = [];
	const walk = (current) => {
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const path = join(current, entry.name);
			if (entry.isDirectory()) {
				if (!skipDirectories.has(entry.name)) walk(path);
				continue;
			}
			if (!entry.isFile()) continue;
			if (
				extensions &&
				!extensions.some((extension) => entry.name.endsWith(extension))
			) {
				continue;
			}
			files.push(path);
		}
	};
	walk(dir);
	return files;
}

export function sortedUnique(values) {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
