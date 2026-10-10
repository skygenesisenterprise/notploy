#!/usr/bin/env bash
# Writes the navigation (meta.json) for the new Notploy-native taxonomy.
set -euo pipefail
cd "$(dirname "$0")/.."
cd content/docs

w() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

w meta.json <<'JSON'
{
	"title": "Notploy Documentation",
	"pages": [
		"---Discover Notploy---",
		"discover",
		"---Get started---",
		"get-started",
		"---Applications & deployment---",
		"applications",
		"---Infrastructure---",
		"infrastructure",
		"---Operate & administer---",
		"operate",
		"---Develop & integrate---",
		"develop",
		"---Notploy Cloud---",
		"cloud",
		"---Security---",
		"security",
		"---Migration & compatibility---",
		"migration",
		"---Reference---",
		"reference"
	]
}
JSON

w discover/meta.json <<'JSON'
{
	"title": "Discover Notploy",
	"description": "What Notploy is, the problems it solves, and the model behind the platform.",
	"icon": "Compass",
	"pages": [
		"index",
		"philosophy",
		"architecture",
		"concepts",
		"ecosystem",
		"capabilities",
		"editions",
		"comparison",
		"glossary",
		"faq"
	]
}
JSON

w get-started/meta.json <<'JSON'
{
	"title": "Get started",
	"description": "A guided path from prerequisites to a first successful deployment.",
	"icon": "Rocket",
	"pages": [
		"index",
		"prerequisites",
		"installation",
		"manual-installation",
		"interface-overview",
		"first-login",
		"connect-source",
		"first-deployment",
		"domain-and-tls",
		"verify-deployment",
		"upgrade-backup-restore",
		"uninstall"
	]
}
JSON

w applications/meta.json <<'JSON'
{
	"title": "Applications & deployment",
	"description": "Projects, sources, build workflows, databases, domains and the deployment lifecycle.",
	"icon": "Boxes",
	"pages": [
		"index",
		"sources",
		"docker-compose",
		"databases",
		"environment-variables",
		"domains",
		"build-types",
		"advanced",
		"rollbacks",
		"zero-downtime",
		"preview-deployments",
		"going-production",
		"auto-deploy",
		"scheduled-jobs",
		"watch-paths",
		"patches",
		"ai-assistant"
	]
}
JSON

w applications/sources/meta.json <<'JSON'
{
	"title": "Sources & providers",
	"description": "Where Notploy pulls code and images from.",
	"pages": ["index", "github", "gitlab", "bitbucket", "gitea", "docker"]
}
JSON

w applications/docker-compose/meta.json <<'JSON'
{
	"title": "Docker Compose",
	"description": "Deploy multi-service stacks from a compose file.",
	"pages": ["index", "domains", "utilities", "example"]
}
JSON

w applications/databases/meta.json <<'JSON'
{
	"title": "Databases",
	"description": "Provision and operate PostgreSQL, MySQL, MariaDB, MongoDB and Redis.",
	"pages": ["index", "backups", "restore", "connection"]
}
JSON

w applications/databases/connection/meta.json <<'JSON'
{
	"title": "Connecting clients",
	"pages": ["index", "mariadb", "mysql", "redis", "mongo-atlas", "pg-admin"]
}
JSON

w applications/domains/meta.json <<'JSON'
{
	"title": "Domains",
	"description": "Route traffic to your services and terminate TLS.",
	"pages": ["index", "generated", "cloudflare", "others"]
}
JSON

w infrastructure/meta.json <<'JSON'
{
	"title": "Infrastructure",
	"description": "Servers, Docker, Traefik, DNS, certificates, registries, storage and secrets.",
	"icon": "Server",
	"pages": [
		"index",
		"deployment-options",
		"servers",
		"ssh-keys",
		"swarm",
		"traefik",
		"dns-providers",
		"certificates",
		"registries",
		"object-storage",
		"secrets-providers",
		"notifications",
		"backups",
		"volume-backups"
	]
}
JSON

w infrastructure/servers/meta.json <<'JSON'
{
	"title": "Servers",
	"description": "Execution targets: local server, remote deployment and build servers.",
	"pages": ["index", "deploy-server", "build-server", "deployments", "validate", "security"]
}
JSON

w infrastructure/dns-providers/meta.json <<'JSON'
{
	"title": "DNS providers",
	"pages": ["index", "cloudflare", "route53"]
}
JSON

w infrastructure/registries/meta.json <<'JSON'
{
	"title": "Container registries",
	"description": "Push and pull images for remote servers and clusters.",
	"pages": ["index", "dockerhub", "ghcr", "digital-ocean"]
}
JSON

w infrastructure/object-storage/meta.json <<'JSON'
{
	"title": "Object storage (S3)",
	"description": "S3-compatible destinations for database and volume backups.",
	"pages": ["index", "aws-s3", "cloudflare-r2", "backblaze-b2", "cloud-storage", "actions"]
}
JSON

w infrastructure/secrets-providers/meta.json <<'JSON'
{
	"title": "Secrets providers",
	"pages": ["index", "hashicorp", "infisical", "aws", "doppler", "azure", "scaleway"]
}
JSON

w infrastructure/notifications/meta.json <<'JSON'
{
	"title": "Notifications",
	"description": "Receive deployment and alert notifications where your team works.",
	"pages": [
		"overview",
		"slack",
		"mattermost",
		"telegram",
		"discord",
		"lark",
		"teams",
		"email",
		"resend",
		"gotify",
		"ntfy",
		"pushover",
		"webhook"
	]
}
JSON

w operate/meta.json <<'JSON'
{
	"title": "Operate & administer",
	"description": "Monitoring, maintenance, access control, troubleshooting and enterprise controls.",
	"icon": "Activity",
	"pages": [
		"index",
		"monitoring",
		"concurrent-builds",
		"multi-tenancy",
		"permissions",
		"account-security",
		"enterprise",
		"troubleshooting",
		"guides"
	]
}
JSON

w operate/enterprise/meta.json <<'JSON'
{
	"title": "Enterprise",
	"description": "Licensed capabilities for organizations: SSO, SCIM, custom roles, audit logs and whitelabeling.",
	"pages": ["index", "license-keys", "sso", "scim", "custom-roles", "audit-logs", "whitelabeling"]
}
JSON

w operate/enterprise/sso/meta.json <<'JSON'
{
	"title": "SSO",
	"pages": ["index", "auth0", "azure", "keycloak", "okta", "zitadel", "application-authentication"]
}
JSON

w operate/troubleshooting/meta.json <<'JSON'
{
	"title": "Troubleshooting",
	"pages": ["index", "domains", "volumes-mounts", "networking", "logs-monitoring", "instance"]
}
JSON

w operate/guides/meta.json <<'JSON'
{
	"title": "Guides",
	"pages": ["production-hardening", "cloudflare-tunnels", "tailscale"]
}
JSON

w develop/meta.json <<'JSON'
{
	"title": "Develop & integrate",
	"description": "CLI, API, SDK, MCP and editor integrations for automating Notploy.",
	"icon": "Code",
	"pages": [
		"index",
		"cli",
		"sdk",
		"mcp",
		"vscode",
		"integrations",
		"examples",
		"contributing"
	]
}
JSON

w develop/cli/meta.json <<'JSON'
{
	"title": "CLI",
	"description": "Command-line interface for managing Notploy from your terminal.",
	"icon": "SquareTerminal",
	"pages": ["---Get started---", "index", "authentication", "---Commands---", "project", "application", "databases", "enviroment"]
}
JSON

w develop/examples/meta.json <<'JSON'
{
	"title": "Examples",
	"description": "Application blueprints you can deploy on Notploy.",
	"pages": [
		"nextjs",
		"vite-react",
		"remix",
		"nestjs",
		"astro",
		"astro-ssr",
		"vuejs",
		"svelte",
		"solidjs",
		"qwik",
		"preact",
		"lit",
		"tanstack",
		"turborepo",
		"deno",
		"11ty",
		"html"
	]
}
JSON

w cloud/meta.json <<'JSON'
{
	"title": "Notploy Cloud",
	"description": "The managed control plane: onboarding, plans and how it differs from Self-Hosted.",
	"icon": "Cloud",
	"pages": ["index", "onboarding", "plans", "editions"]
}
JSON

w security/meta.json <<'JSON'
{
	"title": "Security",
	"description": "Authentication, credentials, network exposure and the disclosure process.",
	"icon": "ShieldCheck",
	"pages": [
		"index",
		"authentication",
		"api-keys",
		"ssh-access",
		"secrets",
		"tls-network",
		"vulnerability-disclosure"
	]
}
JSON

w migration/meta.json <<'JSON'
{
	"title": "Migration & compatibility",
	"description": "Moving to Notploy from Dokploy, and what compatibility to expect.",
	"icon": "GitMerge",
	"pages": ["index", "from-dokploy", "compatibility"]
}
JSON

w reference/meta.json <<'JSON'
{
	"title": "Reference",
	"description": "Configuration, API, supported platforms, limits and changelog.",
	"icon": "BookOpen",
	"pages": ["index", "api", "environment-variables", "feature-matrix", "platform-support", "limitations", "changelog"]
}
JSON

w reference/api/meta.json <<'JSON'
{
	"title": "API reference",
	"description": "REST endpoints exposed by the Notploy control plane.",
	"icon": "Code",
	"pages": ["index", "..."]
}
JSON

echo "meta written"
