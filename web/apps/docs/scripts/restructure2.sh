#!/usr/bin/env bash
# Pass 2: reorganize into the Dokploy-style 4-pole chassis
#   core/       (everything product/usage, Dokploy-inherited section names)
#   cli/        (command-line client)
#   api/        (REST reference)
#   templates/  (blueprints + examples)
set -euo pipefail
cd "$(dirname "$0")/.."
cd content/docs

mkdir -p core
for d in \
  core/'(S3-Destinations)' core/'(Git-Sources)' core/'(Users)' core/'(Notifications)' core/'(examples)' \
  core/registry core/secrets-providers core/dns-providers core/domains core/applications \
  core/docker-compose core/databases/connection core/remote-servers core/enterprise/sso \
  core/troubleshooting core/guides core/security core/migration core/reference core/develop \
  cli api templates/examples; do mkdir -p "$d"; done

M() {
  [ -e "$1" ] || return 0
  if git ls-files --error-unmatch "$1" >/dev/null 2>&1; then
    git mv "$1" "$2"
  else
    mkdir -p "$(dirname "$2")"
    mv "$1" "$2"
  fi
}

# --- Introduction / Get started --------------------------------------------
M discover/index.mdx            core/index.mdx
M discover/architecture.mdx     core/architecture.mdx
M discover/concepts.mdx         core/concepts.mdx
M discover/capabilities.mdx     core/features.mdx
M discover/philosophy.mdx       core/philosophy.mdx
M discover/ecosystem.mdx        core/ecosystem.mdx
M discover/comparison.mdx       core/comparison.mdx
M discover/glossary.mdx         core/glossary.mdx
M discover/faq.mdx              core/faq.mdx
M discover/editions.mdx         core/differences.mdx
M get-started/index.mdx         core/get-started.mdx
M get-started/prerequisites.mdx core/prerequisites.mdx
M get-started/installation.mdx  core/installation.mdx
M get-started/manual-installation.mdx core/manual-installation.mdx
M get-started/first-login.mdx   core/first-login.mdx
M get-started/connect-source.mdx core/connect-source.mdx
M get-started/first-deployment.mdx core/first-deployment.mdx
M get-started/domain-and-tls.mdx core/domain-and-tls.mdx
M get-started/verify-deployment.mdx core/verify-deployment.mdx
M get-started/upgrade-backup-restore.mdx core/upgrade-backup-restore.mdx
M get-started/uninstall.mdx     core/uninstall.mdx
M operate/reset-password.mdx    core/reset-password.mdx

# --- Screenshots ------------------------------------------------------------
M get-started/interface-overview.mdx core/interface-overview.mdx

# --- Cloud (managed + monitoring + differences) -----------------------------
M cloud/index.mdx               core/cloud.mdx
M cloud/onboarding.mdx          core/cloud-onboarding.mdx
M cloud/plans.mdx               core/cloud-plans.mdx
M operate/monitoring.mdx        core/monitoring.mdx

# --- Server -----------------------------------------------------------------
M applications/ai-assistant.mdx core/ai.mdx
M operate/permissions.mdx       core/'(Users)'/permissions.mdx
M operate/account-security.mdx  core/account-security.mdx
M operate/concurrent-builds.mdx core/concurrent-builds.mdx
M operate/multi-tenancy.mdx     core/multi-tenancy.mdx
M infrastructure/ssh-keys.mdx   core/ssh-keys.mdx
M infrastructure/certificates.mdx core/certificates.mdx
M infrastructure/backups.mdx    core/backups.mdx
for f in infrastructure/object-storage/*;     do M "$f" "core/(S3-Destinations)/$(basename "$f")"; done
for f in infrastructure/notifications/*;      do M "$f" "core/(Notifications)/$(basename "$f")"; done
for f in infrastructure/registries/*;         do M "$f" "core/registry/$(basename "$f")"; done
for f in infrastructure/secrets-providers/*;  do M "$f" "core/secrets-providers/$(basename "$f")"; done
for f in infrastructure/dns-providers/*;      do M "$f" "core/dns-providers/$(basename "$f")"; done

# --- Services ---------------------------------------------------------------
M applications/index.mdx        core/applications/index.mdx
M applications/build-types.mdx  core/applications/build-type.mdx
M applications/advanced.mdx     core/applications/advanced.mdx
M applications/rollbacks.mdx    core/applications/rollbacks.mdx
M applications/zero-downtime.mdx core/applications/zero-downtime.mdx
M applications/preview-deployments.mdx core/applications/preview-deployments.mdx
M applications/going-production.mdx core/applications/going-production.mdx
M applications/environment-variables.mdx core/variables.mdx
M applications/auto-deploy.mdx  core/auto-deploy.mdx
M applications/scheduled-jobs.mdx core/schedule-jobs.mdx
M applications/watch-paths.mdx  core/watch-paths.mdx
M applications/patches.mdx      core/patches.mdx
M infrastructure/volume-backups.mdx core/volume-backups.mdx
for f in applications/sources/*;    do M "$f" "core/(Git-Sources)/$(basename "$f")"; done
for f in applications/domains/*;    do M "$f" "core/domains/$(basename "$f")"; done
for f in applications/docker-compose/*; do M "$f" "core/docker-compose/$(basename "$f")"; done
for f in applications/databases/*.mdx;  do M "$f" "core/databases/$(basename "$f")"; done
for f in applications/databases/connection/*; do M "$f" "core/databases/connection/$(basename "$f")"; done

# --- Remote Servers / Advanced ----------------------------------------------
M infrastructure/deployment-options.mdx core/deployment-options.mdx
M infrastructure/swarm.mdx      core/cluster.mdx
M infrastructure/traefik.mdx    core/traefik.mdx
for f in infrastructure/servers/*; do M "$f" "core/remote-servers/$(basename "$f")"; done

# --- Enterprise / Troubleshooting / Guides ----------------------------------
for f in operate/enterprise/*.mdx; do M "$f" "core/enterprise/$(basename "$f")"; done
for f in operate/enterprise/sso/*; do M "$f" "core/enterprise/sso/$(basename "$f")"; done
for f in operate/troubleshooting/*; do M "$f" "core/troubleshooting/$(basename "$f")"; done
for f in operate/guides/*;          do M "$f" "core/guides/$(basename "$f")"; done

# --- Security / Migration / Reference ---------------------------------------
for f in security/*.mdx;  do M "$f" "core/security/$(basename "$f")"; done
for f in migration/*.mdx; do M "$f" "core/migration/$(basename "$f")"; done
M reference/index.mdx               core/reference/index.mdx
M reference/environment-variables.mdx core/reference/environment-variables.mdx
M reference/feature-matrix.mdx      core/reference/feature-matrix.mdx
M reference/platform-support.mdx    core/reference/platform-support.mdx
M reference/limitations.mdx         core/reference/limitations.mdx
M reference/changelog.mdx           core/reference/changelog.mdx

# --- Develop -----------------------------------------------------------------
M develop/index.mdx         core/develop/index.mdx
M develop/sdk.mdx           core/develop/sdk.mdx
M develop/mcp.mdx           core/develop/mcp.mdx
M develop/vscode.mdx        core/develop/vscode.mdx
M develop/integrations.mdx  core/develop/integrations.mdx
M develop/contributing.mdx  core/develop/contributing.mdx

# --- Poles: CLI, API, Templates ---------------------------------------------
for f in develop/cli/*;      do M "$f" "cli/$(basename "$f")"; done
for f in reference/api/*;    do M "$f" "api/$(basename "$f")"; done
for f in develop/examples/*; do M "$f" "templates/examples/$(basename "$f")"; done

# Drop legacy metas (rewritten in write-meta2.sh) and empty dirs.
find . -name meta.json -delete
find . -type d -empty -delete 2>/dev/null || true
echo "restructure2 done"
