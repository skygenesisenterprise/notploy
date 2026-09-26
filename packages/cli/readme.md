# Notploy CLI

Notploy CLI is a command-line tool to manage your Notploy server remotely. It provides **449 commands** auto-generated from the Notploy OpenAPI spec, covering every API endpoint.

## Installation

```bash
npm install -g @notploy/cli
```

## Authentication

### Option 1: Using the `auth` command

```bash
notploy auth -u https://panel.notploy.com -t YOUR_API_KEY
```

### Option 2: Environment variables

```bash
export NOTPLOY_URL="https://panel.notploy.com"
export NOTPLOY_API_KEY="YOUR_API_KEY"
```

### Option 3: `.env` file

Create a `.env` file in your working directory:

```env
NOTPLOY_URL="https://panel.notploy.com"
NOTPLOY_API_KEY="YOUR_API_KEY"
```

The CLI loads it automatically. Shell environment variables take priority over the `.env` file.

## Usage

```bash
notploy <group> <action> [options]
```

### Examples

```bash
# List all projects
notploy project all

# Get a specific project
notploy project one --projectId abc123

# Create an application
notploy application create --name "my-app" --environmentId env123

# Deploy an application
notploy application deploy --applicationId app123

# Create a postgres database
notploy postgres create --name "my-db" --environmentId env123

# Stop a database
notploy postgres stop --postgresId pg123

# Get raw JSON output
notploy project all --json
```

### Getting help

```bash
# List all groups
notploy --help

# List actions in a group
notploy application --help

# See options for a specific action
notploy application deploy --help
```

## Available command groups

| Group | Commands | Group | Commands |
|---|---|---|---|
| `admin` | 1 | `notification` | 38 |
| `ai` | 9 | `organization` | 10 |
| `application` | 29 | `patch` | 12 |
| `backup` | 11 | `port` | 4 |
| `bitbucket` | 7 | `postgres` | 14 |
| `certificates` | 4 | `preview-deployment` | 4 |
| `cluster` | 4 | `project` | 8 |
| `compose` | 28 | `redirects` | 4 |
| `deployment` | 8 | `redis` | 14 |
| `destination` | 6 | `registry` | 7 |
| `docker` | 7 | `rollback` | 2 |
| `domain` | 9 | `schedule` | 6 |
| `environment` | 7 | `security` | 4 |
| `gitea` | 8 | `server` | 16 |
| `github` | 6 | `settings` | 49 |
| `gitlab` | 7 | `ssh-key` | 6 |
| `git-provider` | 2 | `sso` | 10 |
| `license-key` | 6 | `stripe` | 7 |
| `mariadb` | 14 | `swarm` | 3 |
| `mongo` | 14 | `user` | 18 |
| `mounts` | 6 | `volume-backups` | 6 |
| `mysql` | 14 | | |

## Development

```bash
# Install dependencies
pnpm install

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

Commands are auto-generated from `openapi.json`. To update:

1. Replace `openapi.json` with the latest spec from the [Notploy repo](https://github.com/skygenesisenterprise/notploy)
2. Run `pnpm run generate`
3. Build with `pnpm run build`

## Contributing

If you want to contribute to Notploy CLI, please check out our [Contributing Guide](https://github.com/skygenesisenterprise/notploy/blob/master/packages/cli/CONTRIBUTING.md).

## Support

If you encounter any issues or have any questions, please [open an issue](https://github.com/skygenesisenterprise/notploy/issues) in our GitHub repository.

## License

This project is licensed under the [MIT License](LICENSE).
