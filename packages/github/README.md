# @notploy/github

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](../../.github/CONTRIBUTING.md)

> Typed, testable GitHub integration layer for Notploy.

**`@notploy/github`** is the shared GitHub integration layer used by Notploy. It wraps Octokit behind a small typed surface — GitHub App authentication, installations, repositories, branches, commits, pull requests, deployments, deployment statuses, checks, releases and webhook verification — and defines the vocabulary the GitHub App and `notploy-actions` share. It is a library, **not** the deployment engine: it never builds, ships or orchestrates a deployment.

**Perfect for:** contributors wiring GitHub into Notploy, integrators reading its contract before calling the Notploy CI/CD API, and reviewers auditing how Notploy authenticates, verifies signatures and maps GitHub events.

## Contents

- [@notploy/github](#notploygithub)
  - [Contents](#contents)
  - [Why @notploy/github matters](#why-notploygithub-matters)
  - [What you can do](#what-you-can-do)
    - [Authenticate as a GitHub App](#authenticate-as-a-github-app)
    - [Read repositories, commits and pull requests](#read-repositories-commits-and-pull-requests)
    - [Publish checks, deployments and statuses](#publish-checks-deployments-and-statuses)
    - [Verify webhook deliveries](#verify-webhook-deliveries)
    - [Describe a deployment the same way everywhere](#describe-a-deployment-the-same-way-everywhere)
  - [Quick start](#quick-start)
    - [Install](#install)
    - [Create a client](#create-a-client)
    - [Verify a webhook delivery](#verify-a-webhook-delivery)
    - [Build an idempotency key](#build-an-idempotency-key)
  - [How @notploy/github is built](#how-notploygithub-is-built)
    - [Package layout](#package-layout)
    - [Error model](#error-model)
    - [GitHub App permissions](#github-app-permissions)
    - [Rate limits and retries](#rate-limits-and-retries)
  - [Development](#development)
    - [Package commands](#package-commands)
    - [Container image](#container-image)
  - [FAQ](#faq)
    - [Is this a stable public SDK?](#is-this-a-stable-public-sdk)
    - [Does it deploy anything?](#does-it-deploy-anything)
    - [Which GitHub instances are supported?](#which-github-instances-are-supported)
    - [Where are deployment modes documented?](#where-are-deployment-modes-documented)
  - [Related resources](#related-resources)
    - [Official](#official)
    - [Community](#community)
  - [Contributing](#contributing)
  - [Security](#security)
  - [License](#license)
  - [Note](#note)

## Why @notploy/github matters

🎯 **One integration layer, two entry points** — The GitHub App and `notploy-actions` use the same package, the same typed events and the same deployment vocabulary, so they cannot drift into separate implementations.

🔒 **Secure by default** — Webhook signatures are verified against the exact raw request bytes with a constant-time comparison, payload size is bounded, and credentials are supplied at runtime only. Errors never embed tokens or private keys.

🧩 **Typed instead of stringly** — GitHub responses are mapped to domain models (`GitHubRepository`, `GitHubDeployment`, `GitHubCheckRun`, …) and webhook payloads to a discriminated union, so consumers narrow on `event.type` rather than on raw JSON.

🔍 **Observable by construction** — Delivery ids, repository identities, refs, commit SHAs, pull request numbers and actors are part of the contract, which is what makes a GitHub event traceable to a Notploy deployment and back.

🧪 **Tested on the security-critical paths** — Signature verification, tampered bodies, missing headers, oversized payloads, duplicate deliveries, token handling and error translation all have regression tests.

📦 **No policy, no database, no queue** — Deployment policy, persistence, authorization and job orchestration stay in Notploy. The package stays reusable.

## What you can do

### Authenticate as a GitHub App

Exchange an App JWT for a scoped installation access token, or bring your own token. PEM keys provided through environment variables with escaped newlines are normalized. Credentials are never logged, persisted or included in error messages.

### Read repositories, commits and pull requests

List the repositories an installation can actually access, resolve a branch, tag or SHA to an exact commit, read pull requests and their files, and check a user's permission level on a repository — the primitive Notploy uses to gate preview deployments from forks.

### Publish checks, deployments and statuses

Create GitHub Deployments and their statuses, create and update check runs, and comment on pull requests, with strongly typed states and conclusions.

### Verify webhook deliveries

Validate `X-Hub-Signature-256`, `X-GitHub-Event` and `X-GitHub-Delivery`, then parse the payload into a typed event. The package verifies and parses; **persisting the delivery id and deduplicating is the application's job** — Notploy does it in `github_webhook_delivery`.

### Describe a deployment the same way everywhere

The `contract` module names repository and installation identities, refs, deployment origins (`github_app`, `github_actions`, `manual`, `api`, `schedule`), correlation metadata and a deterministic idempotency key. It performs no I/O, so both entry points can depend on it without pulling in policy.

## Quick start

### Install

```bash
pnpm add @notploy/github
```

### Create a client

```ts
import { createGitHubClient } from "@notploy/github";

const github = createGitHubClient({
  auth: {
    app: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    },
    installationId: process.env.GITHUB_INSTALLATION_ID,
  },
});

const repositories = await github.installations.listRepositories();
const comparison = await github.commits.compare({
  owner: "skygenesisenterprise",
  repository: "notploy",
  base: "v1.0.0",
  head: "main",
});
```

Or with a token you already hold:

```ts
const github = createGitHubClient({
  auth: { token: process.env.GITHUB_TOKEN! },
});
```

For GitHub Enterprise Server or a `*.ghe.com` tenant, pass `auth.baseUrl` (for example `https://github.acmecorp.com/api/v3`). The App authentication chain is also available directly:

```ts
import { createGitHubAppAuth, createInstallationAuth } from "@notploy/github";

const appAuth = await createGitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
});

const installationAuth = await createInstallationAuth({
  credentials: {
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  },
  installationId: 12345678,
});

console.log(installationAuth.token); // use immediately, never store it
```

### Verify a webhook delivery

Disable the framework body parser first: the HMAC is computed over the bytes GitHub sent, so a parsed and re-serialized body will never match.

```ts
import { WebhooksNamespace } from "@notploy/github";

const webhooks = new WebhooksNamespace({
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
  // maxPayloadBytes defaults to 25 MB
});

// `rawBody` is the exact request body, not `JSON.stringify(req.body)`.
const { event, eventName, deliveryId } = await webhooks.receive({
  payload: rawBody,
  headers: req.headers,
});

switch (event.type) {
  case "push":
    console.log(`Push on ${event.repository.fullName} (${event.after})`);
    break;
  case "pull_request":
    console.log(`PR #${event.number} ${event.action}`);
    break;
  case "installation":
    console.log(`Installation ${event.action}`);
    break;
  default:
    break;
}
```

`receive` requires all three headers (`invalid_headers`), rejects empty (`malformed_payload`) and oversized (`payload_too_large`) bodies, and only parses JSON after the signature check.

Without the combined helper:

```ts
const isValid = await webhooks.verify({ payload: rawBody, signature });
if (!isValid) return new Response("Invalid signature", { status: 401 });

const event = webhooks.parse({ payload: rawBody, eventName });
```

Supported typed events: `push`, `pull_request`, `installation`, `installation_repositories`, `repository`, `release`, `workflow_run`.

### Build an idempotency key

```ts
import { buildDeploymentIdempotencyKey, parseGitRef } from "@notploy/github";

parseGitRef("refs/heads/main");    // { kind: "branch", name: "main", … }
parseGitRef("refs/tags/v1.0.0");   // { kind: "tag", name: "v1.0.0", … }
parseGitRef("refs/pull/42/merge"); // null — never guessed as a branch

const idempotencyKey = buildDeploymentIdempotencyKey({
  origin: "github_app",
  repository: { owner: "acme", name: "api" },
  commitSha,
  environment: "production",
  deliveryId, // X-GitHub-Delivery
});
```

Because the key includes the event discriminator, a redelivery is recognised as a duplicate while a new push, a re-run workflow or a manual redeploy still deploy. `buildDeploymentIdempotencyKey` returns `undefined` for `manual`, `api` and `schedule`: no key is invented for a deliberately repeatable deployment.

## How @notploy/github is built

A dependency-light ESM package compiled with `tsc`. `src/index.ts` is the only public entry point (plus the `./dist` types); importing it has no side effects, reads no environment variable and opens no connection. Octokit never leaks into the public contract except through the documented `octokit` escape hatch and the option types.

The GitHub App webhook receiver, the installation UI and the deployment policy live in **`apps/notploy`**, which consumes this package. `@notploy/github` is the integration layer, nothing more.

### Package layout

```text
packages/github/
├── src/
│   ├── auth/            # App JWT → installation access tokens
│   ├── client/          # Octokit wrapper, error translation, rate limits
│   │   └── namespaces/  # installations, repositories, branches, commits,
│   │                    # pull requests, deployments, checks, releases
│   ├── contract/        # shared deployment vocabulary (no I/O)
│   ├── errors/          # structured, credential-free errors
│   ├── types/           # domain models and payload mappers
│   ├── webhooks/        # raw-body signature verification, typed events
│   └── index.ts         # public exports
├── tests/               # vitest suites, including security regressions
├── Dockerfile           # standalone GitHub App service image
├── docker-compose.yml   # local service stack
└── Makefile             # local and Docker tasks
```

| Namespace | Purpose |
| --- | --- |
| `github.installations` | Installation metadata, accessible repositories, repository selection changes |
| `github.repositories` | Repository details and a user's permission level |
| `github.branches` / `github.commits` | Branch listing, ref resolution, commit comparison |
| `github.pullRequests` | Pull requests, changed files, preview comments |
| `github.deployments` | GitHub Deployments and deployment statuses |
| `github.checks` | Check runs created and updated by Notploy |
| `github.releases` | Release metadata for tag-driven workflows |
| `github.rateLimit()` | Primary rate-limit snapshot for the current credentials |

### Error model

Every failure extends `GitHubError` and exposes only request-scoped metadata — never a token, private key or webhook secret.

| Error | Meaning |
| --- | --- |
| `GitHubAuthenticationError` | Invalid or expired credentials (401), or App authentication failed |
| `GitHubAuthorizationError` | Insufficient permissions (403) |
| `GitHubNotFoundError` | Missing resource, or not visible to the installation (404) |
| `GitHubRateLimitError` | Primary or secondary rate limit hit, with `rateLimit.remaining` / `resetAt` |
| `GitHubApiError` | Any other API failure, with `status`, `code`, `requestId` |
| `GitHubWebhookError` | Invalid signature, headers, size, unsupported event or malformed payload |
| `GitHubConfigurationError` | Missing or invalid client configuration |

```ts
import { GitHubNotFoundError, GitHubRateLimitError } from "@notploy/github";

try {
  await github.repositories.get({ owner: "acme", repository: "missing" });
} catch (error) {
  if (error instanceof GitHubRateLimitError) {
    console.log(`Rate limited until ${error.rateLimit?.resetAt}`);
  } else if (error instanceof GitHubNotFoundError) {
    console.log(`Not found (request id: ${error.requestId})`);
  }
}
```

### GitHub App permissions

Least privilege only. Notploy never asks for write access to code, organization administration or webhook management.

| Permission | Access | Why it is needed |
| --- | --- | --- |
| `Contents` | Read | Clone the repository, read commits, branches and tags |
| `Metadata` | Read | Mandatory for any GitHub API use |
| `Pull requests` | Read & write | Read pull requests, publish preview deployment comments |
| `Deployments` | Read & write | Publish GitHub Deployments and their statuses |
| `Checks` | Read & write | Publish Notploy build/deployment check runs |
| `Administration` (collaborators) | Read | Verify a pull request author's permission level |

Subscribed webhook events stay narrow: `push`, `pull_request`, `installation` and `installation_repositories` (plus `ping`, which GitHub always sends). Rationale and the Self/Cloud configuration are documented in [`apps/notploy/docs/issue-115-github-integration.md`](../../apps/notploy/docs/issue-115-github-integration.md).

### Rate limits and retries

The package exposes rate-limit information and applies bounded, predictable retries for transient failures (`retry.maxRetries`, default 1, and a single retry after a primary rate limit). Durable queues, backoff schedules and replay belong to the caller: a library should not invent a job engine.

```ts
const rateLimit = await github.rateLimit();
console.log(rateLimit.limit, rateLimit.remaining, rateLimit.resetAt);
```

## Development

The package uses **Node.js 20 or later** and **pnpm 10.22 or later**. Install dependencies from the repository root so the workspace stays consistent:

```bash
pnpm install --frozen-lockfile
```

### Package commands

| Command | Purpose |
| --- | --- |
| `pnpm --filter @notploy/github build` | Compile to `dist/` with `tsc` |
| `pnpm --filter @notploy/github dev` | Rebuild on change |
| `pnpm --filter @notploy/github test` | Run the vitest suite |
| `pnpm --filter @notploy/github typecheck` | Type-check without emitting |
| `pnpm --filter @notploy/github lint` | Run Biome checks |
| `make check` | Lint + typecheck + tests, from `packages/github` |

Add a test for every change that touches signature verification, token handling, event mapping or error translation: those paths are security-relevant. No workflow currently runs this package's checks, so run `make check` before opening a pull request; wiring it into CI is tracked as part of the integration roadmap.

### Container image

The standalone GitHub App service (webhook receiver plus installation sync) is packaged in its own image, referenced by `docker-publish.yml` as `notploy-github`:

```bash
cd packages/github
cp .env.example .env    # fill in GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET

make docker-build       # build notploy-github:local (context is the repo root)
make docker-up          # start the service with docker compose
make docker-logs        # follow logs
make docker-down        # stop
```

Runtime configuration: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_WEBHOOK_SECRET` are required; `GITHUB_INSTALLATION_ID`, `GITHUB_BASE_URL`, `NOTPLOY_API_URL` and `EXTERNAL_PORT` are optional. Nothing secret is baked into the image, the container runs as the non-root `node` user, and its `HEALTHCHECK` queries `/health` locally without exposing data.

## FAQ

### Is this a stable public SDK?

No. `@notploy/github` is an internal monorepo library that is also published. The `contract` module is versioned and additive, but no public semver guarantee or deprecation policy exists yet. Treat the rest of the surface as internal until that decision is made.

### Does it deploy anything?

No. It talks to GitHub on Notploy's behalf. Building, shipping, status transitions, authorization and persistence are implemented in Notploy (`apps/notploy`, `packages/server`).

### Which GitHub instances are supported?

GitHub.com is the tested target. GitHub Enterprise Server and `*.ghe.com` tenants work through the provider adapter (`deriveGithubApiUrl`) but are not covered by end-to-end tests, so they are not promised support yet.

### Where are deployment modes documented?

See [`apps/notploy/docs/issue-115-github-integration.md`](../../apps/notploy/docs/issue-115-github-integration.md) for Auto Deploy, workflow-driven, hybrid and preview modes, the idempotency contract, webhook security and the remaining roadmap.

## Related resources

### Official

- Product documentation: [docs.notploy.com](https://docs.notploy.com)
- Website: [notploy.com](https://notploy.com)
- Hosted platform: [app.notploy.com](https://app.notploy.com)
- Root project README: [`README.md`](../../README.md)
- GitHub integration audit and contract: [`apps/notploy/docs/issue-115-github-integration.md`](../../apps/notploy/docs/issue-115-github-integration.md)
- CI/CD API consumed by workflows: [`apps/notploy/server/api/routers/cicd.ts`](../../apps/notploy/server/api/routers/cicd.ts)
- GitHub Action: [skygenesisenterprise/notploy-actions](https://github.com/skygenesisenterprise/notploy-actions)

### Community

- Questions and discussions: [Notploy Discord](https://discord.gg/GUkDugVh34)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)
- Contribution guide: [`.github/CONTRIBUTING.md`](../../.github/CONTRIBUTING.md)

## Contributing

Contributions are welcome. Read the [Code of Conduct](../../CODE_OF_CONDUCT.md) before participating, then follow the [contribution guide](../../.github/CONTRIBUTING.md).

- Keep PR titles in [Conventional Commits](https://www.conventionalcommits.org) format (`fix: …`, `feat: …`, `docs: …`).
- Add a changeset with `pnpm changeset` when the change is user-facing.
- Run `pnpm --filter @notploy/github lint`, `typecheck` and `test` before opening a pull request.
- Never commit real App credentials, installation tokens or webhook secrets — tests use obvious placeholder values.

## Security

Do not report security vulnerabilities in public issues. Follow the private reporting instructions in [SECURITY.md](../../SECURITY.md). When changing signature verification, delivery handling or credential handling, include a regression test with the fix.

## License

`@notploy/github` is licensed under the [MIT License](LICENSE). The Notploy platform itself is licensed under Apache 2.0; see the [root license](../../LICENSE) for details.

## Note

Notploy is an open-source project maintained by [Sky Genesis Enterprise](https://skygenesisenterprise.com). Links to external services are provided for convenience and do not imply endorsement. Check each service's own terms before relying on it in production.
