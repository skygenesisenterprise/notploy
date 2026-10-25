# Deprecated — dokploy-prom-monitoring-extension

This blueprint is the historical Dokploy monitoring agent
(`dokploy/monitoring`) and is **deprecated for Notploy**.

- It does not deploy Prometheus or Grafana.
- Its `meta.json` still carries Dokploy branding and links.
- Do not use it as the base for the official Notploy observability stack.

## Migration path

The official integration is tracked as the Notploy Prometheus + Grafana
integration maintained by Sky Genesis Enterprise:

- Phase 0/1: shared contracts in `packages/server/src/services/observability/`
  (see `docs/adr/0001-prometheus-grafana-observability.md`).
- Phase 2: new versioned blueprint `templates/blueprints/notploy-observability-stack`
  (Prometheus + Grafana + compatible exporters, persistent volumes, private
  networking, versioned dashboards/rules).
- This legacy blueprint will be removed once the managed stack is validated
  on single-host Notploy Self.

No silent migration will rewrite existing deployments, volumes, secrets, or
user customizations.
