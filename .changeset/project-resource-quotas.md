---
"@notploy/server": minor
"@notploy/app": minor
---

Add logical CPU/memory quotas per project. Service limit updates, quota
reductions below declared usage, and reservation-over-limit settings are
refused with an explicit `PRECONDITION_FAILED` message and a `quotaExceeded`
audit entry. A `project.quota` endpoint and the project settings dialog expose
configured quotas and declared usage, labelled as logical limits rather than
runtime isolation.
