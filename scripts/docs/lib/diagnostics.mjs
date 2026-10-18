/**
 * Collects errors and warnings from every check, then renders them in a
 * deterministic order. Errors fail the command; warnings are advisory and are
 * meant for human review.
 */
export class Diagnostics {
	constructor() {
		this.items = [];
	}

	add(severity, code, message, details = {}) {
		this.items.push({
			severity,
			code,
			message,
			file: details.file,
			line: details.line,
			hint: details.hint,
		});
	}

	error(code, message, details) {
		this.add("error", code, message, details);
	}

	warning(code, message, details) {
		this.add("warning", code, message, details);
	}

	get errors() {
		return this.items.filter((item) => item.severity === "error");
	}

	get warnings() {
		return this.items.filter((item) => item.severity === "warning");
	}

	get hasErrors() {
		return this.errors.length > 0;
	}

	/** Errors first, then file/line/code/message, so CI logs are reproducible. */
	sorted() {
		return [...this.items].sort((a, b) => {
			if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
			const file = (a.file ?? "").localeCompare(b.file ?? "");
			if (file !== 0) return file;
			const line = (a.line ?? 0) - (b.line ?? 0);
			if (line !== 0) return line;
			const code = a.code.localeCompare(b.code);
			if (code !== 0) return code;
			return a.message.localeCompare(b.message);
		});
	}

	toJSON() {
		return {
			version: 1,
			errors: this.errors
				.map(({ severity, ...item }) => item)
				.sort(byLocation),
			warnings: this.warnings
				.map(({ severity, ...item }) => item)
				.sort(byLocation),
		};
	}

	renderText() {
		return this.sorted()
			.map((item) => {
				const location = item.file
					? `${item.file}${item.line ? `:${item.line}` : ""}`
					: "repository";
				const lines = [
					`${item.severity} [${item.code}] ${location}: ${item.message}`,
				];
				if (item.hint) lines.push(`    hint: ${item.hint}`);
				return lines.join("\n");
			})
			.join("\n");
	}

	print({ json = false, command = "docs" } = {}) {
		if (json) {
			console.log(JSON.stringify(this.toJSON(), null, 2));
			return;
		}
		const text = this.renderText();
		if (text) console.error(text);
		const errors = this.errors.length;
		const warnings = this.warnings.length;
		console.log(
			`${command}: ${errors} error(s), ${warnings} warning(s).`,
		);
	}
}

function byLocation(a, b) {
	return (
		(a.file ?? "").localeCompare(b.file ?? "") ||
		(a.line ?? 0) - (b.line ?? 0) ||
		a.code.localeCompare(b.code) ||
		a.message.localeCompare(b.message)
	);
}
