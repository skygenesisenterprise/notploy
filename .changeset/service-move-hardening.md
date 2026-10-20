---
"@notploy/server": patch
"@notploy/app": patch
---

Harden logical service moves: refuse cross-organization targets, require
service create access on the target project, enforce the target project's
resource quota, and expose a read-only `service.movePreview` with preserved
resources, recalculated permissions, and quota state. A "Move service" dialog
on application, Compose, and database pages shows that preview, blocks
confirmation when the target quota is exceeded, and preserves volumes, domains,
and networks. Compose moves get the same cross-org and target-access checks.
Moving only changes the owning environment; it does not redeploy the service.
