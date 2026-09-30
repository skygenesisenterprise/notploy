/**
 * Homepage content of the Notploy website.
 *
 * The homepage sections are driven by this configuration and the message
 * catalogs (`home.*` keys in `messages/{fr,en}.json`), so the content can
 * evolve without rewriting the interface. Hrefs are derived from the site
 * structure (`lib/site-structure.ts`) so the homepage and the navigation can
 * never drift apart; labels are never stored here.
 *
 * Every entry is grounded in the monorepo: the build strategies, database
 * engines and deployment targets listed below are exactly the ones the
 * platform ships (see `packages/server` and `apps/notploy`).
 */

import type { FrIconClassName } from "@skygenesisenterprise/react-sds/fr";
import { externalLinks, productPaths } from "./site-structure";

/** A figure of the homepage stat band (label resolved from `home.stats.<key>`). */
export type HomeStat = {
  key: string;
  /** Literal value — never a translated string. */
  value: string;
};

/** A destination tile of the homepage. */
export type HomeTile = {
  key: string;
  iconId: FrIconClassName;
  href: string;
  external?: boolean;
};

/** A non-navigational explanatory card (label resolved from `home.*`). */
export type HomeCard = {
  key: string;
  iconId: FrIconClassName;
};

/** One step of the deployment workflow (label resolved from `home.*`). */
export type HomeStep = {
  key: string;
};

export const notployHome = {
  /** 02 — Reference figures of the platform, all verifiable in the repository. */
  stats: [
    { key: "databases", value: "5" },
    { key: "builders", value: "4" },
    { key: "targets", value: "3" },
    { key: "license", value: "MIT" },
  ] satisfies ReadonlyArray<HomeStat>,

  /** 03 — What the platform does, section by section. */
  capabilities: [
    { key: "applications", iconId: "fr-icon-send-plane-line", href: productPaths.platform },
    { key: "compose", iconId: "fr-icon-stack-line", href: productPaths.platform },
    { key: "databases", iconId: "fr-icon-database-line", href: productPaths.platform },
    { key: "routing", iconId: "fr-icon-road-map-line", href: productPaths.platform },
    { key: "monitoring", iconId: "fr-icon-line-chart-line", href: productPaths.platform },
    { key: "servers", iconId: "fr-icon-server-line", href: productPaths.platform },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 04 — The deployment workflow: connect, build, deploy, route, operate. */
  workflow: [
    { key: "connect" },
    { key: "build" },
    { key: "deploy" },
    { key: "route" },
    { key: "operate" },
  ] satisfies ReadonlyArray<HomeStep>,

  /** 06 — The database engines the platform provisions and backs up. */
  databases: [
    { key: "postgresql", iconId: "fr-icon-database-line" },
    { key: "mysql", iconId: "fr-icon-database-line" },
    { key: "mariadb", iconId: "fr-icon-database-line" },
    { key: "mongodb", iconId: "fr-icon-database-line" },
    { key: "redis", iconId: "fr-icon-flashlight-line" },
  ] satisfies ReadonlyArray<HomeCard>,

  /** 07 — The two ways to run Notploy: on your infrastructure, or hosted. */
  hosting: [
    { key: "selfHosted", iconId: "fr-icon-server-line", href: productPaths.selfHosted },
    { key: "cloud", iconId: "fr-icon-cloud-line", href: productPaths.cloud },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 09 — The community around the project. */
  community: [
    { key: "github", iconId: "fr-icon-github-fill", href: externalLinks.github, external: true },
    { key: "issues", iconId: "fr-icon-bug-line", href: externalLinks.issues, external: true },
    { key: "discord", iconId: "fr-icon-chat-3-line", href: externalLinks.discord, external: true },
  ] satisfies ReadonlyArray<HomeTile>,
} as const;
