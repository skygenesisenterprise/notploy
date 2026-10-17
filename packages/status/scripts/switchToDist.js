import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

pkg.main = "./dist/index.js";

pkg.exports = {
	".": {
		import: "./dist/index.js",
		default: "./dist/index.js",
	},
	"./api": {
		import: "./dist/api/index.js",
		default: "./dist/api/index.js",
	},
	"./client": {
		import: "./dist/client.js",
		default: "./dist/client.js",
	},
};

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, "\t")}\n`);
console.log("Switched exports to use dist for production");
