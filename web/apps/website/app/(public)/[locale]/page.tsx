import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  SDSContainer,
  SDSGrid,
  SDSHeading,
  SDSHero,
  SDSLead,
  SDSSection,
  SDSTeaserCard,
  SDSText,
} from "@skygenesisenterprise/react-sds/sds";
import type { FrIconClassName } from "@skygenesisenterprise/react-sds/fr";
import { localizedAlternates, resolveLocaleParam } from "@/lib/localized-metadata";
import { notployHome } from "@/lib/home-content";
import { ecosystemSurfaces, externalLinks, productPaths, SITE } from "@/lib/site-structure";
import { CtaButtonsGroup, LinkTile } from "@/components/public/content/sds-fragments";
import { FlowDiagram, StatGrid } from "@/components/public/content/theme-page";

const HOME_PATH = "/";

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

/**
 * Section header of the homepage — the SDS section pattern with a kicker.
 *
 * `SDSSection` has no kicker slot (its header is title + subtitle + action), so
 * the kicker is composed here from the SDS `gov-kicker` utility and the heading
 * comes from `SDSHeading`, keeping the type scale owned by SDS.
 */
function SectionHeader({
  kicker,
  title,
  lead,
  action,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="gov-section__header">
      <div>
        {kicker ? <p className="gov-kicker">{kicker}</p> : null}
        <SDSHeading level={2}>{title}</SDSHeading>
        {lead ? <SDSLead>{lead}</SDSLead> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Homepage of the official Notploy website.
 *
 * The page answers, section after section, what Notploy is and what you can do
 * with it:
 *
 *   01 Hero            — what the platform is, in one screen
 *   02 Le platforme    — the reference figures of the product
 *   03 Ce que vous faites — applications, Compose, databases, routing, monitoring, servers
 *   04 Le flux         — connect, build, deploy, route, operate
 *   05 L'écosystème    — dashboard, desktop, mobile, CLI, SDK, API, Actions, VS Code, MCP
 *   06 Bases de données— the engines the platform provisions and backs up
 *   07 Hébergement     — self-hosted or Notploy Cloud
 *   08 Communauté      — GitHub, issues, discussions, Discord, templates
 *   09 CTA             — install Notploy / read the docs
 *
 * Every section is driven by `notployHome` (`lib/home-content.ts`) and the
 * message catalogs, and composed exclusively from SDS primitives — the page
 * owns no visual system of its own.
 */
export default async function HomePage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocaleParam(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <>
      {/* 01 — Hero: the product statement and its two real entry points. */}
      <SDSHero
        tone="subtle"
        kicker={t("hero.kicker")}
        title={t("hero.title")}
        subtitle={t("hero.lead")}
        actions={
          <CtaButtonsGroup
            buttons={[
              {
                children: t("hero.ctaPrimary"),
                href: productPaths.selfHosted,
                iconId: "fr-icon-arrow-right-line",
              },
              {
                children: t("hero.ctaSecondary"),
                href: productPaths.platform,
                priority: "secondary",
                iconId: "fr-icon-arrow-right-line",
              },
              {
                children: t("hero.ctaGithub"),
                href: externalLinks.github,
                priority: "tertiary",
                iconId: "fr-icon-github-fill",
              },
            ]}
          />
        }
      />

      {/* 02 — The reference figures of the platform. */}
      <SDSSection>
        <SDSContainer>
          <SectionHeader
            kicker={t("stats.kicker")}
            title={t("stats.title")}
            lead={t("stats.lead")}
          />
          <StatGrid
            items={notployHome.stats.map((stat) => ({
              key: stat.key,
              value: stat.value,
              label: t(`stats.${stat.key}`),
            }))}
          />
        </SDSContainer>
      </SDSSection>

      {/* 03 — What the platform does, capability by capability. */}
      <SDSSection tone="subtle">
        <SDSContainer>
          <SectionHeader
            kicker={t("capabilities.kicker")}
            title={t("capabilities.title")}
            lead={t("capabilities.lead")}
            action={
              <CtaButtonsGroup
                buttons={[
                  {
                    children: t("capabilities.cta"),
                    href: productPaths.platform,
                    priority: "secondary",
                    iconId: "fr-icon-arrow-right-line",
                  },
                ]}
              />
            }
          />
          <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={5}>
            {notployHome.capabilities.map((item) => (
              <LinkTile
                key={item.key}
                title={t(`capabilities.items.${item.key}.title`)}
                desc={t(`capabilities.items.${item.key}.desc`)}
                href={item.href}
                iconId={item.iconId}
              />
            ))}
          </SDSGrid>
        </SDSContainer>
      </SDSSection>

      {/* 04 — The deployment workflow, as a single readable chain. */}
      <SDSSection>
        <SDSContainer>
          <SectionHeader
            kicker={t("workflow.kicker")}
            title={t("workflow.title")}
            lead={t("workflow.lead")}
          />
          <div style={{ marginTop: "1.5rem" }}>
            <FlowDiagram
              items={notployHome.workflow.map((step) => ({
                key: step.key,
                label: t(`workflow.steps.${step.key}`),
              }))}
            />
          </div>
        </SDSContainer>
      </SDSSection>

      {/* 05 — The surfaces of the ecosystem, each one shipped by the monorepo. */}
      <SDSSection tone="subtle">
        <SDSContainer>
          <SectionHeader
            kicker={t("ecosystem.kicker")}
            title={t("ecosystem.title")}
            lead={t("ecosystem.lead")}
            action={
              <CtaButtonsGroup
                buttons={[
                  {
                    children: t("ecosystem.cta"),
                    href: productPaths.developers,
                    priority: "secondary",
                    iconId: "fr-icon-arrow-right-line",
                  },
                ]}
              />
            }
          />
          <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={5}>
            {ecosystemSurfaces.map((surface) => (
              <LinkTile
                key={surface.key}
                title={t(`ecosystem.items.${surface.key}.title`)}
                desc={t(`ecosystem.items.${surface.key}.desc`)}
                href={surface.href}
                iconId={surface.iconId as FrIconClassName}
              />
            ))}
          </SDSGrid>
        </SDSContainer>
      </SDSSection>

      {/* 06 — The database engines the platform provisions and backs up. */}
      <SDSSection>
        <SDSContainer>
          <SectionHeader
            kicker={t("databases.kicker")}
            title={t("databases.title")}
            lead={t("databases.lead")}
          />
          <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={5}>
            {notployHome.databases.map((database) => (
              <SDSTeaserCard
                key={database.key}
                tag={<span className={database.iconId} aria-hidden="true" />}
                title={t(`databases.items.${database.key}.title`)}
                description={t(`databases.items.${database.key}.desc`)}
              />
            ))}
          </SDSGrid>
        </SDSContainer>
      </SDSSection>

      {/* 07 — The two ways to run Notploy. */}
      <SDSSection tone="subtle">
        <SDSContainer>
          <SectionHeader
            kicker={t("hosting.kicker")}
            title={t("hosting.title")}
            lead={t("hosting.lead")}
          />
          <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 2 }} gap={5}>
            {notployHome.hosting.map((option) => (
              <LinkTile
                key={option.key}
                title={t(`hosting.items.${option.key}.title`)}
                desc={t(`hosting.items.${option.key}.desc`)}
                href={option.href}
                iconId={option.iconId}
                horizontal
              />
            ))}
          </SDSGrid>
          <SDSText as="p" size="sm" color="muted" margin="top">
            {t("hosting.note")}
          </SDSText>
        </SDSContainer>
      </SDSSection>

      {/* 08 — Closing call to action. The community band is rendered by the
          footer: it belongs to the secondary zone of every page, not to the
          product narrative of the homepage. */}
      <SDSSection title={t("cta.title")} subtitle={t("cta.lead")}>
        <SDSContainer size="narrow">
          <CtaButtonsGroup
            buttons={[
              {
                children: t("cta.primary"),
                href: productPaths.selfHosted,
                iconId: "fr-icon-arrow-right-line",
              },
              {
                children: t("cta.secondary"),
                href: externalLinks.docs,
                priority: "secondary",
                iconId: "fr-icon-book-2-line",
              },
            ]}
          />
          <SDSText as="p" size="sm" color="muted" margin="top">
            {t("cta.license", { license: SITE.license })}
          </SDSText>
        </SDSContainer>
      </SDSSection>
    </>
  );
}
