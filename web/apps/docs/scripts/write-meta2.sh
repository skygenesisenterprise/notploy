#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cd content/docs

w() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

w meta.json <<'JSON'
{
	"pages": ["core", "cli", "api", "templates"]
}
JSON

w core/meta.json <<'JSON'
{
	"title": "Core",
	"description": "Everything about deploying and operating Notploy.",
	"icon": "Package",
	"root": true,
	"pages": [
		"---Introduction---",
		"index",
		"architecture",
		"concepts",
		"features",
		"philosophy",
		"ecosystem",
		"comparison",
		"glossary",
		"faq",
		"get-started",
		"prerequisites",
		"installation",
		"manual-installation",
		"first-login",
		"connect-source",
		"first-deployment",
		"domain-and-tls",
		"verify-deployment",
		"upgrade-backup-restore",
		"reset-password",
		"uninstall",
		"---Screenshots---",
		"interface-overview",
		"---Cloud---",
		"cloud",
		"cloud-onboarding",
		"cloud-plans",
		"differences",
		"monitoring",
		"---Server---",
		"infrastructure",
		"ai",
		"deployment-options",
		"(S3-Destinations)",
		"(Git-Sources)",
		"(Users)",
		"account-security",
		"(Notifications)",
		"registry",
		"secrets-providers",
		"dns-providers",
		"ssh-keys",
		"certificates",
		"backups",
		"concurrent-builds",
		"multi-tenancy",
		"---Services---",
		"variables",
		"domains",
		"applications",
		"docker-compose",
		"databases",
		"auto-deploy",
		"schedule-jobs",
		"patches",
		"volume-backups",
		"watch-paths",
		"---Remote Servers---",
		"remote-servers",
		"---Advanced---",
		"cluster",
		"traefik",
		"administration",
		"---Enterprise---",
		"enterprise",
		"---Security---",
		"security",
		"---Migration---",
		"migration",
		"---Develop---",
		"develop",
		"---Reference---",
		"reference",
		"---Troubleshooting---",
		"troubleshooting",
		"---Guides---",
		"guides"
	]
}
JSON

w 'core/(Git-Sources)/meta.json' <<'JSON'
{
	"title": "Git Sources",
	"pages": ["index", "github", "gitlab", "bitbucket", "gitea", "docker"]
}
JSON

w 'core/(Notifications)/meta.json' <<'JSON'
{
	"title": "Notifications",
	"pages": ["overview", "slack", "mattermost", "telegram", "discord", "lark", "teams", "email", "resend", "gotify", "ntfy", "pushover", "webhook"]
}
JSON

w 'core/(S3-Destinations)/meta.json' <<'JSON'
{
	"title": "S3 Destinations",
	"pages": ["index", "aws-s3", "cloudflare-r2", "backblaze-b2", "cloud-storage", "actions"]
}
JSON

w core/registry/meta.json <<'JSON'
{
	"title": "Registry",
	"pages": ["index", "dockerhub", "ghcr", "digital-ocean"]
}
JSON

w core/secrets-providers/meta.json <<'JSON'
{
	"title": "Secrets Providers",
	"pages": ["index", "hashicorp", "infisical", "aws", "doppler", "azure", "scaleway"]
}
JSON

w core/dns-providers/meta.json <<'JSON'
{
	"title": "DNS Providers",
	"pages": ["index", "cloudflare", "route53"]
}
JSON

w core/domains/meta.json <<'JSON'
{
	"title": "Domains",
	"pages": ["index", "generated", "cloudflare", "others"]
}
JSON

w core/docker-compose/meta.json <<'JSON'
{
	"title": "Docker Compose",
	"pages": ["index", "domains", "utilities", "example"]
}
JSON

w core/databases/meta.json <<'JSON'
{
	"title": "Databases",
	"pages": ["index", "backups", "restore", "connection"]
}
JSON

w core/databases/connection/meta.json <<'JSON'
{
	"title": "Connection",
	"pages": ["index", "mariadb", "mysql", "redis", "mongo-atlas", "pg-admin"]
}
JSON

w core/applications/meta.json <<'JSON'
{
	"title": "Applications",
	"pages": ["index", "build-type", "advanced", "rollbacks", "zero-downtime", "preview-deployments", "going-production"]
}
JSON

w core/remote-servers/meta.json <<'JSON'
{
	"title": "Remote Servers",
	"pages": ["index", "deploy-server", "build-server", "deployments", "validate", "security"]
}
JSON

w core/enterprise/meta.json <<'JSON'
{
	"title": "Enterprise",
	"pages": ["index", "license-keys", "sso", "scim", "custom-roles", "audit-logs", "whitelabeling"]
}
JSON

w core/enterprise/sso/meta.json <<'JSON'
{
	"title": "SSO",
	"pages": ["index", "auth0", "azure", "keycloak", "okta", "zitadel", "application-authentication"]
}
JSON

w core/troubleshooting/meta.json <<'JSON'
{
	"title": "Troubleshooting",
	"pages": ["index", "domains", "volumes-mounts", "networking", "logs-monitoring", "instance"]
}
JSON

w core/guides/meta.json <<'JSON'
{
	"title": "Guides",
	"pages": ["production-hardening", "cloudflare-tunnels", "tailscale"]
}
JSON

w core/security/meta.json <<'JSON'
{
	"title": "Security",
	"pages": ["index", "authentication", "api-keys", "ssh-access", "secrets", "tls-network", "vulnerability-disclosure"]
}
JSON

w core/migration/meta.json <<'JSON'
{
	"title": "Migration",
	"pages": ["index", "from-dokploy", "compatibility"]
}
JSON

w core/reference/meta.json <<'JSON'
{
	"title": "Reference",
	"pages": ["index", "environment-variables", "feature-matrix", "platform-support", "limitations", "changelog"]
}
JSON

w core/develop/meta.json <<'JSON'
{
	"title": "Develop & integrate",
	"pages": ["index", "sdk", "mcp", "vscode", "integrations", "contributing"]
}
JSON

w cli/meta.json <<'JSON'
{
	"title": "CLI",
	"description": "Command-line interface for managing Notploy from your terminal.",
	"icon": "SquareTerminal",
	"root": true,
	"pages": ["---Get started---", "index", "authentication", "---Commands---", "project", "application", "databases", "enviroment"]
}
JSON

w api/meta.json <<'JSON'
{
	"title": "API",
	"description": "RESTful API reference for programmatic access to Notploy.",
	"icon": "Code",
	"root": true,
	"pages": ["---Get started---", "index", "---Reference---", "..."]
}
JSON

w templates/meta.json <<'JSON'
{
	"title": "Templates",
	"description": "Blueprints and application examples you can deploy on Notploy.",
	"icon": "LayoutTemplate",
	"root": true,
	"pages": ["index", "---Examples---", "examples"]
}
JSON

echo "meta2 written"
