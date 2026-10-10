#!/usr/bin/env bash
# Rewrites internal documentation links from the legacy taxonomy
# (/docs/core/..., /docs/cli/..., /docs/api/...) to the new Notploy taxonomy.
set -euo pipefail
cd "$(dirname "$0")/.."

# Map `core/<old>` -> `<new>`. Order matters: longer prefixes first.
MAP=(
  "core/docker-compose applications/docker-compose"
  "core/remote-servers infrastructure/servers"
  "core/databases applications/databases"
  "core/troubleshooting operate/troubleshooting"
  "core/enterprise operate/enterprise"
  "core/dns-providers infrastructure/dns-providers"
  "core/secrets-providers infrastructure/secrets-providers"
  "core/concurrent-builds operate/concurrent-builds"
  "core/multi-tenancy operate/multi-tenancy"
  "core/account-security operate/account-security"
  "core/reset-password operate/reset-password"
  "core/deployment-options infrastructure/deployment-options"
  "core/manual-installation get-started/manual-installation"
  "core/interface-overview get-started/interface-overview"
  "core/volume-backups infrastructure/volume-backups"
  "core/schedule-jobs applications/scheduled-jobs"
  "core/watch-paths applications/watch-paths"
  "core/auto-deploy applications/auto-deploy"
  "core/certificates infrastructure/certificates"
  "core/permissions operate/permissions"
  "core/ssh-keys infrastructure/ssh-keys"
  "core/uninstall get-started/uninstall"
  "core/architecture discover/architecture"
  "core/comparison discover/comparison"
  "core/features discover/capabilities"
  "core/backups infrastructure/backups"
  "core/monitoring operate/monitoring"
  "core/patches applications/patches"
  "core/cluster infrastructure/swarm"
  "core/guides operate/guides"
  "core/get-started/installation get-started/installation"
  "core/installation get-started/installation"
  "core/registry infrastructure/registries"
  "core/variables applications/environment-variables"
  "core/domains applications/domains"
  "core/applications applications"
  "core/github applications/sources/github"
  "core/gitlab applications/sources/gitlab"
  "core/gitea applications/sources/gitea"
  "core/bitbucket applications/sources/bitbucket"
  "core/docker applications/sources/docker"
  "core/cloud cloud"
  "core/ai applications/ai-assistant"
  "core/overview discover/index"
)

FILES=$(find content app components lib -type f \( -name '*.mdx' -o -name '*.md' -o -name '*.tsx' -o -name '*.ts' \) 2>/dev/null)

for pair in "${MAP[@]}"; do
  old="/docs/${pair%% *}"
  new="/docs/${pair##* }"
  for f in $FILES; do
    sed -i "s#${old}#${new}#g" "$f"
  done
done

# Legacy root prefixes as a whole.
for f in $FILES; do
  sed -i 's#/docs/cli#/docs/develop/cli#g; s#/docs/api#/docs/reference/api#g' "$f"
  sed -i 's#/docs/core#/docs/discover#g' "$f"
done

echo "links rewritten"
