/**
 * Homepage content of the Registre National des Entreprises d'Astoria.
 *
 * The page sections are driven by this configuration and the message catalogs
 * (`home.*` keys in `apps/messages/{fr,en}.json`), so the content can evolve
 * without rewriting the interface. Hrefs are derived from the header
 * navigation (`lib/site-structure.ts`) so the homepage and the navigation can
 * never drift apart.
 */

import type { FrIconClassName } from "@codegouvaor/react-ads/fr";
import { sectionPaths } from "./site-structure";

/** A popular search suggestion shown under the hero search bar. */
export type HomePopularSearch = {
  key: string;
  href: string;
};

/** A destination tile of the homepage (search, documents, data…). */
export type HomeTile = {
  key: string;
  iconId: FrIconClassName;
  href: string;
};

/** A non-navigational explanatory card (label resolved from `home.*`). */
export type HomeCard = {
  key: string;
  iconId: FrIconClassName;
};

/** One step of the creation journey (label resolved from `home.*`). */
export type HomeFlowStep = {
  key: string;
};

export type HomeNewsItem = {
  tagKey: string;
  titleKey: string;
  textKey?: string;
  dateKey: string;
  href: string;
};

/**
 * Homepage of the RNEA — the content of the ten sections:
 *
 *   01 Hero / Recherche      — who we are, and search first
 *   02 Rechercher dans le RNEA — what the register search exposes
 *   03 Comprendre le RNEA    — educational presentation of the register
 *   04 Créer une entreprise  — the creation journey
 *   05 Gérer son entreprise  — the lifecycle of a registered company
 *   06 Documents officiels   — extracts, certificates, filed documents, verification
 *   07 Propriété intellectuelle — marks, patents, designs and models
 *   08 Données publiques et API — open data, statistics, API, downloads
 *   09 Informations du RNEA  — operational information, separated from general news
 *   10 Le RNEA               — institutional closing (about, fees, help, contact)
 *
 * Hrefs follow the URL plan of the portal (`site-structure.ts`); the labels
 * are never stored here — they come from the message catalogs.
 */
export const rneaHome = {
  popularSearches: [
    { key: "company", href: `${sectionPaths.entreprises}/rechercher/simple` },
    { key: "rneaNumber", href: `${sectionPaths.entreprises}/rechercher/par-siren` },
    { key: "establishment", href: `${sectionPaths.registre}/etablissements/rechercher` },
    { key: "director", href: `${sectionPaths.registre}/dirigeants/rechercher` },
  ] satisfies ReadonlyArray<HomePopularSearch>,

  /** 02 — Rechercher dans le RNEA: what the register search exposes. */
  consult: [
    { key: "company", iconId: "fr-icon-search-line", href: `${sectionPaths.entreprises}/rechercher/simple` },
    { key: "rneaNumber", iconId: "fr-icon-barcode-line", href: `${sectionPaths.entreprises}/rechercher/par-siren` },
    { key: "establishment", iconId: "fr-icon-building-line", href: `${sectionPaths.registre}/etablissements/rechercher` },
    { key: "director", iconId: "fr-icon-user-line", href: `${sectionPaths.registre}/dirigeants/rechercher` },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 03 — Comprendre le RNEA: four explanatory cards. */
  understand: [
    { key: "what", iconId: "fr-icon-flag-line" },
    { key: "role", iconId: "fr-icon-line-chart-line" },
    { key: "centralizes", iconId: "fr-icon-database-line" },
    { key: "public", iconId: "fr-icon-eye-line" },
  ] satisfies ReadonlyArray<HomeCard>,

  /** 04 — Créer une entreprise: the creation journey (Créer → Enregistrer → Identifiant → Exercer). */
  create: {
    steps: [
      { key: "formalites" },
      { key: "enregistrement" },
      { key: "identifiant" },
      { key: "activite" },
    ] satisfies ReadonlyArray<HomeFlowStep>,
  },

  /** 05 — Gérer son entreprise: the lifecycle of a registered company. */
  manage: [
    { key: "modify", iconId: "fr-icon-pencil-line", href: `${sectionPaths.entreprises}/modifier/mise-a-jour-des-informations` },
    { key: "seat", iconId: "fr-icon-home-4-line", href: `${sectionPaths.entreprises}/modifier/changement-d-adresse` },
    { key: "establishment", iconId: "fr-icon-building-line", href: `${sectionPaths.registre}/etablissements/ouverture-et-fermeture` },
    { key: "directors", iconId: "fr-icon-user-line", href: `${sectionPaths.entreprises}/modifier/changement-de-dirigeant` },
    { key: "cease", iconId: "fr-icon-archive-line", href: `${sectionPaths.entreprises}/cesser/declaration-de-cessation` },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 06 — Documents officiels: extracts, certificates, filed documents and verification. */
  documents: [
    { key: "extraits", iconId: "fr-icon-file-line", href: `${sectionPaths.documents}/extraits` },
    { key: "certificats", iconId: "fr-icon-award-line", href: `${sectionPaths.documents}/certificats` },
    { key: "deposes", iconId: "fr-icon-folder-2-line", href: `${sectionPaths.documents}/documents-deposes` },
    { key: "verifier", iconId: "fr-icon-shield-line", href: `${sectionPaths.documents}/verifier` },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 07 — Propriété intellectuelle: marks, patents, designs and general information. */
  pi: [
    { key: "marques", iconId: "fr-icon-award-line", href: `${sectionPaths.proprieteIntellectuelle}/marques` },
    { key: "brevets", iconId: "fr-icon-lightbulb-line", href: `${sectionPaths.proprieteIntellectuelle}/brevets` },
    { key: "dessins", iconId: "fr-icon-draft-line", href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles` },
    { key: "informations", iconId: "fr-icon-information-line", href: `${sectionPaths.proprieteIntellectuelle}/informations` },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 08 — Données publiques et API: the digital public infrastructure. */
  data: [
    { key: "open", iconId: "fr-icon-database-line", href: `${sectionPaths.donnees}/donnees-ouvertes` },
    { key: "stats", iconId: "fr-icon-line-chart-line", href: `${sectionPaths.donnees}/statistiques` },
    { key: "api", iconId: "fr-icon-code-line", href: `${sectionPaths.donnees}/api` },
    { key: "downloads", iconId: "fr-icon-download-line", href: `${sectionPaths.donnees}/telechargements` },
  ] satisfies ReadonlyArray<HomeTile>,

  /** 09 — Informations du RNEA: one featured item, several secondary ones. */
  news: {
    featured: {
      tagKey: "featured.tag",
      titleKey: "featured.title",
      textKey: "featured.text",
      dateKey: "featured.date",
      href: `${sectionPaths.rnea}/a-propos/missions`,
    } satisfies HomeNewsItem,
    secondary: [
      {
        key: "extraits",
        tagKey: "secondary.extraits.tag",
        titleKey: "secondary.extraits.title",
        dateKey: "secondary.extraits.date",
        href: `${sectionPaths.documents}/extraits/commander-un-extrait`,
      },
      {
        key: "maintenance",
        tagKey: "secondary.maintenance.tag",
        titleKey: "secondary.maintenance.title",
        dateKey: "secondary.maintenance.date",
        href: `${sectionPaths.rnea}/aide`,
      },
      {
        key: "donnees",
        tagKey: "secondary.donnees.tag",
        titleKey: "secondary.donnees.title",
        dateKey: "secondary.donnees.date",
        href: `${sectionPaths.donnees}/donnees-ouvertes/jeux-de-donnees`,
      },
    ] satisfies ReadonlyArray<HomeNewsItem>,
  },

  /** 10 — Le RNEA: institutional closing links. */
  institution: [
    { key: "aPropos", href: `${sectionPaths.rnea}/a-propos` },
    { key: "tarifs", href: `${sectionPaths.rnea}/tarifs` },
    { key: "aide", href: `${sectionPaths.rnea}/aide` },
    { key: "contact", href: `${sectionPaths.rnea}/contact` },
  ] satisfies ReadonlyArray<{ key: string; href: string }>,
};

/**
 * Legacy demonstration preferences of the “Mon espace” section (`MonEspace`).
 * Kept as a separate, clearly-labelled demo block so the existing component
 * stays usable without mixing demo content into the RNEA homepage.
 */
export const bloctelHome = {
  preferences: {
    href: "/preferences",
    items: [
      { key: "appels", iconId: "fr-icon-phone-line" },
      { key: "sms", iconId: "fr-icon-message-2-line" },
      { key: "courriers", iconId: "fr-icon-mail-line" },
    ],
  },
};