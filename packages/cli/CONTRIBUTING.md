# Contributing to the Notploy CLI

Thanks for your interest in improving `@notploy/cli`!

Before starting significant work, please discuss the change through a [GitHub issue](https://github.com/skygenesisenterprise/notploy/issues). The CLI is the official developer integration surface for Notploy, so changes to output, exit codes, authentication or the generated command contract need a clear rationale.

## Requirements

- Node.js 20.19 or later. The repository development environment uses Node.js 24.4.
- pnpm 10.22 or later.
- A Notploy instance for manual smoke tests. Automated tests use a local mock API and do not need a real server.

## Setup

The CLI is part of the Notploy pnpm monorepo. Install dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

For a local instance, create a `.env` file in your working directory or export environment variables:

```env
NOTPLOY_URL="http://localhost:3000"
NOTPLOY_API_KEY="YOUR_API_KEY"
```

Do not commit `.env` files or API keys. The CLI reads `.env` without overriding variables that are already set in the shell.

## Development

Run scripts from the repository root:

```bash
pnpm --filter=@notploy/cli run dev -- project all
pnpm --filter=@notploy/cli run build
pnpm --filter=@notploy/cli run generate
pnpm --filter=@notploy/cli run generate:check
pnpm --filter=@notploy/cli run typecheck
pnpm --filter=@notploy/cli run test
pnpm --filter=@notploy/cli run lint
```

Or from `packages/cli`:

```bash
pnpm run dev -- project all
pnpm run build
pnpm run test
```

`pnpm run test` builds the package first because the end-to-end suite executes `dist/index.js`. The suite starts a local mock Notploy API; it does not contact a real instance.

### Package scripts

| Script | Purpose |
| --- | --- |
| `build` | Generate commands and compile TypeScript to `dist/` |
| `generate` | Regenerate `src/generated/commands.ts` and `src/generated/meta.ts` |
| `generate:check` | Fail if generated files are stale |
| `dev` | Run the CLI from source with `tsx` |
| `typecheck` | Type-check without emitting |
| `test` | Build, then run Vitest |
| `test:watch` | Run Vitest in watch mode |
| `lint` | Apply Biome formatting and safe fixes |
| `lint:ci` | Check formatting and lint without writing |

## Updating generated commands

`src/generated/commands.ts` and `src/generated/meta.ts` are generated from `openapi.json`. **Never edit them manually.**

1. Replace `openapi.json` with the latest maintained Notploy specification.
2. Run `pnpm --filter=@notploy/cli run generate`.
3. Review the generated diff, especially new required options and changed types.
4. Run `pnpm --filter=@notploy/cli run generate:check`.
5. Run the full test suite.
6. Update `readme.md` if the command count, groups or documented examples changed.

Generated names and flags are part of the public CLI contract. Keep existing names where practical. If a name must change, document the deprecation and migration path in the pull request and changeset.

Hand-written behavior belongs in `src/commands/` or the shared modules (`config.ts`, `credentials.ts`, `errors.ts`, `http.ts`, `output.ts`, `project-config.ts`), never in the generated file.

## Tests

Add tests for every behavior change. In particular:

- **Config/profiles** — `tests/config.test.ts`
- **Manifest parsing/validation** — `tests/project-config.test.ts`
- **Error normalization/redaction** — `tests/errors.test.ts`
- **Generator output and schema types** — `tests/generator.test.ts`
- **End-to-end CLI output, exit codes and auth** — `tests/cli.test.ts` with `tests/helpers/`

The end-to-end tests run the built CLI in a child process with an isolated `NOTPLOY_CONFIG_DIR`, so they must not read or write your real credentials.

Before opening a pull request, run:

```bash
pnpm --filter=@notploy/cli run generate:check
pnpm --filter=@notploy/cli run typecheck
pnpm --filter=@notploy/cli run test
pnpm --filter=@notploy/cli run lint:ci
```

## Security expectations

- Never print API keys, request headers or full config files.
- Use the shared redaction helpers for any new error path that includes server-provided text.
- Prefer `NOTPLOY_*` environment variables over token flags in documentation and CI examples.
- Do not add secrets to `notploy.yaml`; the manifest validator rejects secret-looking keys.
- Keep config files at mode `0600` where the platform supports it.
- Report vulnerabilities privately according to the root [SECURITY.md](https://github.com/skygenesisenterprise/notploy/blob/master/SECURITY.md).

## Commit convention

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
feat: add profile rename command
fix: redact tokens from timeout errors
docs: update CLI quick start
chore: regenerate commands from openapi
```

Keep pull request titles in the same format.

## Changesets

Add a changeset with `pnpm changeset` for user-facing changes. Do not bump `packages/cli/package.json` manually; the release workflow and changesets own versioning.

Describe compatibility impact explicitly, including:

- changed command names or flags;
- changed exit codes or JSON output;
- supported Node.js versions;
- deprecations and migration steps.

## Pull requests

- Branch from `master`.
- Provide a clear description and reference the related issue.
- Include the commands you ran to verify the change.
- Do not include generated files that were not produced by the generator.
- Do not include API keys, config files or production data in screenshots or logs.

Thank you for contributing!
