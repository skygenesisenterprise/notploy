import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { rneaHome } from "@/lib/home-content";
import { sectionPaths } from "@/lib/site-structure";
import { Link } from "@/i18n/navigation";
import { PortalSearchBar } from "@/components/public/search/portal-search-bar";
import {
  ArticleCard,
  CtaButtonsGroup,
  LinkTile,
  NoticeCallout,
  SearchSuggestionTag,
} from "@/components/public/content/ads-fragments";
import { FlowDiagram } from "@/components/public/content/theme-page";

const HOME_PATH = "/";
const ENTREPRISES_PATH = sectionPaths.entreprises;
const FORMALITES_PATH = sectionPaths.formalites;
const DOCUMENTS_PATH = sectionPaths.documents;
const DONNEES_PATH = sectionPaths.donnees;
const RNEA_PATH = sectionPaths.rnea;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);

  const tHome = await getTranslations({ locale, namespace: "home" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });

  return {
    title: { absolute: tHome("metaTitle") },
    description: tMeta("description"),
    ...localizedAlternates(locale, HOME_PATH),
  };
}

/* Layout helpers below use the ADS design tokens through `var(--ads-*)` (the
 * single source of tokens — main.css) so light/dark switching and theming stay
 * owned by the Design System. Only the RNEA-specific arrangement of these
 * blocks is expressed here, inline, without any local stylesheet. */

const heroContainerStyle: CSSProperties = {
  maxWidth: "52rem",
  marginInline: "auto",
  textAlign: "center",
};

const heroActionsStyle: CSSProperties = {
  marginTop: "1.5rem",
};

const searchBlockStyle: CSSProperties = {
  maxWidth: "42rem",
  margin: "2.25rem auto 0",
  textAlign: "left",
};

const searchTitleStyle: CSSProperties = {
  margin: "0 0 0.75rem",
  fontSize: "1.25rem",
  lineHeight: 1.3,
  fontWeight: 700,
};

const popularLabelStyle: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "0.875rem",
  color: "var(--ads-color-text-muted)",
};

const popularListStyle: CSSProperties = {
  listStyle: "none",
  margin: "0",
  padding: "0",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const cardListStyle: CSSProperties = {
  listStyle: "none",
  margin: "0",
  padding: "0",
  display: "grid",
  gap: "1.5rem",
};

/** Whole-card explanatory block of the “Comprendre le RNEA” section. */
const infoCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  height: "100%",
  padding: "1.25rem",
  background: "var(--ads-color-background)",
  border: "1px solid var(--ads-color-border)",
  borderTop: "3px solid var(--ads-color-primary)",
  color: "var(--ads-color-text)",
};

const infoIconStyle: CSSProperties = {
  fontSize: "1.375rem",
  lineHeight: 1,
  color: "var(--ads-color-primary)",
};

const infoTitleStyle: CSSProperties = {
  display: "block",
  fontSize: "1.0625rem",
  lineHeight: 1.35,
  fontWeight: 700,
};

const infoDescStyle: CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  lineHeight: 1.55,
  color: "var(--ads-color-text-muted)",
};

const inlineLinkStyle: CSSProperties = {
  fontWeight: 600,
  textUnderlineOffset: "0.2em",
};

const institutionLeadStyle: CSSProperties = {
  margin: "0 auto 1.5rem",
  maxWidth: "42rem",
  fontSize: "0.9375rem",
  lineHeight: 1.7,
  color: "var(--ads-color-text-muted)",
};

const institutionLinksStyle: CSSProperties = {
  ...popularListStyle,
  justifyContent: "center",
  marginTop: "1.5rem",
  gap: "0.625rem 1.75rem",
};

/**
 * Homepage of the Registre National des Entreprises d'Astoria — the official
 * front door of the national business registry.
 *
 * The header allows navigating the register (seven themes, unchanged); this
 * page allows understanding and acting. It answers “what can I do on the
 * register?”, section after section:
 *
 *   01 Hero / Recherche        — who we are, and search first
 *   02 Rechercher dans le RNEA — what the register search exposes
 *   03 Comprendre le RNEA      — educational presentation of the register
 *   04 Créer une entreprise    — the creation journey
 *   05 Gérer son entreprise    — the lifecycle of a registered company
 *   06 Documents officiels     — extracts, certificates, filed documents, verification
 *   07 Propriété intellectuelle— marks, patents, designs and models
 *   08 Données publiques et API— open data, statistics, API, downloads
 *   09 Informations du RNEA    — operational information of the service
 *   10 Le RNEA                 — institutional closing (about, fees, help, contact)
 *
 * Every section is driven by the `rneaHome` configuration
 * (lib/home-content.ts) and the message catalogs, so the content can evolve
 * without rewriting the interface. The seven themes deliberately do not
 * appear here as a second navigation: they belong to the header. Newsletter
 * and social accounts are relegated to the footer (stay-in-touch zone of
 * GovernmentFooter).
 */
export default async function HomePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <>
      {/* 01 — Hero / Recherche: institutional statement and the main search,
          visually the most important element of the page. */}
      <section className="gov-section" aria-labelledby="home-hero-title">
        <div className="gov-section__container" style={heroContainerStyle}>
          <p className="gov-kicker">{t("hero.kicker")}</p>
          <h1 id="home-hero-title">{t("hero.title")}</h1>
          <p className="gov-lead">{t("hero.lead")}</p>
          <div style={searchBlockStyle}>
            <h2 id="home-search-title" style={searchTitleStyle}>
              {t("search.title")}
            </h2>
            <PortalSearchBar label={t("search.label")} placeholder={t("search.placeholder")} />
            <div style={{ marginTop: "1.25rem" }}>
              <p style={popularLabelStyle} id="popular-searches-label">
                {t("search.popularLabel")}
              </p>
              <ul style={popularListStyle} aria-labelledby="popular-searches-label">
                {rneaHome.popularSearches.map((search) => (
                  <li key={search.key}>
                    <SearchSuggestionTag
                      label={t(`search.popular.${search.key}`)}
                      href={search.href}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div style={heroActionsStyle}>
            <CtaButtonsGroup
              alignment="center"
              buttons={[
                {
                  children: t("hero.ctaSearch"),
                  href: `${ENTREPRISES_PATH}/rechercher`,
                  iconId: "fr-icon-search-line",
                },
                {
                  children: t("hero.ctaFormality"),
                  href: FORMALITES_PATH,
                  priority: "secondary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 02 — Rechercher dans le RNEA: what the register search exposes. The
          experience is that of a national register: simple, direct and
          comprehensible. */}
      <section className="gov-section gov-section--subtle" aria-labelledby="consult-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("consult.kicker")}</p>
              <h2 id="consult-title" className="gov-section__title">
                {t("consult.title")}
              </h2>
              <p className="gov-lead">{t("consult.lead")}</p>
            </div>
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            {rneaHome.consult.map((item) => (
              <div key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-3">
                <LinkTile
                  title={t(`consult.items.${item.key}.title`)}
                  desc={t(`consult.items.${item.key}.desc`)}
                  href={item.href}
                  iconId={item.iconId}
                />
              </div>
            ))}
          </div>
          <p className="fr-text--sm" style={{ color: "var(--ads-color-text-muted)" }}>
            {t("consult.note")}
          </p>
        </div>
      </section>

      {/* 03 — Comprendre le RNEA: educational, structured and concise. */}
      <section className="gov-section" aria-labelledby="understand-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("understand.kicker")}</p>
              <h2 id="understand-title" className="gov-section__title">
                {t("understand.title")}
              </h2>
              <p className="gov-lead">{t("understand.lead")}</p>
            </div>
          </div>
          <ul className="fr-grid-row fr-grid-row--gutters" role="list">
            {rneaHome.understand.map((item) => (
              <li key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-3">
                <div style={infoCardStyle}>
                  <span className={item.iconId} aria-hidden="true" style={infoIconStyle} />
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <span style={infoTitleStyle}>{t(`understand.items.${item.key}.title`)}</span>
                    <span style={infoDescStyle}>{t(`understand.items.${item.key}.desc`)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 04 — Créer une entreprise: the creation journey, from the formalities
          to the exercise of the activity. */}
      <section className="gov-section gov-section--subtle" aria-labelledby="create-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("create.kicker")}</p>
              <h2 id="create-title" className="gov-section__title">
                {t("create.title")}
              </h2>
              <p className="gov-lead">{t("create.lead")}</p>
            </div>
          </div>
          <FlowDiagram
            items={rneaHome.create.steps.map((step) => ({
              key: step.key,
              label: t(`create.steps.${step.key}`),
            }))}
          />
          <div style={{ marginTop: "1.5rem" }}>
            <CtaButtonsGroup
              buttons={[
                {
                  children: t("create.cta"),
                  href: `${ENTREPRISES_PATH}/creer`,
                  iconId: "fr-icon-arrow-right-line",
                },
                {
                  children: t("create.secondaryCta"),
                  href: `${FORMALITES_PATH}/creation`,
                  priority: "secondary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 05 — Gérer son entreprise: the RNEA covers the whole lifecycle of a
          company, not only its creation. */}
      <section className="gov-section" aria-labelledby="manage-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("manage.kicker")}</p>
              <h2 id="manage-title" className="gov-section__title">
                {t("manage.title")}
              </h2>
              <p className="gov-lead">{t("manage.lead")}</p>
            </div>
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            {rneaHome.manage.map((item) => (
              <div key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-4">
                <LinkTile
                  title={t(`manage.items.${item.key}.title`)}
                  desc={t(`manage.items.${item.key}.desc`)}
                  href={item.href}
                  iconId={item.iconId}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 06 — Documents officiels: extracts, certificates, filed documents and
          the verification of a document. */}
      <section className="gov-section gov-section--subtle" aria-labelledby="documents-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("documents.kicker")}</p>
              <h2 id="documents-title" className="gov-section__title">
                {t("documents.title")}
              </h2>
              <p className="gov-lead">{t("documents.lead")}</p>
            </div>
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            {rneaHome.documents.map((item) => (
              <div key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-3">
                <LinkTile
                  title={t(`documents.items.${item.key}.title`)}
                  desc={t(`documents.items.${item.key}.desc`)}
                  href={item.href}
                  iconId={item.iconId}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            <NoticeCallout iconId="fr-icon-shield-line" title={t("documents.verifyTitle")}>
              {t("documents.verifyText")}
            </NoticeCallout>
          </div>
          <p style={{ marginTop: "1rem" }}>
            <Link
              href={`${DOCUMENTS_PATH}/verifier/authenticite-des-documents`}
              style={inlineLinkStyle}
            >
              {t("documents.verifyLink")}
              <span className="fr-icon-arrow-right-line" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* 07 — Propriété intellectuelle: distinct from the legal company
          register, but integrated in the RNEA ecosystem. */}
      <section className="gov-section" aria-labelledby="pi-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("pi.kicker")}</p>
              <h2 id="pi-title" className="gov-section__title">
                {t("pi.title")}
              </h2>
              <p className="gov-lead">{t("pi.lead")}</p>
            </div>
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            {rneaHome.pi.map((item) => (
              <div key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-3">
                <LinkTile
                  title={t(`pi.items.${item.key}.title`)}
                  desc={t(`pi.items.${item.key}.desc`)}
                  href={item.href}
                  iconId={item.iconId}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 08 — Données publiques et API: the RNEA as a public digital
          infrastructure (administrations, developers, businesses, researchers,
          citizens). */}
      <section className="gov-section gov-section--subtle" aria-labelledby="data-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("data.kicker")}</p>
              <h2 id="data-title" className="gov-section__title">
                {t("data.title")}
              </h2>
              <p className="gov-lead">{t("data.lead")}</p>
            </div>
            <CtaButtonsGroup
              buttons={[
                {
                  children: t("data.exploreCta"),
                  href: DONNEES_PATH,
                  priority: "secondary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]}
            />
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            {rneaHome.data.map((item) => (
              <div key={item.key} className="fr-col-12 fr-col-md-6 fr-col-lg-3">
                <LinkTile
                  title={t(`data.items.${item.key}.title`)}
                  desc={t(`data.items.${item.key}.desc`)}
                  href={item.href}
                  iconId={item.iconId}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            <CtaButtonsGroup
              buttons={[
                {
                  children: t("data.apiCta"),
                  href: `${DONNEES_PATH}/api/documentation`,
                  priority: "tertiary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 09 — Informations du RNEA: operational information of the service
          (changes, features, formalities, maintenance, publications). One
          featured item, several secondary ones. */}
      <section className="gov-section" aria-labelledby="news-title">
        <div className="gov-section__container">
          <div className="gov-section__header">
            <div>
              <p className="gov-kicker">{t("news.kicker")}</p>
              <h2 id="news-title" className="gov-section__title">
                {t("news.title")}
              </h2>
              <p className="gov-lead">{t("news.lead")}</p>
            </div>
            <CtaButtonsGroup
              buttons={[
                {
                  children: t("news.allLink"),
                  href: RNEA_PATH,
                  priority: "secondary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]}
            />
          </div>
          <div className="fr-grid-row fr-grid-row--gutters">
            <div className="fr-col-12 fr-col-lg-7">
              <ArticleCard
                title={t(`news.${rneaHome.news.featured.titleKey}`)}
                desc={
                  rneaHome.news.featured.textKey
                    ? t(`news.${rneaHome.news.featured.textKey}`)
                    : undefined
                }
                tag={t(`news.${rneaHome.news.featured.tagKey}`)}
                date={t(`news.${rneaHome.news.featured.dateKey}`)}
                href={rneaHome.news.featured.href}
                size="large"
              />
            </div>
            <div className="fr-col-12 fr-col-lg-5">
              <ul style={cardListStyle}>
                {rneaHome.news.secondary.map((article) => (
                  <li key={article.key}>
                    <ArticleCard
                      title={t(`news.${article.titleKey}`)}
                      tag={t(`news.${article.tagKey}`)}
                      date={t(`news.${article.dateKey}`)}
                      href={article.href}
                      size="small"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 10 — Le RNEA: discreet institutional closing (about, fees, help,
          contact). The user first acts, then understands, then discovers the
          institution. */}
      <section className="gov-section" aria-labelledby="institution-title">
        <div className="gov-section__container" style={heroContainerStyle}>
          <p className="gov-kicker">{t("institution.kicker")}</p>
          <h2 id="institution-title" className="gov-section__title">
            {t("institution.title")}
          </h2>
          <p style={institutionLeadStyle}>{t("institution.lead")}</p>
          <ul role="list" style={institutionLinksStyle}>
            {rneaHome.institution.map((link) => (
              <li key={link.key}>
                <Link href={link.href} style={inlineLinkStyle}>
                  {t(`institution.links.${link.key}.title`)}
                  <span className="fr-icon-arrow-right-line" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}