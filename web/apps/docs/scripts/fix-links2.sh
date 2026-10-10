#!/usr/bin/env bash
# Pass 2 link rewrite: round-1 taxonomy URLs -> final Core/CLI/API/Templates URLs.
set -euo pipefail
cd "$(dirname "$0")/.."

PAIRS='
/docs/discover/index /docs/core
/docs/discover/architecture /docs/core/architecture
/docs/discover/concepts /docs/core/concepts
/docs/discover/capabilities /docs/core/features
/docs/discover/philosophy /docs/core/philosophy
/docs/discover/ecosystem /docs/core/ecosystem
/docs/discover/comparison /docs/core/comparison
/docs/discover/glossary /docs/core/glossary
/docs/discover/faq /docs/core/faq
/docs/discover/editions /docs/core/differences
/docs/discover/differences /docs/core/differences
/docs/discover /docs/core
/docs/get-started/index /docs/core/get-started
/docs/get-started/domain-and-tls /docs/core/domain-and-tls
/docs/get-started/installation /docs/core/installation
/docs/get-started/manual-installation /docs/core/manual-installation
/docs/get-started/prerequisites /docs/core/prerequisites
/docs/get-started/first-login /docs/core/first-login
/docs/get-started/connect-source /docs/core/connect-source
/docs/get-started/first-deployment /docs/core/first-deployment
/docs/get-started/verify-deployment /docs/core/verify-deployment
/docs/get-started/upgrade-backup-restore /docs/core/upgrade-backup-restore
/docs/get-started/uninstall /docs/core/uninstall
/docs/get-started/interface-overview /docs/core/interface-overview
/docs/get-started /docs/core/get-started
/docs/applications/sources/github /docs/core/github
/docs/applications/sources/gitlab /docs/core/gitlab
/docs/applications/sources/bitbucket /docs/core/bitbucket
/docs/applications/sources/gitea /docs/core/gitea
/docs/applications/sources/docker /docs/core/docker
/docs/applications/sources /docs/core/providers
/docs/applications/build-types /docs/core/applications/build-type
/docs/applications/build-type /docs/core/applications/build-type
/docs/applications/environment-variables /docs/core/variables
/docs/applications/scheduled-jobs /docs/core/schedule-jobs
/docs/applications/watch-paths /docs/core/watch-paths
/docs/applications/patches /docs/core/patches
/docs/applications/ai-assistant /docs/core/ai
/docs/applications/auto-deploy /docs/core/auto-deploy
/docs/applications/advanced /docs/core/applications/advanced
/docs/applications/rollbacks /docs/core/applications/rollbacks
/docs/applications/zero-downtime /docs/core/applications/zero-downtime
/docs/applications/preview-deployments /docs/core/applications/preview-deployments
/docs/applications/going-production /docs/core/applications/going-production
/docs/applications/databases /docs/core/databases
/docs/applications/docker-compose /docs/core/docker-compose
/docs/applications/domains /docs/core/domains
/docs/applications/index /docs/core/applications
/docs/applications /docs/core/applications
/docs/infrastructure/object-storage/aws-s3 /docs/core/aws-s3
/docs/infrastructure/object-storage/cloudflare-r2 /docs/core/cloudflare-r2
/docs/infrastructure/object-storage/backblaze-b2 /docs/core/backblaze-b2
/docs/infrastructure/object-storage/cloud-storage /docs/core/cloud-storage
/docs/infrastructure/object-storage/actions /docs/core/actions
/docs/infrastructure/object-storage /docs/core/s3-destinations
/docs/infrastructure/notifications/overview /docs/core/overview
/docs/infrastructure/notifications/slack /docs/core/slack
/docs/infrastructure/notifications/mattermost /docs/core/mattermost
/docs/infrastructure/notifications/telegram /docs/core/telegram
/docs/infrastructure/notifications/discord /docs/core/discord
/docs/infrastructure/notifications/lark /docs/core/lark
/docs/infrastructure/notifications/teams /docs/core/teams
/docs/infrastructure/notifications/email /docs/core/email
/docs/infrastructure/notifications/resend /docs/core/resend
/docs/infrastructure/notifications/gotify /docs/core/gotify
/docs/infrastructure/notifications/ntfy /docs/core/ntfy
/docs/infrastructure/notifications/pushover /docs/core/pushover
/docs/infrastructure/notifications/webhook /docs/core/webhook
/docs/infrastructure/notifications /docs/core/overview
/docs/infrastructure/registries /docs/core/registry
/docs/infrastructure/secrets-providers /docs/core/secrets-providers
/docs/infrastructure/dns-providers /docs/core/dns-providers
/docs/infrastructure/servers /docs/core/remote-servers
/docs/infrastructure/deployment-options /docs/core/deployment-options
/docs/infrastructure/ssh-keys /docs/core/ssh-keys
/docs/infrastructure/swarm /docs/core/cluster
/docs/infrastructure/traefik /docs/core/traefik
/docs/infrastructure/certificates /docs/core/certificates
/docs/infrastructure/backups /docs/core/backups
/docs/infrastructure/volume-backups /docs/core/volume-backups
/docs/infrastructure/index /docs/core/infrastructure
/docs/infrastructure /docs/core/infrastructure
/docs/operate/index /docs/core/administration
/docs/operate/monitoring /docs/core/monitoring
/docs/operate/concurrent-builds /docs/core/concurrent-builds
/docs/operate/multi-tenancy /docs/core/multi-tenancy
/docs/operate/permissions /docs/core/permissions
/docs/operate/account-security /docs/core/account-security
/docs/operate/reset-password /docs/core/reset-password
/docs/operate/enterprise /docs/core/enterprise
/docs/operate/troubleshooting /docs/core/troubleshooting
/docs/operate/guides /docs/core/guides
/docs/operate /docs/core/administration
/docs/develop/cli /docs/cli
/docs/develop/examples /docs/templates/examples
/docs/develop/sdk /docs/core/develop/sdk
/docs/develop/mcp /docs/core/develop/mcp
/docs/develop/vscode /docs/core/develop/vscode
/docs/develop/integrations /docs/core/develop/integrations
/docs/develop/contributing /docs/core/develop/contributing
/docs/develop/index /docs/core/develop
/docs/develop /docs/core/develop
/docs/cloud/index /docs/core/cloud
/docs/cloud/onboarding /docs/core/cloud-onboarding
/docs/cloud/plans /docs/core/cloud-plans
/docs/cloud /docs/core/cloud
/docs/security /docs/core/security
/docs/migration /docs/core/migration
/docs/reference/api /docs/api
/docs/reference/environment-variables /docs/core/reference/environment-variables
/docs/reference/feature-matrix /docs/core/reference/feature-matrix
/docs/reference/platform-support /docs/core/reference/platform-support
/docs/reference/limitations /docs/core/reference/limitations
/docs/reference/changelog /docs/core/reference/changelog
/docs/reference/index /docs/core/reference
/docs/reference /docs/core/reference
'

# Longest old path first, so specific routes win over folder prefixes.
SORTED=$(printf '%s\n' "$PAIRS" | sed '/^$/d' | awk '{ print length($1) " " $0 }' | sort -rn | cut -d' ' -f2-)

FILES=$(find content app components lib -type f \( -name '*.mdx' -o -name '*.md' -o -name '*.tsx' -o -name '*.ts' \) 2>/dev/null)

while read -r old new; do
  [ -n "$old" ] || continue
  for f in $FILES; do
    sed -i "s#${old}#${new}#g" "$f"
  done
done <<< "$SORTED"

echo "links2 rewritten"
