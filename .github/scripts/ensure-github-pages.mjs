#!/usr/bin/env node
/**
 * Verifies the GitHub Pages publication settings of one repository and
 * repairs, with the permissions of the supplied token, what can be repaired
 * automatically. Idempotent: it only sends a write request when the current
 * state differs from the expected state, so running it twice is a no-op.
 *
 * Intended use: run it as the last step of a deployment job, AFTER the
 * publishing branch has been pushed, so the branch already exists the first
 * time GitHub Pages has to be enabled.
 *
 * Three distinct things are kept separate here, on purpose:
 *   1. the GitHub Actions environment of the job (website/documentation) —
 *      a deployment context, configured in the workflow;
 *   2. the publishing target (repository + branch) — what this script reads
 *      and repairs through the API;
 *   3. the custom domain — bound on the hosting platform through the CNAME
 *      file published in the branch and through Settings -> Pages. DNS and
 *      domain verification are external and are never modified: a domain
 *      mismatch is only reported as a warning.
 *
 * Environment:
 *   PAGES_REPOSITORY           required, owner/repo of the publishing target
 *   PAGES_TOKEN                required, token with contents:write and
 *                              pages:read/write on PAGES_REPOSITORY.
 *                              Its value is never printed.
 *   PAGES_EXPECTED_BRANCH      default "gh-pages"
 *   PAGES_EXPECTED_BUILD_TYPE  default "legacy"
 *   PAGES_EXPECTED_CNAME       optional, expected custom domain (warn-only)
 *   PAGES_DOMAIN               optional, deployment URL for messages
 *   GITHUB_API_URL             default "https://api.github.com"
 *
 * Exit codes: 0 = verified (warnings allowed), 1 = unverifiable/unrepairable,
 * with a ::error:: annotation naming the missing permission or the exact
 * manual setting.
 */

const repository = (process.env.PAGES_REPOSITORY ?? "").trim();
const token = (process.env.PAGES_TOKEN ?? "").trim();
const expectedBranch = process.env.PAGES_EXPECTED_BRANCH || "gh-pages";
const expectedBuildType = process.env.PAGES_EXPECTED_BUILD_TYPE || "legacy";
const expectedCname = (process.env.PAGES_EXPECTED_CNAME ?? "").trim();
const domain = (process.env.PAGES_DOMAIN ?? "").trim();
const apiBase = (
	process.env.GITHUB_API_URL || "https://api.github.com"
).replace(/\/+$/, "");

function fail(message) {
	console.error(`::error::${message}`);
	process.exit(1);
}

function warn(message) {
	console.error(`::warning::${message}`);
}

function notice(message) {
	console.log(`::notice::${message}`);
}

function suffix(message) {
	return message ? `: ${message}` : "";
}

if (!repository) {
	fail(
		"PAGES_REPOSITORY is required and must name the Pages publishing target (owner/repo).",
	);
}
if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repository)) {
	fail(
		`PAGES_REPOSITORY ('${repository}') is not in the required 'owner/repo' format.`,
	);
}
if (!token) {
	fail(
		"PAGES_TOKEN is required (token with contents:write and pages:read/write on " +
			`${repository}). Its value is never printed.`,
	);
}

const target = domain ? `${repository} (${domain})` : repository;
const manualSetup = `${repository} -> Settings -> Pages -> "Deploy from a branch", branch ${expectedBranch}, folder "/ (root)".`;

async function api(path, { method = "GET", body } = {}) {
	let response;
	try {
		response = await fetch(`${apiBase}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
	} catch (error) {
		fail(`Could not reach the GitHub API for ${path}: ${error.message}.`);
	}
	const text = await response.text();
	let json = null;
	if (text) {
		try {
			json = JSON.parse(text);
		} catch {
			json = null;
		}
	}
	const message = json && typeof json.message === "string" ? json.message : "";
	return { status: response.status, json, message };
}

function readSettings() {
	return api(`/repos/${repository}/pages`);
}

async function requireReadable({ status, message }) {
	if (status === 200) return;
	if (status === 401) {
		fail(
			`The token was rejected by the GitHub API while reading the Pages settings of ${target} ` +
				"(HTTP 401). Check the token value and its expiration; the value is never printed.",
		);
	}
	if (status === 403) {
		fail(
			`The token cannot read the Pages settings of ${target} (HTTP 403${suffix(message)}). ` +
				`Grant it "Pages: Read and write" on ${repository} ` +
				"(fine-grained PAT: repository access limited to that repository; " +
				"classic PAT: 'repo' scope; GITHUB_TOKEN: pages: write permission) " +
				"so this deployment can verify and repair its publication settings.",
		);
	}
	if (status === 404) return;
	fail(
		`Unexpected HTTP ${status} while reading the Pages settings of ${target}${suffix(message)}.`,
	);
}

let settings = await readSettings();
await requireReadable(settings);

if (settings.status === 404) {
	notice(
		`GitHub Pages is not enabled on ${target}; enabling it with source branch '${expectedBranch}'.`,
	);
	const created = await api(`/repos/${repository}/pages`, {
		method: "POST",
		body: { source: { branch: expectedBranch, path: "/" } },
	});
	if (created.status !== 200 && created.status !== 201) {
		if (created.status === 403 || created.status === 422) {
			fail(
				`Could not enable GitHub Pages on ${target} (HTTP ${created.status}${suffix(created.message)}). ` +
					`Grant the token "Pages: Read and write", or configure Pages manually: ${manualSetup}`,
			);
		}
		fail(
			`Unexpected HTTP ${created.status} while enabling GitHub Pages on ${target}${suffix(created.message)}.`,
		);
	}
	settings = await readSettings();
	if (settings.status !== 200) {
		fail(
			`GitHub Pages was enabled on ${target} but its settings could not be read back ` +
				`(HTTP ${settings.status}${suffix(settings.message)}).`,
		);
	}
	notice(`GitHub Pages enabled on ${target} from branch '${expectedBranch}'.`);
}

let site = settings.json;
const currentBranch = site.branch ?? "";
const currentBuildType = site.build_type || "legacy";

if (
	currentBuildType !== expectedBuildType ||
	currentBranch !== expectedBranch
) {
	notice(
		`Repairing the Pages settings of ${target}: build type '${currentBuildType}' -> ` +
			`'${expectedBuildType}', source branch '${currentBranch || "none"}' -> '${expectedBranch}'.`,
	);
	const updated = await api(`/repos/${repository}/pages`, {
		method: "PUT",
		body: {
			build_type: expectedBuildType,
			source: { branch: expectedBranch, path: "/" },
		},
	});
	if (updated.status !== 200) {
		fail(
			`Could not repair the Pages settings of ${target} (HTTP ${updated.status}${suffix(updated.message)}). ` +
				`Grant the token "Pages: Read and write", or configure Pages manually: ${manualSetup}`,
		);
	}
	const reread = await readSettings();
	if (reread.status !== 200) {
		fail(
			`The Pages settings of ${target} were updated but could not be read back ` +
				`(HTTP ${reread.status}${suffix(reread.message)}).`,
		);
	}
	site = reread.json;
	if (
		(site.build_type || "legacy") !== expectedBuildType ||
		(site.branch ?? "") !== expectedBranch
	) {
		fail(
			`The Pages settings of ${target} still report branch ` +
				`'${site.branch ?? "none"}' / build type '${site.build_type || "legacy"}' after the update. ` +
				`Configure Pages manually: ${manualSetup}`,
		);
	}
	notice(
		`Pages settings of ${target} now publish branch '${expectedBranch}' (build type '${expectedBuildType}').`,
	);
}

// Custom domain: reported only. It is bound through the CNAME file that the
// deployment just published and through Settings -> Pages; DNS records and
// organisation domain verification live outside this repository and are never
// changed here.
const currentCname = (site.cname ?? "").trim();
if (expectedCname) {
	if (currentCname === "") {
		warn(
			`No custom domain is recorded yet on the Pages site of ${target}. The deployment just ` +
				`published a CNAME file containing '${expectedCname}'; GitHub binds the domain once the ` +
				`Pages build has completed. If it stays empty: ${repository} -> Settings -> Pages -> ` +
				`Custom domain '${expectedCname}' (an organisation repository first needs the domain ` +
				"verified under organisation Settings -> Domains, which requires a DNS TXT record " +
				"and cannot be automated from a workflow).",
		);
	} else if (currentCname !== expectedCname) {
		warn(
			`The Pages custom domain of ${target} is '${currentCname}' but '${expectedCname}' is expected. ` +
				`Review ${repository} -> Settings -> Pages -> Custom domain and the DNS records before ` +
				"changing anything: this workflow never modifies DNS.",
		);
	}
}

if (site.https_enforced === false) {
	const enforced = await api(`/repos/${repository}/pages`, {
		method: "PUT",
		body: { https_enforced: true },
	});
	if (enforced.status === 200) {
		notice(`HTTPS enforcement enabled on ${target}.`);
	} else {
		warn(
			`Could not enforce HTTPS on ${target} (HTTP ${enforced.status}${suffix(enforced.message)}). ` +
				"Enable 'Enforce HTTPS' in Settings -> Pages once the certificate for the custom " +
				"domain has been issued.",
		);
	}
}

const publishedCname =
	currentCname || (expectedCname ? `${expectedCname} (pending)` : "none");
notice(
	`${target}: Pages publishes branch '${expectedBranch}' (build type '${expectedBuildType}'), ` +
		`custom domain '${publishedCname}'.`,
);
