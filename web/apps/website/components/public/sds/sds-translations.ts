import { addHeaderTranslations } from "@skygenesisenterprise/react-sds/Header";
import { addFooterTranslations } from "@skygenesisenterprise/react-sds/Footer";
import { addMainNavigationTranslations } from "@skygenesisenterprise/react-sds/MainNavigation";
import { addLanguageSelectTranslations } from "@skygenesisenterprise/react-sds/LanguageSelect";
import { addSearchBarTranslations } from "@skygenesisenterprise/react-sds/SearchBar";

/**
 * SDS — internal component strings.
 *
 * SDS components ship their accessibility/aria strings in French by default.
 * Every non-French locale the website supports must be registered here so the
 * components can pick the right strings at runtime. This module is imported
 * both by the server layout and by the client SDS provider so the registry is
 * populated in both bundles.
 *
 * Keep the strings of the French locale out of this file: they are the
 * built-in defaults of @skygenesisenterprise/react-sds.
 */
export function registerSdsTranslations(): void {
  // Header (mobile menu / search modal buttons)
  addHeaderTranslations({
    lang: "en",
    messages: {
      menu: "Menu",
      close: "Close",
    },
  });

  // Main navigation (aria label of the nav landmark)
  addMainNavigationTranslations({
    lang: "en",
    messages: {
      "main menu": "Main menu",
    },
  });

  // Footer (accessibility line, legal links and helpers)
  addFooterTranslations({
    lang: "en",
    messages: {
      "hide message": "Hide this message",
      "website map": "Sitemap",
      accessibility: "Accessibility",
      "non compliant": "non compliant",
      "partially compliant": "partially compliant",
      "fully compliant": "fully compliant",
      terms: "Terms and conditions",
      "cookies management": "Cookie management",
      "our partners": "Our partners",
      "open new window": "Opens in a new window",
    },
  });

  // Language select (button accessible title)
  addLanguageSelectTranslations({
    lang: "en",
    messages: {
      "select language": "Select language",
    },
  });

  // Search bar (label / placeholder)
  addSearchBarTranslations({
    lang: "en",
    messages: {
      label: "Search",
    },
  });
}
