import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJsString, parseCommandsFile } from "../../../web/apps/docs/scripts/lib/cli-commands.mjs";

const source = `// Auto-generated

import type { Command } from "commander";
import { runApiCommand } from "../commands/run.js";

export function registerGeneratedCommands(program: Command) {
	const g_thing = program.command("thing").description("thing commands");
	g_thing
		.command("create")
		.description("Create a thing")
		.option("--name <value>", "Name [required]")
		.option("--kind <value>", "Kind [required] (alpha, beta)")
		.option("--enabled [boolean]", "Enabled [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "thing.create", "post", options, { required: ["name","kind","enabled"], enums: {"kind":["alpha","beta"]}, types: {"enabled":"boolean"} }),
		);
	g_thing
		.command("it's-complex")
		.description("Quote \\"handling\\" and apostrophes")
		.option("--ownerName <value>", "Owner Name")
		.action((options, command) =>
			runApiCommand(command, "thing.quote", "post", options),
		);
}
`;

test("parses every group, command, option and endpoint", () => {
	const groups = parseCommandsFile(source);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].name, "thing");
	assert.equal(groups[0].commands.length, 2);

	const create = groups[0].commands[0];
	assert.equal(create.action, "create");
	assert.equal(create.endpoint, "thing.create");
	assert.equal(create.method, "POST");
	assert.deepEqual(
		create.options.map((option) => option.flag),
		[
			"--name <value>",
			"--kind <value>",
			"--enabled [boolean]",
			"--profile <name>",
		],
	);
	assert.deepEqual(create.options[1].values, ["alpha", "beta"]);
	assert.equal(create.options[0].required, true);
	assert.equal(create.options[2].type, "boolean");
	assert.equal(create.options[2].required, true);
});

test("decodes escaped strings and keeps uppercase flag names", () => {
	const groups = parseCommandsFile(source);
	const command = groups[0].commands[1];
	assert.equal(command.action, "it's-complex");
	assert.equal(command.options[0].flag, "--ownerName <value>");
	assert.equal(decodeJsString('"a \\"b\\""'), 'a "b"');
});

test("returns no groups when the file does not contain generated commands", () => {
	assert.deepEqual(parseCommandsFile("export const x = 1;"), []);
});
