import type { CSSProperties, ReactNode } from "react";
import {
  SDSContainer,
  SDSGrid,
  SDSHeading,
  SDSHero,
  SDSLead,
  SDSLink,
  SDSLinkList,
  SDSSection,
  SDSTeaserCard,
} from "@skygenesisenterprise/react-sds/sds";
import type { FrIconClassName } from "@skygenesisenterprise/react-sds/fr";
import { Link } from "@/i18n/navigation";
import { CtaButtonsGroup, LinkTile, NoticeCallout, type CtaButton } from "./sds-fragments";

/**
 * Shared presentational layer of the editorial theme pages (contact, sitemap,
 * legal…). Server component: it only passes serializable props (strings, hrefs)
 * to the SDS client boundaries.
 *
 * Every page of a theme is composed with `ThemeArticle`, which renders a
 * *localized* content object produced by the localization layer
 * (`lib/theme-localize.ts`). The message catalogs (`messages/{fr,en}.json`) hold
 * every display string; the shared blocks below only decide how to arrange those
 * strings, using SDS primitives (`SDSSection`, `SDSGrid`, `SDSHeading`,
 * `SDSLead`, `SDSHero`, `SDSLinkList`, `SDSTeaserCard`, `SDSLink`).
 */

/* ---- Shared style constants (SDS design tokens, no local stylesheet) ------ */

export const teaserCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  height: "100%",
  padding: "1.25rem",
  background: "var(--sds-color-background)",
  border: "1px solid var(--sds-color-border)",
  borderTop: "3px solid var(--sds-color-primary)",
  textDecoration: "none",
  color: "var(--sds-color-text)",
};

export const teaserTagStyle: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--sds-color-primary)",
};

export const teaserTitleStyle: CSSProperties = {
  display: "block",
  fontSize: "1.0625rem",
  lineHeight: 1.35,
  fontWeight: 700,
};

export const teaserDescStyle: CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  lineHeight: 1.55,
  color: "var(--sds-color-text-muted)",
};

const denominationCardStyle: CSSProperties = {
  ...teaserCardStyle,
  textAlign: "center",
  alignItems: "center",
};

const denominationValueStyle: CSSProperties = {
  display: "block",
  fontSize: "clamp(2rem, 5vw, 2.75rem)",
  lineHeight: 1.1,
  fontWeight: 700,
};

const denominationUnitStyle: CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--sds-color-text-muted)",
};

const stepBadgeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2rem",
  height: "2rem",
  flexShrink: 0,
  borderRadius: "50%",
  background: "var(--sds-color-primary)",
  color: "var(--sds-color-background)",
  fontSize: "0.9375rem",
  fontWeight: 700,
};

const flowItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
};

const flowListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
};

const flowNodeStyle: CSSProperties = {
  padding: "0.625rem 1rem",
  background: "var(--sds-color-background)",
  border: "1px solid var(--sds-color-border)",
  borderTop: "3px solid var(--sds-color-primary)",
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "var(--sds-color-text)",
};

const factsListStyle: CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
  gap: "1px",
  background: "var(--sds-color-border)",
  border: "1px solid var(--sds-color-border)",
};

const factCellStyle: CSSProperties = {
  padding: "1rem 1.25rem",
  background: "var(--sds-color-background)",
};

const factLabelStyle: CSSProperties = {
  margin: "0 0 0.25rem",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--sds-color-text-muted)",
};

const factValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.0625rem",
  lineHeight: 1.4,
  fontWeight: 600,
  color: "var(--sds-color-text)",
};

const heroStatStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.75rem",
  padding: "0.875rem 1.25rem",
  background: "var(--sds-color-background)",
  border: "1px solid var(--sds-color-border)",
  borderTop: "3px solid var(--sds-color-primary)",
  textAlign: "left",
};

/* ---- Blocks --------------------------------------------------------------- */

/**
 * Generic process/flow representation: a chain of labelled nodes separated by
 * arrows. Used for the monetary circuits (“BCA → banques → usagers → BCA”) —
 * a schema, never a fake chart. Wraps gracefully on small screens.
 */
export function FlowDiagram({
  items,
  caption,
}: {
  items: ReadonlyArray<{ key: string; label: string }>;
  caption?: string;
}) {
  return (
    <figure style={{ margin: 0 }}>
      <ol role="list" style={flowListStyle}>
        {items.map((item, index) => (
          <li key={item.key} style={flowItemStyle}>
            {index > 0 ? (
              <span
                className="fr-icon-arrow-right-line"
                aria-hidden="true"
                style={{ color: "var(--sds-color-primary)" }}
              />
            ) : null}
            <span style={flowNodeStyle}>{item.label}</span>
          </li>
        ))}
      </ol>
      {caption ? (
        <figcaption
          className="fr-text--sm"
          style={{ marginTop: "0.75rem", color: "var(--sds-color-text-muted)" }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Definition grid for institutional reference facts (name, unit, status…). */
export function FactList({
  items,
}: {
  items: ReadonlyArray<{ key: string; label: string; value: string }>;
}) {
  return (
    <dl style={factsListStyle}>
      {items.map((item) => (
        <div key={item.key} style={factCellStyle}>
          <dt style={factLabelStyle}>{item.label}</dt>
          <dd style={factValueStyle}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The institutional hero of an interior page — the SDS hero component with an
 * optional reference figure and action buttons.
 */
export function ThemeHero({
  kicker,
  title,
  lead,
  actions,
  stat,
}: {
  kicker: string;
  title: string;
  lead: string;
  actions?: [CtaButton, ...CtaButton[]];
  stat?: { value: string; label: string };
}) {
  return (
    <SDSHero
      tone="subtle"
      kicker={kicker}
      title={title}
      subtitle={lead}
      actions={
        stat || actions ? (
          <>
            {stat ? (
              <span style={heroStatStyle}>
                <span
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.1, fontWeight: 700 }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--sds-color-text-muted)",
                  }}
                >
                  {stat.label}
                </span>
              </span>
            ) : null}
            {actions ? <CtaButtonsGroup buttons={actions} /> : null}
          </>
        ) : undefined
      }
    />
  );
}

/**
 * A content section of an interior page, composed from the SDS section
 * primitives: `SDSSection` provides the vertical rhythm and optional subtle
 * tone, `SDSContainer` the centered column, and the header is built from the
 * SDS kicker utility, `SDSHeading` and `SDSLead`.
 */
export function ThemeSection({
  id,
  kicker,
  title,
  lead,
  subtle,
  action,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  subtle?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SDSSection tone={subtle ? "subtle" : "default"}>
      <SDSContainer>
        <div className="gov-section__header" id={id}>
          <div>
            <p className="gov-kicker">{kicker}</p>
            <SDSHeading level={2}>{title}</SDSHeading>
            {lead ? <SDSLead>{lead}</SDSLead> : null}
          </div>
          {action}
        </div>
        {children}
      </SDSContainer>
    </SDSSection>
  );
}

export type StatItem = {
  key: string;
  value: string;
  label: string;
  href?: string;
  iconId?: string;
};

/** Figure cards — the “en chiffres” pattern, built on the SDS teaser card. */
export function StatGrid({
  items,
  perRow = 4,
}: {
  items: ReadonlyArray<StatItem>;
  perRow?: 3 | 4;
}) {
  return (
    <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: perRow }} gap={5}>
      {items.map((item) => (
        <SDSTeaserCard
          key={item.key}
          href={item.href}
          tag={item.iconId ? <span className={item.iconId} aria-hidden="true" /> : undefined}
          title={item.value}
          description={item.label}
        />
      ))}
    </SDSGrid>
  );
}

/** Responsive data table of the analytical pages (overflow scroll on mobile). */
export function DataTable({
  caption,
  headers,
  rows,
  note,
}: {
  caption: string;
  headers: string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
  note?: string;
}) {
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
          }}
        >
          <caption
            style={{
              textAlign: "left",
              padding: "0 0 0.75rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--sds-color-text)",
            }}
          >
            {caption}
          </caption>
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "0.625rem 0.75rem",
                    borderBottom: "2px solid var(--sds-color-border)",
                    fontWeight: 700,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderBottom: "1px solid var(--sds-color-border)",
                      background: cellIndex === 0 ? "var(--sds-color-surface-muted)" : undefined,
                      fontWeight: cellIndex === 0 ? 600 : undefined,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? (
        <figcaption
          className="fr-text--sm"
          style={{ marginTop: "0.5rem", color: "var(--sds-color-text-muted)" }}
        >
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Cross-links between the pages of a theme — the footer of every theme page. */
export function RelatedPages({
  title,
  kicker = "Dans le même thème",
  pages,
}: {
  title: string;
  kicker?: string;
  pages: ReadonlyArray<{ key: string; label: string; desc: string; href: string }>;
}) {
  return (
    <SDSSection tone="subtle">
      <SDSContainer>
        <p className="gov-kicker">{kicker}</p>
        <SDSLinkList
          title={title}
          items={pages.map((page) => ({
            label: page.label,
            description: page.desc,
            href: page.href,
          }))}
        />
      </SDSContainer>
    </SDSSection>
  );
}

/* ---- Article renderer of the theme pages ---------------------------------- */

/** One localized content block of a theme page. */
export type LocalizedSection = {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  subtle?: boolean;
  /** Editorial paragraphs, rendered inside `.gov-prose`. */
  paragraphs?: ReadonlyArray<string>;
  /** Simple list, rendered inside `.gov-prose`. */
  bullets?: ReadonlyArray<string>;
  /** Institutional reference facts (label + value), rendered as a definition grid. */
  facts?: ReadonlyArray<{ key: string; label: string; value: string }>;
  /** Process / flow schema (chain of labelled nodes). */
  flow?: ReadonlyArray<{ key: string; label: string }>;
  /** Feature cards (icon + title + text). */
  cards?: ReadonlyArray<{ key: string; title: string; text: string; iconId?: string }>;
  /** SDS tiles (title + desc + icon + link). */
  tiles?: ReadonlyArray<{ key: string; title: string; desc: string; href: string; iconId: string }>;
  /** Figure cards (“en chiffres”). */
  statGrid?: ReadonlyArray<StatItem>;
  /** Responsive data table. */
  table?: {
    caption: string;
    headers: string[];
    rows: ReadonlyArray<ReadonlyArray<string | number>>;
    note?: string;
  };
  /** Denomination cards (banknotes / coins). */
  denominations?: ReadonlyArray<{ key: string; value: string; unit: string; tag?: string; motif?: string }>;
  /** Numbered steps. */
  steps?: ReadonlyArray<{ key: string; title: string; text: string }>;
  /** Link rows. */
  links?: ReadonlyArray<{ key: string; label: string; href: string }>;
  /** Callout shown at the end of the section. */
  notice?: string;
  /** Inline link shown at the end of the section. */
  cta?: { label: string; href: string };
};

export type LocalizedArticle = {
  hero: {
    kicker: string;
    title: string;
    lead: string;
    cta?: { label: string; href: string };
    notice?: string;
    stat?: { value: string; label: string };
  };
  sections: ReadonlyArray<LocalizedSection>;
  /** Heading of the cross-links block, resolved from `pages.<theme>.related.title`. */
  relatedTitle: string;
  /** Kicker of the cross-links block, resolved from `pages.<theme>.related.kicker`. */
  relatedKicker: string;
  related: ReadonlyArray<{ key: string; label: string; desc: string; href: string }>;
};

/**
 * Full page composed from a *localized* content object (produced by
 * `lib/theme-localize.ts` from the message catalogs): hero, ordered sections and
 * cross-links.
 */
export function ThemeArticle({
  content,
  currentHref,
}: {
  content: LocalizedArticle;
  currentHref: string;
}) {
  return (
    <>
      <ThemeHero
        kicker={content.hero.kicker}
        title={content.hero.title}
        lead={content.hero.lead}
        stat={content.hero.stat}
        actions={
          content.hero.cta
            ? [
                {
                  children: content.hero.cta.label,
                  href: content.hero.cta.href,
                  priority: "secondary",
                  iconId: "fr-icon-arrow-right-line",
                },
              ]
            : undefined
        }
      />

      {content.hero.notice ? (
        <SDSContainer size="narrow">
          <NoticeCallout iconId="fr-icon-information-line">{content.hero.notice}</NoticeCallout>
        </SDSContainer>
      ) : null}

      {content.sections.map((section) => (
        <ThemeSection
          key={section.id}
          id={section.id}
          kicker={section.kicker}
          title={section.title}
          lead={section.lead}
          subtle={section.subtle}
        >
          {section.paragraphs ? (
            <div className="gov-prose">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          {section.bullets ? (
            <div className="gov-prose">
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {section.facts ? (
            <div style={{ marginTop: "1.5rem" }}>
              <FactList items={section.facts} />
            </div>
          ) : null}

          {section.flow ? (
            <div style={{ marginTop: "1.5rem" }}>
              <FlowDiagram items={section.flow} />
            </div>
          ) : null}

          {section.cards ? (
            <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap={5}>
              {section.cards.map((card) => (
                <SDSTeaserCard
                  key={card.key}
                  tag={card.iconId ? <span className={card.iconId} aria-hidden="true" /> : undefined}
                  title={card.title}
                  description={card.text}
                />
              ))}
            </SDSGrid>
          ) : null}

          {section.tiles ? (
            <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap={5}>
              {section.tiles.map((tile) => (
                <LinkTile
                  key={tile.key}
                  title={tile.title}
                  desc={tile.desc}
                  href={tile.href}
                  iconId={tile.iconId as FrIconClassName}
                />
              ))}
            </SDSGrid>
          ) : null}

          {section.statGrid ? <StatGrid items={section.statGrid} /> : null}

          {section.table ? (
            <DataTable
              caption={section.table.caption}
              headers={[...section.table.headers]}
              rows={section.table.rows}
              note={section.table.note}
            />
          ) : null}

          {section.denominations ? (
            <SDSGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={5}>
              {section.denominations.map((denomination) => (
                <div key={denomination.key} style={denominationCardStyle}>
                  <span style={denominationValueStyle}>{denomination.value}</span>
                  <span style={denominationUnitStyle}>{denomination.unit}</span>
                  {denomination.tag ? <span style={teaserTagStyle}>{denomination.tag}</span> : null}
                  {denomination.motif ? <span style={teaserTitleStyle}>{denomination.motif}</span> : null}
                </div>
              ))}
            </SDSGrid>
          ) : null}

          {section.steps ? (
            <ol
              role="list"
              style={{
                listStyle: "none",
                margin: "0",
                padding: "0",
                display: "grid",
                gap: "1rem",
                maxWidth: "72rem",
              }}
            >
              {section.steps.map((step, index) => (
                <li
                  key={step.key}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "flex-start",
                    padding: "1rem 1.25rem",
                    background: "var(--sds-color-background)",
                    border: "1px solid var(--sds-color-border)",
                  }}
                >
                  <span style={stepBadgeStyle} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    <span style={{ display: "block", fontWeight: 700 }}>{step.title}</span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.9375rem",
                        lineHeight: 1.55,
                        color: "var(--sds-color-text-muted)",
                      }}
                    >
                      {step.text}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {section.links ? (
            <SDSLinkList
              items={section.links.map((link) => ({ label: link.label, href: link.href }))}
            />
          ) : null}

          {section.cta ? (
            <p>
              <SDSLink
                href={section.cta.href}
                variant="action"
                iconId="fr-icon-arrow-right-line"
              >
                {section.cta.label}
              </SDSLink>
            </p>
          ) : null}

          {section.notice ? (
            <div style={{ marginTop: "1.5rem" }}>
              <NoticeCallout iconId="fr-icon-information-line">{section.notice}</NoticeCallout>
            </div>
          ) : null}
        </ThemeSection>
      ))}

      <RelatedPages
        title={content.relatedTitle}
        kicker={content.relatedKicker}
        pages={content.related.filter((page) => page.href !== currentHref)}
      />
    </>
  );
}
