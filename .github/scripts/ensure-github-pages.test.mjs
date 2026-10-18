/**
 * Local tests for ensure-github-pages.mjs against a mock GitHub API.
 * Run with: node --test .github/scripts/ensure-github-pages.test.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"ensure-github-pages.mjs",
);
const TOKEN = "ghp_TEST_TOKEN_MUST_NEVER_APPEAR_IN_OUTPUT";
const PAGES_PATH = "/repos/owner/repo/pages";

function sequence(...responses) {
	let index = 0;
	return () => responses[Math.min(index++, responses.length - 1)];
}

function startServer(routes) {
	const requests = [];
	const server = createServer((req, res) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += chunk;
		});
		req.on("end", () => {
			requests.push({
				method: req.method,
				path: req.url,
				body: raw ? JSON.parse(raw) : null,
			});
			const handler = routes[`${req.method} ${req.url}`];
			if (!handler) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ message: "No mock for this route" }));
				return;
			}
			const { status = 200, body = {} } = handler();
			res.writeHead(status, { "Content-Type": "application/json" });
			res.end(JSON.stringify(body));
		});
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			resolve({ server, port: server.address().port, requests });
		});
	});
}

async function run(routes, extraEnv = {}) {
	const { server, port, requests } = await startServer(routes);
	try {
		// spawn (not spawnSync): the mock API server runs on this same event
		// loop and could not answer the child while it is blocked.
		const result = await new Promise((resolve, reject) => {
			const child = spawn(process.execPath, [SCRIPT], {
				env: {
					...process.env,
					GITHUB_API_URL: `http://127.0.0.1:${port}`,
					PAGES_REPOSITORY: "owner/repo",
					PAGES_TOKEN: TOKEN,
					PAGES_EXPECTED_CNAME: "docs.notploy.com",
					PAGES_DOMAIN: "https://docs.notploy.com",
					...extraEnv,
				},
			});
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.on("error", reject);
			child.on("close", (status) => resolve({ status, stdout, stderr }));
		});
		const output = `${result.stdout}${result.stderr}`;
		assert.ok(!output.includes(TOKEN), "the token value must never be printed");
		return {
			status: result.status,
			stdout: result.stdout,
			stderr: result.stderr,
			requests,
		};
	} finally {
		server.closeAllConnections();
		server.close();
	}
}

const healthy = {
	build_type: "legacy",
	branch: "gh-pages",
	cname: "docs.notploy.com",
	https_enforced: true,
};

test("already configured: verified without any write request", async () => {
	const { status, stdout, requests } = await run({
		[`GET ${PAGES_PATH}`]: () => ({ body: { ...healthy } }),
	});
	assert.equal(status, 0);
	assert.match(stdout, /Pages publishes branch 'gh-pages'/);
	assert.ok(requests.every((r) => r.method === "GET"));
});

test("Pages disabled: enabled from the publishing branch", async () => {
	const { status, stdout, requests } = await run({
		[`GET ${PAGES_PATH}`]: sequence(
			{ status: 404, body: { message: "Not Found" } },
			{ body: { ...healthy } },
		),
		[`POST ${PAGES_PATH}`]: () => ({ status: 201, body: {} }),
	});
	assert.equal(status, 0);
	assert.match(stdout, /GitHub Pages enabled/);
	const post = requests.find((r) => r.method === "POST");
	assert.deepEqual(post.body, { source: { branch: "gh-pages", path: "/" } });
});

test("wrong branch and build type: repaired idempotently", async () => {
	const { status, stdout, requests } = await run({
		[`GET ${PAGES_PATH}`]: sequence(
			{
				body: {
					build_type: "workflow",
					branch: "master",
					cname: "docs.notploy.com",
				},
			},
			{ body: { ...healthy } },
		),
		[`PUT ${PAGES_PATH}`]: () => ({ body: {} }),
	});
	assert.equal(status, 0);
	assert.match(stdout, /Repairing the Pages settings/);
	const put = requests.find((r) => r.method === "PUT");
	assert.deepEqual(put.body, {
		build_type: "legacy",
		source: { branch: "gh-pages", path: "/" },
	});
});

test("missing Pages scope: fails and names the permission and environment", async () => {
	const { status, stderr } = await run({
		[`GET ${PAGES_PATH}`]: () => ({
			status: 403,
			body: { message: "Resource not accessible by integration" },
		}),
	});
	assert.equal(status, 1);
	assert.match(stderr, /::error::/);
	assert.match(stderr, /Pages: Read and write/);
});

test("custom domain mismatch: warning only, no mutation", async () => {
	const { status, stderr, requests } = await run({
		[`GET ${PAGES_PATH}`]: () => ({
			body: { ...healthy, cname: "old.example.com" },
		}),
	});
	assert.equal(status, 0);
	assert.match(stderr, /::warning::/);
	assert.match(stderr, /old\.example\.com/);
	assert.match(stderr, /docs\.notploy\.com/);
	assert.ok(requests.every((r) => r.method === "GET"));
});

test("cannot enable Pages: surfaces the exact manual setup", async () => {
	const { status, stderr } = await run({
		[`GET ${PAGES_PATH}`]: () => ({
			status: 404,
			body: { message: "Not Found" },
		}),
		[`POST ${PAGES_PATH}`]: () => ({
			status: 422,
			body: { message: "Branch not found" },
		}),
	});
	assert.equal(status, 1);
	assert.match(stderr, /::error::/);
	assert.match(stderr, /Settings -> Pages/);
	assert.match(stderr, /gh-pages/);
});

test("Enforce HTTPS off: repaired when the API accepts it", async () => {
	const { status, stdout, requests } = await run({
		[`GET ${PAGES_PATH}`]: sequence(
			{ body: { ...healthy, https_enforced: false } },
			{ body: { ...healthy, https_enforced: true } },
		),
		[`PUT ${PAGES_PATH}`]: () => ({ body: { https_enforced: true } }),
	});
	assert.equal(status, 0);
	assert.match(stdout, /HTTPS enforcement enabled/);
	const put = requests.find((r) => r.method === "PUT");
	assert.deepEqual(put.body, { https_enforced: true });
});

test("Enforce HTTPS not accepted: warning, still a successful run", async () => {
	const { status, stderr } = await run({
		[`GET ${PAGES_PATH}`]: () => ({
			body: { ...healthy, https_enforced: false },
		}),
		[`PUT ${PAGES_PATH}`]: () => ({
			status: 422,
			body: { message: "Certificate is not ready" },
		}),
	});
	assert.equal(status, 0);
	assert.match(stderr, /::warning::/);
	assert.match(stderr, /Enforce HTTPS/);
});
