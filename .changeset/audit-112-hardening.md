---
"@notploy/server": patch
"@notploy/app": patch
---

Harden Notploy against secret leakage and orphaned resources: central secret
redaction for logs, errors and notifications, idempotent WebSocket/SSH/PTY
cleanup, portable database backups without a container shell or gzip,
explicit port-mapping conflict validation, and project-level access inheritance
for existing and future services and environments.
