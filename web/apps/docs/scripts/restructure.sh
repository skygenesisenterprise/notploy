#!/usr/bin/env bash
# One-shot restructure of content/docs into the Notploy-native taxonomy.
# Safe to inspect; uses `git mv` so history is preserved.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="content/docs"
cd "$ROOT"

D="discover get-started applications infrastructure operate develop cloud security migration reference"
for d in $D; do mkdir -p "$d"; done
mkdir -p infrastructure/servers applications/sources applications/docker-compose \
  applications/databases applications/domains infrastructure/dns-providers \
  infrastructure/registries infrastructure/object-storage infrastructure/secrets-providers \
  infrastructure/notifications operate/troubleshooting operate/guides operate/enterprise \
  develop/cli develop/examples reference/api

mv() { git mv "$1" "$2"; }

# --- Discover ---
mv core/index.mdx              discover/index.mdx
mv core/architecture.mdx       discover/architecture.mdx
mv core/features.mdx           discover/capabilities.mdx
mv core/comparison.mdx         discover/comparison.mdx

# --- Get started ---
mv core/installation.mdx       get-started/installation.mdx
mv core/manual-installation.mdx get-started/manual-installation.mdx
mv core/uninstall.mdx          get-started/uninstall.mdx
mv core/interface-overview.mdx get-started/interface-overview.mdx

# --- Applications ---
mv core/applications/index.mdx                applications/index.mdx
mv core/applications/build-type.mdx           applications/build-types.mdx
mv core/applications/advanced.mdx             applications/advanced.mdx
mv core/applications/rollbacks.mdx            applications/rollbacks.mdx
mv core/applications/zero-downtime.mdx        applications/zero-downtime.mdx
mv core/applications/preview-deployments.mdx  applications/preview-deployments.mdx
mv core/applications/going-production.mdx     applications/going-production.mdx
rm -f core/applications/meta.json
mv core/variables.mdx          applications/environment-variables.mdx
mv core/auto-deploy.mdx        applications/auto-deploy.mdx
mv core/schedule-jobs.mdx      applications/scheduled-jobs.mdx
mv core/watch-paths.mdx        applications/watch-paths.mdx
mv core/patches.mdx            applications/patches.mdx
mv core/ai.mdx                 applications/ai-assistant.mdx
mv core/providers.mdx          applications/sources/index.mdx
for f in core/\(Git-Sources\)/*.mdx; do mv "$f" "applications/sources/$(basename "$f")"; done
for f in core/docker-compose/*; do mv "$f" "applications/docker-compose/$(basename "$f")"; done
for f in core/databases/connection/*; do mv "$f" "applications/databases/connection/$(basename "$f")" 2>/dev/null || true; done
for f in core/databases/*.mdx; do mv "$f" "applications/databases/$(basename "$f")"; done
for f in core/domains/*; do mv "$f" "applications/domains/$(basename "$f")"; done

# --- Infrastructure ---
mv core/remote-servers/index.mdx         infrastructure/servers/index.mdx
mv core/remote-servers/instructions.mdx  infrastructure/servers/deploy-server.mdx
mv core/remote-servers/build-server.mdx  infrastructure/servers/build-server.mdx
mv core/remote-servers/deployments.mdx   infrastructure/servers/deployments.mdx
mv core/remote-servers/security.mdx      infrastructure/servers/security.mdx
mv core/remote-servers/validate.mdx      infrastructure/servers/validate.mdx
mv core/deployment-options.mdx infrastructure/deployment-options.mdx
mv core/ssh-keys.mdx           infrastructure/ssh-keys.mdx
mv core/cluster.mdx            infrastructure/swarm.mdx
mv core/certificates.mdx       infrastructure/certificates.mdx
mv core/backups.mdx            infrastructure/backups.mdx
mv core/volume-backups.mdx     infrastructure/volume-backups.mdx
for f in core/dns-providers/*; do mv "$f" "infrastructure/dns-providers/$(basename "$f")"; done
for f in core/registry/*; do mv "$f" "infrastructure/registries/$(basename "$f")"; done
for f in core/\(S3-Destinations\)/*; do mv "$f" "infrastructure/object-storage/$(basename "$f")"; done
for f in core/secrets-providers/*; do mv "$f" "infrastructure/secrets-providers/$(basename "$f")"; done
for f in core/\(Notifications\)/*; do mv "$f" "infrastructure/notifications/$(basename "$f")"; done

# --- Operate ---
mv core/monitoring.mdx         operate/monitoring.mdx
mv core/concurrent-builds.mdx  operate/concurrent-builds.mdx
mv core/multi-tenancy.mdx      operate/multi-tenancy.mdx
mv core/account-security.mdx   operate/account-security.mdx
mv core/\(Users\)/permissions.mdx operate/permissions.mdx
for f in core/troubleshooting/*; do mv "$f" "operate/troubleshooting/$(basename "$f")"; done
for f in core/guides/*; do mv "$f" "operate/guides/$(basename "$f")"; done
for f in core/enterprise/*; do mv "$f" "operate/enterprise/$(basename "$f")"; done

# --- Develop ---
for f in cli/*; do mv "$f" "develop/cli/$(basename "$f")"; done
for f in core/\(examples\)/*; do mv "$f" "develop/examples/$(basename "$f")"; done

# --- Cloud ---
mv core/cloud.mdx              cloud/index.mdx
mv core/differences.mdx        cloud/editions.mdx

# --- Reference ---
for f in api/*; do mv "$f" "reference/api/$(basename "$f")"; done

# --- Remove inherited, inaccurate content ---
git rm -q core/goodies.mdx core/videos.mdx core/meta.json

# Clean up now-empty legacy folders
rmdir -p core/applications core/remote-servers core/databases/connection core/databases \
  core/domains core/docker-compose core/\(Git-Sources\) core/\(Users\) core/\(examples\) \
  core/dns-providers core/registry core/\(S3-Destinations\) core/secrets-providers \
  core/\(Notifications\) core/troubleshooting core/guides core/enterprise/sso core/enterprise \
  cli api 2>/dev/null || true
rm -rf core cli api

echo "restructure done"
