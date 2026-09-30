"use client";

import { useTranslations } from "next-intl";
import { bloctelHome } from "@/lib/home-content";
import { CtaButtonsGroup } from "@/components/public/content/ads-fragments";

/**
 * “Gérer mes préférences” home section — the citizen space of Bloctel,
 * presented as a demonstration interface.
 *
 * No connected account exists yet on the public portal: the section explains
 * the concept with an illustrative list of communication preferences
 * (channel — status) and a single action towards the preferences page. The
 * preference list is driven by `bloctelHome.preferences` and the message
 * catalogs, so it stays translatable and evolvable without touching the
 * markup. No fictitious personal data is invented: the example is explicitly
 * labelled as a demonstration.
 *
 * The layout follows the “Mon espace” section pattern of the other Astoria
 * portals (ADS design tokens, no local stylesheet).
 */
export function MonEspace() {
  const t = useTranslations("home");
  const preferences = bloctelHome.preferences;

  return (
    <div
      style={{
        padding: "1.75rem",
        background: "var(--ads-color-background)",
        border: "1px solid var(--ads-color-border)",
        borderLeft: "4px solid var(--ads-color-primary)",
      }}
    >
      <div style={{ maxWidth: "48rem" }}>
        <p className="gov-kicker">{t("preferences.kicker")}</p>
        <h2 id="espace-title" style={{ margin: "0 0 0.5rem" }}>
          {t("preferences.title")}
        </h2>
        <p style={{ margin: "0", lineHeight: 1.6 }}>{t("preferences.lead")}</p>
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          margin: "1.25rem 0 0",
          padding: "0",
          display: "grid",
          gap: "0.5rem",
          maxWidth: "42rem",
        }}
      >
        {preferences.items.map((preference) => (
          <li
            key={preference.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.625rem 0.875rem",
              background: "var(--ads-color-surface-muted)",
              border: "1px solid var(--ads-color-border)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem", fontWeight: 600 }}>
              <span
                className={preference.iconId}
                aria-hidden="true"
                style={{ fontSize: "1.125rem", color: "var(--ads-color-primary)" }}
              />
              {t(`preferences.items.${preference.key}.channel`)}
            </span>
            <span
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: "999px",
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--ads-color-background)",
                background: "var(--ads-color-primary)",
              }}
            >
              {t(`preferences.items.${preference.key}.status`)}
            </span>
          </li>
        ))}
      </ul>

      <p
        style={{
          margin: "0.875rem 0 0",
          fontSize: "0.875rem",
          color: "var(--ads-color-text-muted)",
        }}
      >
        {t("preferences.demoNote")}
      </p>

      <div style={{ marginTop: "1.5rem" }}>
        <CtaButtonsGroup
          buttons={[
            {
              children: t("preferences.cta"),
              href: preferences.href,
              iconId: "fr-icon-arrow-right-line",
            },
          ]}
        />
      </div>
    </div>
  );
}