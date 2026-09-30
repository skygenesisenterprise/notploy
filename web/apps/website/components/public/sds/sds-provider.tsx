"use client";

import {
  DsfrProviderBase,
  StartDsfrOnHydration,
  type DsfrProviderProps,
} from "@skygenesisenterprise/react-sds/next-app-router";
import { Link } from "@/i18n/navigation";
import { registerSdsTranslations } from "./sds-translations";

declare global {
  interface Window {
    /** Configuration read by the SDS core module when it first evaluates. */
    dsfr?: { mode?: string; verbose?: boolean };
  }
}

// The SDS core module reads `window.dsfr` when it first evaluates and falls
// back to AUTO mode when it's missing. In AUTO mode it initializes the DOM
// itself (adding `data-fr-js-*` attributes, collapse states, …) as soon as
// the document is ready — racing React hydration and producing hydration
// mismatches (e.g. the header language selector). Seeding the global with
// `mode: "react"` before the core module can evaluate keeps the core
// hands-off: React owns the DOM, and `StartDsfrOnHydration` starts the
// remaining runtime behaviours after hydration.
if (typeof window !== "undefined") {
  window.dsfr = window.dsfr ?? {};
  window.dsfr.mode = "react";
}

/**
 * Wires the Sky Genesis Enterprise Design System (SDS) runtime to the website:
 *  - registers the next-intl Link as the link renderer used by every SDS
 *    component (so all SDS internal links stay localized),
 *  - announces the active locale to SDS (internal aria strings, etc.),
 *  - starts the SDS core behaviours on hydration (modals, collapses, menus…),
 *  - applies the system color scheme (light/dark) to SDS components.
 *
 * This component must wrap every SDS component rendered on the page.
 */
registerSdsTranslations();

export function SdsProvider({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: DsfrProviderProps["lang"];
}) {
  return (
    // The public website forces the light scheme: institutional sites stay
    // readable in every environment and the “Paramètres d'affichage” dialog
    // remains available for visitors who still want to switch theme during a
    // session.
    <DsfrProviderBase lang={lang} Link={Link} defaultColorScheme="light">
      {children}
      <StartDsfrOnHydration />
    </DsfrProviderBase>
  );
}
