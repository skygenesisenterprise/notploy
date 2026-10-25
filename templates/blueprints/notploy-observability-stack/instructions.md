# Notploy Observability Stack

Official managed Prometheus + Grafana stack maintained by Sky Genesis Enterprise.

## What gets deployed

- **Prometheus** (pinned image, 15-day retention by default) with versioned
  alert rules (`NotployTargetDown`, `NotployHighCpu`, `NotployHighMemory`,
  `NotployLowDisk`).
- **Grafana** with the Prometheus datasource pre-provisioned and two
  versioned dashboards: **Notploy Host Overview** and
  **Notploy Container Overview**.
- **Node Exporter** (host CPU/memory/disk/network) and **cAdvisor**
  (container CPU/memory) on the compose private network.

Prometheus and the exporters have **no public domain** by default. Only
Grafana is exposed through your Notploy domain.

## Lifecycle

- **Install**: deploy this blueprint, open Grafana at your domain
  (`admin` + the generated password).
- **Update**: redeploying the blueprint never touches `prometheus-data` or
  `grafana-storage` volumes, your data and dashboards survive.
- **Delete**: removing the compose removes containers and network; volumes
  are kept until you delete them explicitly — confirm before wiping data.

## Connect Notploy console

Use **Connections / Settings** in the Notploy console (external mode) with:

- Prometheus URL: `http://prometheus:9090` (from inside the same environment)
- Grafana URL: your Grafana domain

The console shows target health, data freshness, available metrics, and deep
links to the full Grafana dashboards.

## Troubleshooting

- **No data**: wait 1–2 scrape intervals (15s default), then check
  Prometheus `Status → Targets`.
- **Target down**: verify the exporter services are running on the private
  network; host metrics require Linux.
- **Dashboard incompatible**: dashboards are versioned (`version: 1`);
  do not edit provisioned files in place — duplicate them in Grafana first.
