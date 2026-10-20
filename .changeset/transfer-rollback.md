---
"@notploy/server": patch
---

Defer source cleanup during server-to-server transfers until the target
deployment succeeds. If that deployment fails, ownership, networks, and runtime
are rolled back to the intact source instead of leaving the service on the
target without its data.
