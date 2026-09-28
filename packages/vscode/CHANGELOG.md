# Changelog

All notable changes to the Notploy extension for Visual Studio Code are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-28

First public release. The extension is published as `notploy.notploy` and requires VS Code 1.96 or newer.

### Added

- Activity Bar container with five views: **Instances**, **Projects**, **Deployments**, **Infrastructure** and **Workspace**. Sections load on demand, so opening a view does not issue a burst of requests.
- Multiple instances side by side — Notploy Cloud, self-hosted, or local — with per-instance credentials and state, an active-instance selection, and a status bar entry showing the active instance and its connection state.
- Instance management: add, remove, select, test the connection, open the dashboard in a browser, and inspect the instance's capabilities.
- Authentication with a Notploy API key. The key is verified against `user.session` before being stored, kept in VS Code's SecretStorage only, and never written to `settings.json`, a workspace file, or a log line.
- Project browsing: projects, environments, applications and Compose projects, with their status.
- Deployment history per application, with deploy, redeploy, restart, start, stop, cancel and remove actions, open in browser, and copy ID.
- Logs for deployments and applications in a dedicated output channel per target, with follow mode, copy and clear, a bounded in-memory buffer, and configurable polling interval.
- Infrastructure view for servers, Docker containers, images, volumes and networks, and Docker Swarm nodes, including start, stop, restart and JSON inspect for containers.
- Workspace binding through an optional `notploy.yaml`, `notploy.yml` or `notploy.json` manifest, or through the palette, linking a repository folder to an existing Notploy project.
- Git context in the Workspace view — repository, branch and commit — read through VS Code's built-in Git extension only; GitHub is never required.
- Capability detection from the instance's OpenAPI document, so views a given instance cannot serve report why instead of failing on click.
- Settings for the default instance, request timeout, background refresh, log following, log buffer size, deployment history length, confirmation of destructive actions, and opt-in insecure TLS per instance.
- Redaction of credential-like values in error payloads, and confirmation prompts before destructive actions.

### Notes

- **Kubernetes is not available.** The Notploy API exposes no `kubernetes` router; its `cluster.*` and `swarm.*` procedures manage Docker Swarm. The Infrastructure view reports this rather than inventing clusters, namespaces or pods. The `notploy.kubernetes.enabled` setting is reserved for the integration, which will be enabled as soon as an instance advertises the router.
- **Container logs are unavailable**, as the API has no endpoint returning a Docker container's logs.
- **Log following is polling.** The API has no WebSocket or server-sent-events route, so "follow" re-fetches on an interval.

[Unreleased]: https://github.com/skygenesisenterprise/notploy/compare/v0.1.0-vscode...HEAD
[0.1.0]: https://github.com/skygenesisenterprise/notploy/releases/tag/v0.1.0-vscode
