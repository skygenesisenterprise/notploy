# Contributing to Dokploy SDK

Thanks for your interest in contributing! This guide will get you up and running quickly.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 8+

## Setup

```bash
git clone https://github.com/dokploy/sdk
cd sdk
pnpm install
```

## Project Structure

```
sdk/
├── openapi.json          # OpenAPI spec (source of truth)
├── openapi-ts.config.ts  # Code generation config
├── src/
│   ├── types.gen.ts      # Auto-generated types (do not edit)
│   ├── sdk.gen.ts        # Auto-generated SDK functions (do not edit)
│   ├── client.gen.ts     # Auto-generated client config (do not edit)
│   └── index.ts          # Auto-generated exports (do not edit)
└── biome.json            # Linter / formatter config
```

> All files inside `src/` are auto-generated. **Do not edit them manually** — your changes will be overwritten on the next `pnpm generate`.

## Updating the SDK

The SDK is generated entirely from `openapi.json`. To update it:

1. Replace or update `openapi.json` with the latest spec
2. Run the generator:

```bash
pnpm generate
```

3. Review the diff and open a PR

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

Found a bug or missing endpoint? [Open an issue](https://github.com/dokploy/sdk/issues) with:

- What you expected
- What actually happened
- A minimal reproduction if possible
