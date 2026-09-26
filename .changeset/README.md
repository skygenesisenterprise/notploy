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

2. Merging to `master` opens/updates a **Version Packages** pull request. That
   PR is opened and maintained by `.github/workflows/release.yml`; do not edit
   the version numbers or changelogs by hand.

3. Merging the **Version Packages** pull request publishes the bumped packages
   to npm and creates the matching GitHub Release. It needs the `NPM_TOKEN`
   repository secret.

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
