# Notploy CLI

[![License: MIT](https://img.shields.io/github/license/skygenesisenterprise/notploy?label=license)](LICENSE.md)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![npm](https://img.shields.io/npm/v/@notploy/cli?label=%40notploy%2Fcli)](https://www.npmjs.com/package/@notploy/cli)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/skygenesisenterprise/notploy/blob/master/.github/CONTRIBUTING.md)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/GUkDugVh34)

> Manage a Notploy instance from the terminal, a script or a CI pipeline.

**Notploy CLI** (`@notploy/cli`) is the official command-line interface for Notploy. It connects to a local, self-hosted or remote Notploy instance, stores credentials in named profiles, exposes **604 generated API commands across 57 command groups**, and adds developer workflows such as `doctor`, `server info`, profile management and a validated optional project manifest.

The CLI is designed for automation first: machine-readable JSON stays on stdout, diagnostics go to stderr, exit codes are stable, requests have explicit timeouts, and credentials are never printed by default.

**Perfect for:** developers deploying from a terminal, platform teams scripting Notploy operations, CI/CD pipelines, and anyone who wants repeatable access to the Notploy API without hand-written HTTP calls.

## Contents

- [Notploy CLI](#notploy-cli)
  - [Contents](#contents)
  - [Why use the Notploy CLI](#why-use-the-notploy-cli)
  - [What you can do](#what-you-can-do)
    - [Connect](#connect)
    - [Operate](#operate)
    - [Automate](#automate)
    - [Diagnose](#diagnose)
  - [Installation](#installation)
    - [Requirements](#requirements)
    - [Global install](#global-install)
    - [Run without installing](#run-without-installing)
  - [Quick start](#quick-start)
  - [Authentication and profiles](#authentication-and-profiles)
    - [Create an API key](#create-an-api-key)
    - [Authenticate](#authenticate)
    - [Named profiles](#named-profiles)
    - [Profile commands](#profile-commands)
    - [Environment variables](#environment-variables)
    - [Configuration precedence](#configuration-precedence)
    - [Configuration location](#configuration-location)
    - [Using `.env`](#using-env)
  - [Commands](#commands)
    - [Global options](#global-options)
    - [Generated API commands](#generated-api-commands)
    - [Option types](#option-types)
    - [Auth commands](#auth-commands)
    - [Doctor](#doctor)
    - [Server info](#server-info)
    - [Examples](#examples)
  - [JSON output and exit codes](#json-output-and-exit-codes)
    - [JSON mode](#json-mode)
    - [Error shape](#error-shape)
    - [Exit codes](#exit-codes)
    - [Non-interactive behavior](#non-interactive-behavior)
    - [Timeouts and interruption](#timeouts-and-interruption)
  - [Project manifest](#project-manifest)
    - [Manifest schema](#manifest-schema)
    - [Environment-specific values](#environment-specific-values)
    - [Manifest rules](#manifest-rules)
  - [CI/CD](#cicd)
    - [GitHub Actions](#github-actions)
    - [Generic shell](#generic-shell)
  - [Generated command reference](#generated-command-reference)
  - [Roadmap and boundaries](#roadmap-and-boundaries)
  - [Development](#development)
    - [Setup](#setup)
    - [Package scripts](#package-scripts)
    - [Package layout](#package-layout)
    - [Updating generated commands](#updating-generated-commands)
    - [Tests](#tests)
  - [FAQ](#faq)
    - [Is the CLI free?](#is-the-cli-free)
    - [Does it work with self-hosted instances?](#does-it-work-with-self-hosted-instances)
    - [Where are my credentials stored?](#where-are-my-credentials-stored)
    - [Why did a command return exit code 4?](#why-did-a-command-return-exit-code-4)
    - [How do I report a bug?](#how-do-i-report-a-bug)
  - [Related resources](#related-resources)
    - [Official](#official)
    - [Community](#community)
    - [Commercial](#commercial)
  - [Contributing](#contributing)
  - [Security](#security)
  - [License](#license)
  - [Note](#note)

## Why use the Notploy CLI

🎯 **Instance-aware** — connect to `localhost`, a self-hosted panel or a remote Notploy instance. Named profiles keep staging and production credentials separate.

🤖 **Automation-safe** — `--json` writes one valid JSON document to stdout with no banners or spinners. Human diagnostics go to stderr. Exit codes distinguish usage, auth, API and timeout failures.

🔐 **Secure by default** — credentials live in a user-only configuration file (mode `0600` where supported), profile inspection is redacted, and error output never includes API keys or request headers.

⏱️ **Predictable HTTP behavior** — every request has a configurable timeout (`--timeout` or `NOTPLOY_TIMEOUT`), and network, HTTP, tRPC and validation errors are normalized.

🧩 **API coverage without hand-written HTTP** — 604 commands are generated from the maintained Notploy OpenAPI specification. Arrays, objects, enums, nullable fields and required options are understood by the CLI.

🩺 **Diagnosable** — `notploy doctor` checks configuration, permissions, manifest validity, connectivity, authentication and timeouts before your pipeline fails halfway through a deployment.

📄 **Project-friendly** — an optional `notploy.yaml` supplies non-secret project, environment and application identifiers. Raw secrets are rejected by design.

## What you can do

### Connect

- Authenticate against a Notploy instance with an API key.
- Store multiple named profiles such as `local`, `staging` and `production`.
- Select a profile per command or through `NOTPLOY_PROFILE`.
- Verify credentials without changing the selected profile.
- Use environment variables for CI jobs that never write credentials to disk.

### Operate

- Inspect projects, applications, environments, servers, deployments, databases and backups.
- Create, update, start, stop, redeploy and delete resources through generated commands.
- Read application and deployment logs, trigger backups and manage domains, certificates and redirects.
- Work with Docker Compose projects, clusters, registries and SSH keys.

### Automate

- Emit machine-readable JSON for `jq`, scripts and pipeline steps.
- Fail with stable exit codes instead of parsing human messages.
- Supply project and environment identifiers through flags, environment variables or `notploy.yaml`.
- Avoid interactive prompts automatically when stdin is not a TTY or `CI=true`.

### Diagnose

- Run `notploy doctor` before a deployment to validate the full connection path.
- Inspect the resolved profile, URL, credential source and config location with `notploy auth status`.
- Show server identity, latency, API specification version and clock information with `notploy server info`.
- Get actionable hints for `401`, `403`, `404` and `5xx` responses, including API compatibility guidance.

## Installation

### Requirements

- **Node.js 20.19 or later.** The repository itself develops against Node.js 24.
- Network access to your Notploy instance.
- An API key created from your Notploy dashboard.

### Global install

```bash
npm install -g @notploy/cli
notploy --version
```

Or with pnpm:

```bash
pnpm add -g @notploy/cli
```

### Run without installing

```bash
npx @notploy/cli@latest --help
```

The package exposes the `notploy` binary (`dist/index.js`).

## Quick start

```bash
# 1. Authenticate and store a profile. This validates the key by default.
notploy auth --url https://panel.notploy.com --token "$NOTPLOY_API_KEY"

# 2. Check configuration, connectivity and authentication.
notploy doctor

# 3. List projects as JSON.
notploy project all --json

# 4. Create an application.
notploy application create \
  --name "my-app" \
  --environmentId env_123 \
  --sourceType github

# 5. Start a deployment.
notploy application deploy --applicationId app_123

# 6. Inspect the deployment history.
notploy deployment all --applicationId app_123 --json
```

`application deploy` starts the deployment through the Notploy API. If your pipeline needs to wait for completion, poll the supported deployment endpoints (for example `deployment all`) rather than assuming a fixed delay.

## Authentication and profiles

### Create an API key

Create an API key in your Notploy dashboard and keep it private. The CLI never creates or guesses an authentication flow that the server does not expose.

To rotate a key, create a new key in the dashboard, authenticate again (or update the relevant profile), verify with `notploy doctor`, and only then revoke the old key.

### Authenticate

```bash
notploy auth --url https://panel.notploy.com --token "$NOTPLOY_API_KEY"
```

`auth` validates the credentials against `user.get` before saving them. Use `--no-verify` only when you intentionally want to store a key that cannot be checked yet (for example, during a network outage).

```bash
notploy auth --url http://localhost:3000 --token dev-key --no-verify
```

Interactive prompts are used only when stdin and stdout are TTYs and the environment is not marked as CI. Use `--no-input` to guarantee that a missing value fails instead of prompting:

```bash
notploy auth --no-input --json
```

### Named profiles

A profile is a named pair of server URL and API key. The first profile defaults to `default`; you can create as many as you need.

```bash
notploy profile add local --url http://localhost:3000 --token local-key
notploy profile add staging --url https://staging.notploy.com --token "$STAGING_KEY"
notploy profile add production --url https://panel.notploy.com --token "$PRODUCTION_KEY"

notploy profile use staging
notploy profile list
notploy profile show production
```

Use a profile for one command without changing the current selection:

```bash
notploy project all --profile production
notploy --profile production project all
```

Inspect or remove profiles without printing secrets:

```bash
notploy auth status
notploy auth status --verify --json
notploy profile list --json
notploy profile remove staging
notploy auth logout --profile staging
```

`profile list`, `profile show` and `auth status` always redact tokens. They can be used in logs and issue reports, but review the output before sharing it.

### Environment variables

Environment variables are the preferred authentication mechanism for CI and ephemeral shells.

| Variable | Purpose |
| --- | --- |
| `NOTPLOY_URL` | Server URL, for example `https://panel.notploy.com` |
| `NOTPLOY_API_KEY` | API key used for requests |
| `NOTPLOY_AUTH_TOKEN` | Legacy fallback for `NOTPLOY_API_KEY` |
| `NOTPLOY_PROFILE` | Profile selected when `--profile` is absent |
| `NOTPLOY_CONFIG_DIR` | Override the user configuration directory (tests, sandboxes) |
| `NOTPLOY_TIMEOUT` | Request timeout in milliseconds (1000–600000) |
| `NOTPLOY_NO_DOTENV` | Set to `1` to disable `.env` loading |
| `NOTPLOY_NO_INPUT` | Set to `1` to disable interactive prompts |
| `NOTPLOY_ENVIRONMENT` | Select an environment from `notploy.yaml` |
| `NOTPLOY_PROJECT_ID` | Project identifier fallback |
| `NOTPLOY_ENVIRONMENT_ID` | Environment identifier fallback |
| `NOTPLOY_APPLICATION_ID` | Application identifier fallback |
| `NOTPLOY_SERVER_ID` | Server identifier fallback |
| `NO_COLOR` / `FORCE_COLOR` | Standard color controls (also `--no-ansi`) |
| `CI` | Set to `true` to disable prompts |

### Configuration precedence

The CLI resolves each value independently. Higher rows win:

| Setting | Precedence |
| --- | --- |
| Profile name | `--profile` → `NOTPLOY_PROFILE` → `notploy.yaml` `profile` → current profile → `default` |
| Server URL | `--notploy-url` → `NOTPLOY_URL` → selected profile |
| API key | `--notploy-token` → `NOTPLOY_API_KEY` → `NOTPLOY_AUTH_TOKEN` → selected profile |
| Request timeout | `--timeout` → `NOTPLOY_TIMEOUT` → `notploy.yaml` `timeoutMs` → `30000` |
| Project/environment/application/server IDs | command flag → `NOTPLOY_*_ID` → `notploy.yaml` |
| `.env` values | fill variables that are not already set in the shell environment |

Global URL and token flags are available for unusual cases, but they are visible to other processes on many systems. Prefer environment variables in CI:

```bash
notploy --notploy-url https://panel.notploy.com --notploy-token "$KEY" project all
```

### Configuration location

The CLI stores user configuration outside the package directory, so global installs and read-only package locations work correctly:

| Platform | Default location |
| --- | --- |
| Linux | `$XDG_CONFIG_HOME/notploy/config.json` or `~/.config/notploy/config.json` |
| macOS | `~/Library/Application Support/notploy/config.json` |
| Windows | `%APPDATA%\notploy\config.json` |

Set `NOTPLOY_CONFIG_DIR` to override the directory. The CLI creates the directory with mode `0700` and the config file with mode `0600` where the filesystem supports POSIX permissions. Credentials are stored as plain JSON in that file, not in an OS keychain, so protect the file like any other developer credential.

If you used CLI `1.0.0`, its package-local `config.json` is still read for compatibility. Run `notploy auth` to write credentials to the new user-level location.

### Using `.env`

The CLI loads `.env` from the current working directory when `NOTPLOY_NO_DOTENV` is not set. Existing shell variables always win.

```env
NOTPLOY_URL="https://panel.notploy.com"
NOTPLOY_API_KEY="YOUR_API_KEY"
```

The `.env` file is optional. Do not commit it; the package `.gitignore` and the repository `.gitignore` already exclude `.env` files.

## Commands

### Global options

| Option | Purpose |
| --- | --- |
| `--profile <name>` | Select a configuration profile |
| `--notploy-url <url>` | Override the server URL (prefer `NOTPLOY_URL`) |
| `--notploy-token <key>` | Override the API key (prefer `NOTPLOY_API_KEY`) |
| `--timeout <ms>` | Request timeout, 1000–600000 ms |
| `--json` | Write one machine-readable JSON document to stdout |
| `--no-ansi` | Disable ANSI colors |
| `-h, --help` | Show help |
| `-V, --version` | Show the CLI version |

Global options work before or after the command. Generated commands also expose `--json` and `--profile`, so either form is valid:

```bash
notploy --json project all
notploy project all --json
notploy project all --profile production
```

### Generated API commands

The general form is:

```bash
notploy <group> <action> [options]
```

```bash
notploy project all
notploy project one --projectId project_123
notploy application create --name "my-app" --environmentId env_123
notploy application deploy --applicationId app_123
notploy application read-logs --applicationId app_123 --tail 100
notploy postgres create --name "my-db" --environmentId env_123
notploy postgres stop --postgresId pg_123
notploy deployment all --applicationId app_123
```

Command and option names mirror the API properties. Required options are marked `[required]` in help:

```bash
notploy application create --help
notploy --help
notploy application --help
```

Generated commands are intentionally a thin, predictable mapping over the API. They do not emulate features that the API does not expose.

### Option types

The generator understands the schema types in `openapi.json`:

- **Strings**: `--name <value>`.
- **Numbers**: parsed and validated; `--previewPort 3000` sends a number.
- **Booleans**: `--flag` means `true`, `--no-flag` means `false`. An optional explicit value is accepted: `--previewHttps false`.
- **Enums**: validated before the request; help lists the allowed values.
- **Arrays**: pass JSON, for example `--networkIds '["network_1","network_2"]'`.
- **Objects**: pass JSON, for example `--metricsConfig '{"server":{"port":3001}}'`.
- **Nullable fields**: pass the literal string `null` to send JSON `null`.
- **Required fields**: rejected locally with exit code `2` before a request is sent.

Examples:

```bash
notploy admin setup-monitoring \
  --metricsConfig '{"server":{"refreshRate":5,"port":3001}}'

notploy application update \
  --applicationId app_123 \
  --networkIds '["network_1","network_2"]' \
  --previewHttps false \
  --previewPort 3000

notploy application create \
  --name "my-app" \
  --environmentId env_123 \
  --sourceType github \
  --description null
```

### Auth commands

| Command | Purpose |
| --- | --- |
| `notploy auth -u <url> -t <key>` | Validate and save credentials |
| `notploy auth status` | Show the resolved profile, URL, source and redacted token |
| `notploy auth status --verify` | Also validate the resolved credentials |
| `notploy auth logout` | Remove the current profile |
| `notploy profile add <name> -u <url> -t <key>` | Create or update a named profile |
| `notploy profile list` | List profiles with redacted tokens |
| `notploy profile show [name]` | Show one profile with a redacted token |
| `notploy profile use <name>` | Select the default profile |
| `notploy profile remove <name>` | Remove a profile |

### Doctor

`notploy doctor` checks:

- Node.js version against the CLI requirement.
- Presence and permissions of the configuration file.
- Timeout configuration.
- Profile and credential resolution.
- `notploy.yaml` validity, when present.
- Connectivity and authentication against `user.get`.
- Legacy configuration migration notices.

```bash
notploy doctor
notploy doctor --json
notploy doctor --offline
notploy doctor --profile production --json
```

Exit code is `0` when no check fails, `2` for configuration or manifest failures, `3` for authentication failures, `4` for connectivity/API failures and `5` for timeouts. Warnings do not fail the command.

### Server info

```bash
notploy server info
notploy server info --json
```

This reports the resolved profile and URL, request latency, the CLI's expected API specification version and command count, the authenticated user and the server clock (when available). It never prints the API key.

### Examples

```bash
# Switch between environments without mixing credentials.
notploy profile use staging
notploy project all --json

# Deploy to production explicitly.
notploy application deploy --profile production --applicationId app_123

# List databases.
notploy postgres all --json
notploy redis all --json

# Inspect logs.
notploy application read-logs --applicationId app_123 --tail 200
notploy deployment read-logs --deploymentId dep_123

# Trigger a backup manually.
notploy backup manual-backup-postgres --backupId backup_123

# Use a project manifest for identifiers.
notploy application deploy --json
```

## JSON output and exit codes

### JSON mode

`--json` guarantees:

- exactly one JSON document on **stdout**;
- no spinners, banners, colors or success text on stdout;
- diagnostics, progress messages and warnings on **stderr**;
- a JSON error document on stdout when the command fails, plus the stable exit code.

The JSON representation of a successful command is the API payload, unwrapped:

```json
[
  {
    "id": "project_1",
    "name": "Demo"
  }
]
```

Parse it directly:

```bash
notploy project all --json | jq -r '.[].name'
```

### Error shape

```json
{
  "error": {
    "code": 3,
    "type": "auth",
    "message": "UNAUTHORIZED (HTTP 401)",
    "hint": "Check your API key with 'notploy auth status' or NOTPLOY_API_KEY."
  }
}
```

`type` is one of `general`, `usage`, `auth`, `api`, `timeout` or `interrupted`. Hints are optional. Server messages are redacted against the active credentials before printing.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Unexpected/general failure |
| `2` | Invalid usage, configuration, manifest or input validation |
| `3` | Authentication or authorization failure (`401`/`403`) |
| `4` | API, network or server failure (`404`, `429`, `5xx`, DNS, connection refused) |
| `5` | Request timeout |
| `130` | Interrupted (Ctrl-C / SIGINT) |

Pipelines should branch on these codes rather than matching human-readable text.

### Non-interactive behavior

The CLI never prompts when:

- stdin or stdout is not a TTY;
- `CI=true`;
- `NOTPLOY_NO_INPUT=1`;
- `--no-input` is passed to `auth` or `profile add`.

If a required value is missing in a non-interactive context, the command fails with exit code `2` and an actionable message. This is intentional: a pipeline must not hang waiting for input.

### Timeouts and interruption

The default timeout is `30000 ms`. Configure it per command or globally:

```bash
notploy project all --timeout 60000
NOTPLOY_TIMEOUT=60000 notploy project all
```

The accepted range is `1000`–`600000` ms. Timeouts return exit code `5`. Ctrl-C terminates the process with exit code `130`.

## Project manifest

An optional `notploy.yaml` (or `notploy.yml`) in the working directory supplies non-secret identifiers. It is never required for a command to work.

### Manifest schema

```yaml
version: 1

# Optional profile name used when --profile and NOTPLOY_PROFILE are absent.
profile: production

# Default identifiers for commands that accept them.
projectId: project_123
environmentId: env_123
applicationId: app_123
serverId: server_123

# Optional request timeout fallback.
timeoutMs: 30000

# Optional environment overlay.
environment: production
environments:
  production:
    environmentId: env_prod
    applicationId: app_prod
    serverId: server_prod
  staging:
    environmentId: env_staging
    applicationId: app_staging
```

The selected environment overlays the defaults. Select it with `environment` in the file or `NOTPLOY_ENVIRONMENT`:

```bash
NOTPLOY_ENVIRONMENT=staging notploy application deploy --json
```

### Manifest rules

- `version` must be `1`.
- Unknown keys are rejected with the file path and a clear message.
- Secret-looking keys (`token`, `apiKey`, `secret`, `password`, `authorization`, `credential`, and similar) are rejected at any depth.
- `environments` may only contain `environmentId`, `applicationId` and `serverId`.
- `environment` must reference a defined environment.
- Identifiers are resolved per field: command flag → `NOTPLOY_*_ID` → selected manifest/environment value.
- A malformed manifest does not silently change behavior; commands that need its values fail with exit code `2`, and `notploy doctor` reports the problem.

Manifests are meant for identifiers and non-secret settings only. Use profiles, `NOTPLOY_API_KEY` or your CI secret store for credentials.

## CI/CD

### GitHub Actions

```yaml
name: Deploy with Notploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      NOTPLOY_URL: ${{ secrets.NOTPLOY_URL }}
      NOTPLOY_API_KEY: ${{ secrets.NOTPLOY_API_KEY }}
      NOTPLOY_APPLICATION_ID: ${{ vars.NOTPLOY_APPLICATION_ID }}
      NOTPLOY_NO_INPUT: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install -g @notploy/cli@latest
      - run: notploy doctor --json
      - run: notploy application deploy --json > deployment.json
      - run: notploy deployment all --applicationId "$NOTPLOY_APPLICATION_ID" --json > deployments.json
      - uses: actions/upload-artifact@v4
        with:
          name: notploy-output
          path: ./*.json
```

`notploy doctor --json` fails the job with a meaningful exit code before the deployment step when configuration, authentication or connectivity is broken. Store API keys as secrets; do not put them in `notploy.yaml` or the repository.

### Generic shell

```bash
#!/usr/bin/env bash
set -euo pipefail

export NOTPLOY_URL="${NOTPLOY_URL:?missing NOTPLOY_URL}"
export NOTPLOY_API_KEY="${NOTPLOY_API_KEY:?missing NOTPLOY_API_KEY}"
export NOTPLOY_APPLICATION_ID="${NOTPLOY_APPLICATION_ID:?missing NOTPLOY_APPLICATION_ID}"
export NOTPLOY_NO_INPUT=1

notploy doctor --json
notploy application deploy --json > deployment.json

# `set -e` propagates the CLI's stable exit code.
```

Use `--json` for machine-readable output and send human diagnostics to stderr. Avoid `--notploy-token` in shared runners: process arguments may be visible to other users.

## Generated command reference

The checked-in specification currently generates **604 commands in 57 groups**. Counts reflect `openapi.json` at the time of writing; use `notploy <group> --help` for the authoritative surface of your installed version.

| Group | Commands | Group | Commands |
| --- | ---: | --- | ---: |
| `settings` | 52 | `notification` | 41 |
| `application` | 32 | `compose` | 31 |
| `user` | 26 | `server` | 19 |
| `docker` | 18 | `mariadb` | 16 |
| `mongo` | 16 | `mysql` | 16 |
| `postgres` | 16 | `redis` | 16 |
| `ai` | 14 | `libsql` | 14 |
| `backup` | 12 | `patch` | 12 |
| `dns-provider` | 11 | `organization` | 11 |
| `project` | 11 | `sso` | 11 |
| `domain` | 10 | `forward-auth` | 10 |
| `stripe` | 10 | `deployment` | 9 |
| `network` | 9 | `docker-volume` | 8 |
| `gitea` | 8 | `tag` | 8 |
| `bitbucket` | 7 | `environment` | 7 |
| `gitlab` | 7 | `registry` | 7 |
| `ssh-key` | 7 | `vault-provider` | 7 |
| `custom-role` | 6 | `destination` | 6 |
| `github` | 6 | `license-key` | 6 |
| `mounts` | 6 | `schedule` | 6 |
| `volume-backups` | 6 | `certificates` | 5 |
| `cluster` | 4 | `git-provider` | 4 |
| `port` | 4 | `preview-deployment` | 4 |
| `redirects` | 4 | `security` | 4 |
| `swarm` | 4 | `whitelabeling` | 4 |
| `docker-disk-usage` | 3 | `docker-image` | 3 |
| `overview` | 3 | `scim` | 3 |
| `rollback` | 2 | `admin` | 1 |
| `audit-log` | 1 | | |

## Roadmap and boundaries

The CLI is intentionally honest about what it can promise:

- Every command maps to an endpoint in the maintained Notploy OpenAPI specification. If an endpoint is absent from the specification, the CLI does not invent it.
- Different Notploy versions may expose different endpoint sets. A `404` includes a compatibility hint; `notploy doctor` and `notploy server info` help identify the connection.
- `application deploy` starts a deployment. A dedicated `--wait` helper and log-follow mode are not part of this release; use the generated deployment and log endpoints to poll or inspect status where your server supports it.
- The TypeScript SDK is a separate deliverable (`@notploy/sdk`). The CLI does not expose its internals as a programming interface.
- Generated output is checked in and verified with `pnpm generate:check`; hand-written behavior belongs in `src/commands`, not in the generated file.

## Development

### Setup

The CLI is part of the Notploy pnpm monorepo. Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

The CLI supports Node.js 20.19+; the repository development environment uses Node.js 24.4+ and pnpm 10.22+.

### Package scripts

Run scripts with a filter from the root or from `packages/cli`:

```bash
pnpm --filter=@notploy/cli run build
pnpm --filter=@notploy/cli run dev -- project all
pnpm --filter=@notploy/cli run generate
pnpm --filter=@notploy/cli run generate:check
pnpm --filter=@notploy/cli run typecheck
pnpm --filter=@notploy/cli run test
pnpm --filter=@notploy/cli run lint:ci
```

| Script | Purpose |
| --- | --- |
| `build` | Generate commands and compile TypeScript to `dist/` |
| `generate` | Regenerate `src/generated/commands.ts` and `meta.ts` |
| `generate:check` | Fail if generated files are stale |
| `dev` | Run the CLI from source with `tsx` |
| `typecheck` | Type-check without emitting |
| `test` | Build, then run the Vitest suite |
| `test:watch` | Run Vitest in watch mode |
| `lint` | Apply Biome formatting and safe fixes |
| `lint:ci` | Check formatting and lint without writing |

`test` runs `build` first because the end-to-end tests execute the published entry point at `dist/index.js`.

### Package layout

```text
packages/cli/
├── src/
│   ├── index.ts                  # entry point, global options, exit handling
│   ├── commands/
│   │   ├── auth.ts               # auth and auth status/logout
│   │   ├── profile.ts            # profile add/list/show/use/remove
│   │   ├── doctor.ts             # diagnostics
│   │   ├── server-info.ts        # server info (hand-written)
│   │   └── run.ts                # shared generated-command runner
│   ├── generated/
│   │   ├── commands.ts           # generated API commands (do not edit)
│   │   └── meta.ts               # spec version/hash and counts (do not edit)
│   ├── config.ts                 # profiles, precedence, config location
│   ├── credentials.ts            # prompts and verified profile saving
│   ├── errors.ts                 # exit codes, normalization, redaction
│   ├── http.ts                   # shared Axios client and timeouts
│   ├── output.ts                 # JSON/human stdout and stderr contract
│   ├── project-config.ts         # notploy.yaml parser and validation
│   └── version.ts                # package version / User-Agent
├── scripts/
│   ├── generate.ts               # generation CLI (write/check)
│   └── generator.ts              # deterministic OpenAPI → commands renderer
├── tests/                        # unit and end-to-end tests
├── openapi.json                  # maintained Notploy API specification
├── bin/run.js                    # development launcher
├── package.json
└── tsconfig.json
```

### Updating generated commands

Never edit `src/generated/commands.ts` or `src/generated/meta.ts` by hand.

1. Replace `openapi.json` with the latest maintained specification.
2. Run `pnpm --filter=@notploy/cli run generate`.
3. Review the generated diff and run `pnpm --filter=@notploy/cli run generate:check`.
4. Run `pnpm --filter=@notploy/cli run test`.
5. Update this README if the command count or groups changed.

The generator is deterministic: it sorts groups and endpoints, emits stable metadata, handles local `$ref`, `allOf`, arrays, objects, enums, nullable values and required options, and fails clearly on unsupported constructs or reserved option names.

### Tests

The suite covers:

- config locations and profile precedence;
- restrictive file permissions;
- URL normalization and timeout validation;
- secret redaction and error normalization;
- YAML parsing, manifest validation and environment overlays;
- deterministic generation and stale-output detection;
- generated command types and reserved-name failures;
- end-to-end CLI runs against a local mock API, including JSON stdout, exit codes `2`–`5`, profile isolation, schema coercion, `doctor`, `server info` and `notploy.yaml`.

Run everything before opening a pull request:

```bash
pnpm --filter=@notploy/cli run generate:check
pnpm --filter=@notploy/cli run typecheck
pnpm --filter=@notploy/cli run test
pnpm --filter=@notploy/cli run lint:ci
```

Add a changeset with `pnpm changeset` for user-facing changes. Do not bump the package version manually.

## FAQ

### Is the CLI free?

Yes. `@notploy/cli` is open source and licensed under the MIT License. The root Notploy platform is licensed separately under Apache 2.0.

### Does it work with self-hosted instances?

Yes. Point `--url`, `NOTPLOY_URL` or a profile at your instance. Local HTTP instances such as `http://localhost:3000` are supported. `notploy doctor` checks the full path before you run a deployment.

### Where are my credentials stored?

In a user-level `config.json` under the OS-appropriate configuration directory, with mode `0600` where supported. They are not written to the package directory and are not printed by `profile` or `auth status` output. The file is plain JSON, not an OS keychain; protect it accordingly. In CI, prefer `NOTPLOY_*` environment variables from your secret store.

### Why did a command return exit code 4?

Exit code `4` means the request reached the API layer but failed: DNS/connection errors, `404`, `429`, `5xx`, or another server-side failure. The human message on stderr includes a hint. Run `notploy doctor` to distinguish configuration, authentication and connectivity problems. Exit code `3` specifically means authentication/authorization failed.

### How do I report a bug?

Open a [GitHub issue](https://github.com/skygenesisenterprise/notploy/issues) with the CLI version (`notploy --version`), the command you ran, the exit code and redacted `notploy doctor --json` output. Never include API keys or full config files.

## Related resources

### Official

- Product documentation: [docs.notploy.com](https://docs.notploy.com)
- Website: [notploy.com](https://notploy.com)
- Hosted platform: [app.notploy.com](https://app.notploy.com)
- npm package: [@notploy/cli](https://www.npmjs.com/package/@notploy/cli)
- TypeScript SDK: [`packages/sdk`](https://github.com/skygenesisenterprise/notploy/tree/master/packages/sdk)
- API specification: [`packages/cli/openapi.json`](openapi.json)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)

### Community

- Questions and discussions: [Notploy Discord](https://discord.gg/GUkDugVh34)
- Bugs and feature requests: [GitHub Issues](https://github.com/skygenesisenterprise/notploy/issues)
- Repository contribution guide: [`.github/CONTRIBUTING.md`](https://github.com/skygenesisenterprise/notploy/blob/master/.github/CONTRIBUTING.md)

### Commercial

- Commercial edition and premium support: [Sky Genesis Enterprise](https://skygenesisenterprise.com)

## Contributing

Contributions and suggestions are welcome. Read the [Code of Conduct](https://github.com/skygenesisenterprise/notploy/blob/master/CODE_OF_CONDUCT.md) before participating, then follow the [package contribution guide](CONTRIBUTING.md).

- Keep pull request titles in [Conventional Commits](https://www.conventionalcommits.org) format (`fix: …`, `feat: …`, `docs: …`).
- Add a changeset with `pnpm changeset` for user-facing changes.
- Never edit generated files manually; fix the generator or the OpenAPI specification.
- Add tests for new command behavior, especially anything that affects output, exit codes or credentials.
- Run `generate:check`, `typecheck`, `test` and `lint:ci` before opening a pull request.

## Security

Do not report security vulnerabilities in public issues. Follow the private reporting instructions in [SECURITY.md](https://github.com/skygenesisenterprise/notploy/blob/master/SECURITY.md).

- Never paste API keys, config files or request headers into an issue.
- Prefer environment variables over command-line token flags in shared environments.
- Treat `notploy.yaml` as a non-secret file; the CLI rejects secret-looking keys.
- Secret redaction in errors is a last line of defence, not a substitute for keeping credentials out of logs.
- Rotate keys immediately if you suspect exposure.

## License

`@notploy/cli` is licensed under the [MIT License](LICENSE.md). The root Notploy project is licensed under the [Apache 2.0 License](https://github.com/skygenesisenterprise/notploy/blob/master/LICENSE). Some separately published packages or included components may have their own license terms; check the relevant package's license file before redistributing it.

## Note

Notploy is an open-source project maintained by [Sky Genesis Enterprise](https://skygenesisenterprise.com). Links to external services are provided for convenience and do not imply endorsement. Check each service's own terms before relying on it in production.
