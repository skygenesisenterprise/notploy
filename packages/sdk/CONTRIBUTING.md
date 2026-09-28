# Contributing to Notploy SDK

Thanks for your interest in contributing! This guide will get you up and running quickly.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 8+

## Setup

```bash
git clone https://github.com/skygenesisenterprise/notploy/tree/master/packages/sdk
cd sdk
pnpm install
```

## Project Structure

```
sdk/
├── openapi.json            # OpenAPI spec (source of truth)
├── openapi-ts.config.ts    # Code generation config
├── src/
│   ├── index.ts            # Hand-written entry point (edit this one)
│   └── generated/          # Auto-generated only (never edit)
│       ├── index.ts        # Generated barrel
│       ├── types.gen.ts    # Generated types
│       ├── sdk.gen.ts      # Generated SDK functions
│       ├── client.gen.ts   # Generated client config
│       ├── client/         # Generated fetch client + types
│       └── core/           # Generated serializers, SSE, auth
└── biome.json              # Linter / formatter config
```

> Everything inside `src/generated/` is auto-generated. **Do not edit it manually** — your changes will be overwritten on the next `pnpm generate`.
>
> `src/index.ts` is hand-written and is the only place where the public surface of the
> package is defined. Keep it to re-exports.

## Updating the SDK

The SDK is generated entirely from `openapi.json`. To update it:

1. Replace or update `openapi.json` with the latest spec
2. Run the generator:

```bash
pnpm generate
```

3. Review the diff and open a PR

The generator writes only to `src/generated/`, so hand-written files under `src/` are safe.

## Adding a runtime helper

Add it next to `src/index.ts` and re-export it from `src/index.ts`. Do not put it under
`src/generated/`, and do not add bare `import`/`export` specifiers that Node's ESM loader
cannot resolve: the package is consumed through bundlers.

## Code Style

This project uses [Biome](https://biomejs.dev) for formatting and linting.

```bash
# Format
pnpm biome format --write .

# Lint
pnpm biome lint .

# Both at once
pnpm biome check --write .
```

Your editor should pick up `biome.json` automatically if you have the Biome extension installed.

## Opening a Pull Request

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm generate` if you updated `openapi.json`
4. Open a PR with a clear description of what changed and why

## Reporting Issues

Found a bug or missing endpoint? [Open an issue](https://github.com/skygenesisenterprise/notploy/issues) with:

- What you expected
- What actually happened
- A minimal reproduction if possible
