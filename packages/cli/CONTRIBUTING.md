# Contributing

Thanks for your interest in contributing to Notploy CLI!

Before you start, please discuss the feature/bug via [GitHub issues](https://github.com/Notploy/cli/issues).

## Setup

```bash
git clone https://github.com/Notploy/cli.git
cd cli
pnpm install
```

Create a `.env` file with your credentials:

```env
NOTPLOY_URL="https://your-server.notploy.com"
NOTPLOY_API_KEY="YOUR_API_KEY"
```

## Development

```bash
# Run in dev mode
pnpm run dev -- project all

# Regenerate commands from OpenAPI spec
pnpm run generate

# Build
pnpm run build

# Lint & format
pnpm run lint
```

### Updating commands

Commands in `src/generated/commands.ts` are auto-generated from `openapi.json`. Never edit that file manually. To update:

1. Replace `openapi.json` with the latest spec from the [Notploy repo](https://github.com/Notploy/notploy)
2. Run `pnpm run generate`

## Commit convention

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add new feature
fix: resolve bug
docs: update readme
chore: bump version
```

## Pull requests

- Branch from `main`
- Provide a clear description of your changes
- Reference any related issues
- Include a screenshot/video if applicable

Thank you for your contribution!
