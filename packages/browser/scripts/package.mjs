import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(
	fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const manifest = JSON.parse(
	fs.readFileSync(path.join(root, "dist/manifest.json"), "utf8"),
);

if (manifest.version !== pkg.version) {
	console.error(`manifest ${manifest.version} != package.json ${pkg.version}`);
	process.exit(1);
}

const name = `notploy-browser-${pkg.version}.zip`;
const out = path.join(root, name);
if (fs.existsSync(out)) fs.rmSync(out);

let packaged = false;
try {
	execSync(`zip -r ${JSON.stringify(out)} .`, {
		cwd: path.join(root, "dist"),
		stdio: "inherit",
	});
	packaged = true;
} catch {
	// `zip` is not installed on every machine: fall back to the python3
	// stdlib so `pnpm package` stays portable.
	const fallback = [
		"import pathlib, sys, zipfile",
		"out = pathlib.Path(sys.argv[1])",
		"dist = pathlib.Path(sys.argv[2])",
		"out.unlink(missing_ok=True)",
		"z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)",
		"[(z.write(p, p.relative_to(dist).as_posix())) for p in sorted(dist.rglob('*')) if p.is_file()]",
		"z.close()",
	].join("; ");
	const result = spawnSync(
		"python3",
		["-c", fallback, out, path.join(root, "dist")],
		{
			stdio: "inherit",
		},
	);
	packaged = result.status === 0;
}

if (!packaged) {
	console.error("Neither `zip` nor the python3 fallback could package dist/.");
	process.exit(1);
}

// Fail the build if a secret-looking bundle sneaks in.
const distFiles = execSync(
	`grep -rIl --exclude-dir=node_modules -E "npk_[A-Za-z0-9_-]{6,}|x-api-key[\\"']?\\\\s*[:=]" dist || true`,
	{
		cwd: root,
		encoding: "utf8",
	},
).trim();
if (distFiles) {
	console.error(`possible secret in dist bundle:\n${distFiles}`);
	process.exit(1);
}

console.log(`packaged ${name}`);
