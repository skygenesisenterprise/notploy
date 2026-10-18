// Shared parser for packages/cli/src/generated/commands.ts, the file the CLI
// registers with commander. Both the CLI documentation generator and
// scripts/docs consume it so the documented surface always comes from the
// commands the binary actually exposes.
//
// Literal JS strings as emitted by packages/cli/scripts/generator.ts, which
// uses JSON.stringify (double quotes) for names and descriptions. Single-quoted
// literals are still accepted so the parser also reads hand-edited output.

const STRING_SOURCE = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;

export function decodeJsString(value) {
	if (value.startsWith('"')) return JSON.parse(value);
	return value.slice(1, -1).replace(/\\(.)/g, "$1");
}

/** `--sourceType <value>` + "sourceType (github, docker)" -> enum values. */
function splitDescription(description) {
	const match = description.match(/^(.*?)\s*\(([^()]*)\)$/);
	if (match) {
		const values = match[2].split(", ").map((value) => value.trim());
		if (
			values.length > 0 &&
			values.every((value) => /^[A-Za-z0-9_.:-]+$/.test(value))
		) {
			return { description: match[1], values };
		}
	}
	return { description, values: [] };
}

// Every generated command adds this option on top of the spec inputs.
const GLOBAL_OPTIONS = new Set(["--json"]);

function metaPart(body, key) {
	const match = body.match(new RegExp(`${key}:\\s*(\\[[^\\]]*\\]|\\{[^}]*\\})`));
	if (!match) return undefined;
	try {
		return JSON.parse(match[1]);
	} catch {
		return undefined;
	}
}

/** Reads the `{ required, types, enums }` literal passed to runApiCommand. */
function parseCommandMeta(body) {
	return {
		required: metaPart(body, "required") ?? [],
		types: metaPart(body, "types") ?? {},
		enums: metaPart(body, "enums") ?? {},
	};
}

/**
 * Parses the generated commander file into a deterministic model:
 *   [{ name, variable, commands: [{ action, options, endpoint, method }] }]
 */
export function parseCommandsFile(source) {
	const groupDeclarations = [
		...source.matchAll(
			new RegExp(
				String.raw`const (g_[A-Za-z0-9_]+) = program\.command\((${STRING_SOURCE})\)\.description\((${STRING_SOURCE})\);`,
				"g",
			),
		),
	];

	const groups = [];
	for (const [index, declaration] of groupDeclarations.entries()) {
		const variable = declaration[1];
		const name = decodeJsString(declaration[2]);
		const segmentStart = declaration.index ?? 0;
		const segmentEnd =
			groupDeclarations[index + 1]?.index ?? source.lastIndexOf("}\n");
		const segment = source.slice(segmentStart, segmentEnd);

		// Each command starts a `.command(...)` chain; split there so the
		// options and the API call that follow stay with their command.
		const commandPattern = new RegExp(
			String.raw`\n\t+\.command\((${STRING_SOURCE})\)`,
			"g",
		);
		const commandMatches = [...segment.matchAll(commandPattern)];
		const commands = [];

		for (const [commandIndex, match] of commandMatches.entries()) {
			const action = decodeJsString(match[1]);
			const bodyStart = (match.index ?? 0) + match[0].length;
			const bodyEnd =
				commandMatches[commandIndex + 1]?.index ?? segment.length;
			const body = segment.slice(bodyStart, bodyEnd);

			const optionPattern = new RegExp(
				String.raw`\.(requiredOption|option)\((${STRING_SOURCE})(?:,\s*(${STRING_SOURCE}))?\)`,
				"g",
			);
			const meta = parseCommandMeta(body);
			const options = [...body.matchAll(optionPattern)]
				.map(([, kind, rawFlag, rawDescription]) => {
					const flag = decodeJsString(rawFlag);
					const description =
						rawDescription === undefined
							? ""
							: decodeJsString(rawDescription);
					const { values: descriptionValues } = splitDescription(description);
					const flagName = flag.split(" ")[0].replace(/^--/, "");
					const declaredType = meta.types[flagName]?.replace(/\?$/, "");
					const type =
						declaredType ??
						(flag.includes("[boolean]")
							? "boolean"
							: flag.includes("<")
								? "string"
								: "boolean");
					return {
						flag,
						// `requiredOption` is not used by the generator: the command
						// enforces required inputs through the meta literal, which is
						// also what the usage line must reflect.
						required:
							kind === "requiredOption" ||
							meta.required.includes(flagName) ||
							description.includes("[required]"),
						values: meta.enums[flagName] ?? descriptionValues,
						type,
						isNumber: type === "number",
					};
				})
				.filter((option) => !GLOBAL_OPTIONS.has(option.flag.split(" ")[0]));

			// Generated commands call `runApiCommand(command, "group.action", "post", ...)`;
			// older output used `await apiGet("group.action")`.
			const generated = body.match(
				/runApiCommand\(\s*command,\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")/,
			);
			const legacy = body.match(/await (apiGet|apiPost)\("((?:[^"\\]|\\.)*)"/);

			commands.push({
				action,
				options,
				endpoint: generated
					? decodeJsString(generated[1])
					: legacy
						? decodeJsString(`"${legacy[2]}"`)
						: null,
				method: generated
					? decodeJsString(generated[2]).toUpperCase() === "GET"
						? "GET"
						: "POST"
					: legacy?.[1] === "apiGet"
						? "GET"
						: "POST",
			});
		}

		groups.push({ name, variable, commands });
	}

	return groups;
}
