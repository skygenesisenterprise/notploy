# @notploy/discord

Official **Notploy Community** Discord bot.

This package is the community integration layer of Notploy. It is **not** an
infrastructure administration interface: it exposes community-facing slash
commands and connects the official Discord server to public Notploy resources
(documentation, website, releases, GitHub activity).

```
Discord command
    ↓
Discord service
    ↓
@notploy/sdk
    ↓
Notploy API
```

`@notploy/discord` never depends on `packages/server`, Prisma or any internal
database implementation. The only Notploy dependency is the published
`@notploy/sdk`.

## Commands

| Command | Description |
| --- | --- |
| `/about` | Information about Notploy and the project. |
| `/help` | Available commands and usage. |
| `/docs` | Links to the official documentation. |
| `/links` | Official Notploy resources. |
| `/status` | Public project/instance status and latest release. |
| `/version` | Current public release/version. |

All commands are read-only. There is intentionally no `deploy`, `restart`,
`delete`, server administration or secret-management command.

## Architecture

```
src/
├── index.ts                     Public package surface
├── main.ts                      Process entry point (bot bootstrap)
├── bot/
│   ├── client.ts                Discord.js client + command registry
│   ├── intents.ts               Least-privilege gateway intents
│   └── lifecycle.ts             Bot orchestrator (start / graceful shutdown)
├── commands/
│   ├── index.ts                 Command registry
│   ├── about.ts  help.ts  docs.ts  links.ts  status.ts  version.ts
├── events/
│   ├── ready.ts                 Activity + startup logging
│   ├── interaction-create.ts    Command dispatch and error handling
│   └── guild-member-add.ts      Onboarding trigger
├── integrations/
│   ├── github/                  Public GitHub REST API (releases) + event mapping
│   └── notploy/                 Read-only Notploy API access through @notploy/sdk
├── services/
│   ├── community.ts             Official resources and project information
│   ├── notifications.ts         GitHub → Discord notification routing
│   └── roles.ts                 Member onboarding
├── config/env.ts                Environment loading and validation
├── utils/                       Embeds, errors, permissions, logger
└── types/                       Shared types
scripts/
└── register-commands.ts         Slash command registration
tests/                           Vitest unit tests
```

Command handling, integrations and services are deliberately separated: the
interaction handler is a thin dispatcher, commands only receive a service
container, and the GitHub integration never imports Discord.js outside of the
presentation helpers it shares.

## Getting started

### 1. Create the Discord application

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, create the bot and copy its token.
3. Copy the **Application ID** from the **General Information** page.
4. Invite the bot to your server with the `applications.commands` and `bot`
   scopes and the **Send Messages** + **Embed Links** permissions.
5. If you use onboarding (welcome message / automatic role), enable the
   **Server Members Intent** under **Bot → Privileged Gateway Intents**.

### 2. Configure the environment

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token. |
| `DISCORD_CLIENT_ID` | Yes | Application (client) ID. |
| `DISCORD_GUILD_ID` | No | Register commands to one guild (instant) instead of globally. |
| `GITHUB_REPOSITORY` | No | Repository announced/quoted, default `skygenesisenterprise/notploy`. |
| `GITHUB_TOKEN` | No | Optional token to raise the GitHub API rate limit. |
| `NOTPLOY_WEBSITE_URL` | No | Website URL. |
| `NOTPLOY_DOCS_URL` | No | Documentation base URL. |
| `NOTPLOY_STATUS_URL` | No | Status page URL. |
| `NOTPLOY_TEMPLATES_URL` | No | Templates gallery URL. |
| `NOTPLOY_CLOUD_URL` | No | Hosted platform URL. |
| `NOTPLOY_DISCORD_INVITE` | No | Community invite URL. |
| `DISCORD_WELCOME_CHANNEL_ID` | No | Channel for welcome messages. |
| `DISCORD_MEMBER_ROLE_ID` | No | Role granted automatically to new members. |
| `DISCORD_NOTIFICATION_EVENTS` | No | Comma-separated event types to announce (`releases`, `issues`, `pullRequests`, `discussions`, `security`). |
| `DISCORD_RELEASES_CHANNEL_ID` | No | Releases announcement channel. |
| `DISCORD_ISSUES_CHANNEL_ID` | No | Issues announcement channel. |
| `DISCORD_PULL_REQUESTS_CHANNEL_ID` | No | Pull requests announcement channel. |
| `DISCORD_DISCUSSIONS_CHANNEL_ID` | No | Discussions announcement channel. |
| `DISCORD_SECURITY_CHANNEL_ID` | No | Security announcements channel. |
| `NOTPLOY_URL` | No | Base URL of a read-only Notploy instance (enables `/status`, `/version`). |
| `NOTPLOY_API_KEY` | No | API key for that instance. |
| `DISCORD_LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` (default `info`). |

When `DISCORD_NOTIFICATION_EVENTS` is unset, every event type that has a
channel configured is enabled.

### 3. Install and register commands

```bash
pnpm install
pnpm --filter=@notploy/discord run commands:register
```

### 4. Run

```bash
# development (watch mode)
pnpm --filter=@notploy/discord run dev

# production
pnpm --filter=@notploy/discord run build
pnpm --filter=@notploy/discord run start
```

## Development

```bash
pnpm --filter=@notploy/discord run typecheck
pnpm --filter=@notploy/discord run lint
pnpm --filter=@notploy/discord run test
```

The tests never connect to Discord: the command registry, services, embed
builders and GitHub integration are all exercised in isolation.

## Notifications

The bot normalizes GitHub events into a small, safe set of types and routes
them to the configured channels:

- new releases
- important issues
- pull requests
- discussions
- security announcements (generic, no sensitive details)

`NotificationService.publish(event)` accepts already-normalized events, so a
webhook receiver, a scheduled job or a CLI can feed it. A built-in release
poller announces new tags with no additional infrastructure. To avoid turning
the server into a noisy feed, only events explicitly enabled **and** mapped to
a channel are ever sent.

## Deployment

Build from the repository root (the root `pnpm-workspace.yaml` is the single
workspace for the whole monorepo):

```bash
docker build -f packages/discord/Dockerfile -t notploy-discord-bot .
docker run --rm --env-file packages/discord/.env notploy-discord-bot
```

Docker Compose and a Makefile are provided for convenience:

```bash
cd packages/discord
cp .env.example .env   # fill in DISCORD_TOKEN and DISCORD_CLIENT_ID
make docker-up         # build and start the bot
make docker-logs       # follow the logs
make docker-down       # stop the bot
```

Run `make help` for the full list of tasks (local dev, tests, Docker).

Register the slash commands once from any environment that has the token and
client ID configured (`pnpm --filter=@notploy/discord run commands:register`,
or `make register` from this directory).

## Security and scope

The official community bot must not become a production administration plane.

- No destructive or privileged operations are exposed.
- Notploy API access is optional, read-only, and performed through
  `@notploy/sdk`.
- Secrets are provided exclusively through environment variables and are never
  logged.
- If linked Notploy instances are supported in the future, they must use
  explicit pairing, scoped credentials, permission checks and audit logging.

Report security issues privately as described in the repository's
[SECURITY.md](../../SECURITY.md).

## License

Apache-2.0 — see the repository [LICENSE](../../LICENSE).
