import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

pkg.main = "./src/index.ts";

pkg.exports = {
	".": "./src/index.ts",
	"./api": "./src/api/index.ts",
	"./client": "./src/integration/client.ts",
};

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, "\t")}\n`);
console.log("Switched exports to use src for development");
