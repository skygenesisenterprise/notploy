# Changesets

This repository uses [changesets](https://github.com/changesets/changesets) to
version and publish the packages in the pnpm workspace.

## How it works

1. Add a changeset for every user-facing change:

   ```bash
   pnpm changeset
   ```

   It asks which packages changed and how (`patch` / `minor` / `major`), then
   writes a Markdown file in `.changeset/`. Commit that file with your change.

2. Review pending changesets with `pnpm changeset status` and apply version
   bumps and changelogs with `pnpm changeset version`.

3. Node packages are published independently by
   `.github/workflows/node-release.yml` when its versioned tags are pushed.
   Docker images and their GitHub Release are managed independently by
   `.github/workflows/docker-publish.yml`.

## Which packages are published

Published to npm (public):

- `@notploy/cli`
- `@notploy/sdk`
- `@notploy/mcp`
- `@notploy/server`

Versioned but never published (they are internal or deployed as containers):

- `@notploy/app` (the dashboard/server, shipped as a Docker image)
- `@notploy/docs`, `@notploy/website` (deployed to GitHub Pages and Docker)
- `@notploy/api`, `@notploy/schedules` (internal services, ignored by changesets)

## Common commands

```bash
pnpm changeset status    # what would be released
pnpm changeset version   # apply pending changesets locally
pnpm changeset add       # add a new changeset
```
