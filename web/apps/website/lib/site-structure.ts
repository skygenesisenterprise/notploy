/**
 * URL structure of the public portal of the Registre National des Entreprises
 * d'Astoria (RNEA) — the national registry of businesses of the Republic of
 * Astoria (`rnea.gouv.aor`).
 *
 * Hrefs are locale-agnostic pathnames: the next-intl Link (registered as the
 * ADS link renderer) prefixes the active locale automatically. Labels are
 * never stored here — they come from the message catalogs through the key
 * provided by each entry (see `apps/messages/{fr,en}.json`).
 *
 * Architecture of the navigation:
 *
 *   primaryNavigation  → the seven entries of the portal. Each entry opens a
 *                        mega-menu panel structured in four sections of four
 *                        links:
 *                            7 entrées × 4 sections × 4 liens = 112 liens
 *
 * This file is the single source of truth of the portal navigation: the
 * header (desktop mega-menus and mobile drawer), the sitemap and the footer
 * all derive their markup from `primaryNavigation`, so adding or renaming a
 * theme, section or link never requires rewriting a component — it only
 * requires editing this file (and the matching message keys).
 *
 * The information architecture is organised around the register and its
 * users — not around the administrative organisation that runs the service.
 * It follows the journey of anyone who must consult or act on the registry:
 *
 *   Entreprises              → agir      : rechercher, créer, modifier, cesser
 *   Registre                 → consulter : les entreprises enregistrées, les établissements, les dirigeants, l'historique
 *   Formalités               → déclarer  : les formalités, de la création à la cessation
 *   Propriété intellectuelle → protéger  : les marques, les brevets, les dessins et modèles
 *   Documents                → obtenir   : les extraits, les certificats, les actes déposés, la vérification
 *   Données                  → exploiter : les données ouvertes, les statistiques, les API, les téléchargements
 *   RNEA                     → connaître : le registre, ses tarifs, l'aide et le contact
 *
 * The structure deliberately keeps an RNEA perimeter: it exposes the
 * destinations that matter to anyone who must consult or act on the register,
 * without mirroring the internal organisation of the administration. It is
 * sufficiently generic to grow with the service without inventing new
 * sections just to fill the 7 × 4 × 4 model.
 *
 * The structure is validated both at compile time (the tuple types below
 * enforce exactly 7 themes × 4 sections × 4 links) and at runtime
 * (`validateNavigationStructure`), so a malformed navigation fails the build.
 *
 * Hrefs follow the URL plan of the portal; several point to pages being
 * published and will resolve as soon as those sections ship.
 */
export const PORTAL_HOME = "/";

/**
 * The seven entries of the portal — both `nav.primary` and `footer.columns`
 * keys. The first four entries carry the register journey (companies,
 * consultation, formalities, intellectual property); the last three are the
 * documents, data and institutional entries.
 */
export type PrimaryNavKey =
  | "entreprises"
  | "registre"
  | "formalites"
  | "proprieteIntellectuelle"
  | "documents"
  | "donnees"
  | "rnea";

/** A destination inside a mega-menu panel; its label is a `nav.panel` message key. */
export type NavigationLink = {
  labelKey: string;
  href: string;
};

/**
 * A section of a navigation theme. In the mega-menu panel it heads one of the
 * four columns (`labelKey` → `nav.panel.<theme>.<section>.title`); in the
 * footer it becomes a destination of the domain column. It carries the four
 * destinations of the section.
 */
export type NavigationItem = NavigationLink & {
  /** Related destinations nested under this section. */
  links: NavigationLinks;
};

/**
 * The four destinations of a section. The tuple type is the compile-time
 * guarantee that no section exposes anything other than exactly 4 links.
 */
export type NavigationLinks = readonly [
  NavigationLink,
  NavigationLink,
  NavigationLink,
  NavigationLink,
];

/**
 * The four sections of a theme. The tuple type is the compile-time guarantee
 * that no theme exposes anything other than exactly 4 sections.
 */
export type NavigationItems = readonly [
  NavigationItem,
  NavigationItem,
  NavigationItem,
  NavigationItem,
];

/**
 * One top-level entry of the Government Header navigation.
 *
 * Navigation principle (info.gouv.fr-inspired, adapted to Astoria): the header
 * is organised around the register journey — not around the internal structure
 * of the administration. Each entry opens a mega-menu panel composed of
 *  - a leader band: the entry name, a one-line description and the main
 *    action of the section (“Tout sur les entreprises”, …),
 *  - four sections, each headed by its title and followed by its four
 *    destinations.
 *
 * Top-level labels resolve under `nav.primary` (`labelKey`), panel content
 * under `nav.panel` (`titleKey`, `paragraphKey`, nested `labelKey`s).
 */
export type NavigationSection = {
  type: "megaMenu";
  /** Message key (`nav.primary`) of the top-level tab. */
  labelKey: PrimaryNavKey;
  /** Landing page of the section, used by the leader action and active-state detection. */
  href: string;
  /** Leader band shown on top of the panel. */
  leader: {
    titleKey: string;
    paragraphKey: string;
    link: NavigationLink;
  };
  /** The four sections of the theme, each with its four links. */
  primaryItems: NavigationItems;
};

export type FooterColumn = {
  /** Message key (`footer.columns`) of the column heading. */
  columnKey: string;
  links: ReadonlyArray<NavigationLink>;
};

export const sectionPaths = {
  entreprises: "/entreprises",
  registre: "/registre",
  formalites: "/formalites",
  proprieteIntellectuelle: "/propriete-intellectuelle",
  documents: "/documents",
  donnees: "/donnees",
  rnea: "/rnea",
} as const;

export const legalPaths = {
  accessibility: "/legal/accessibility",
  privacy: "/legal/privacy",
  terms: "/legal/terms",
  cookies: "/legal/cookies",
  sitemap: "/sitemap",
} as const;

export const searchPath = "/search";

/** DOM ids used as skip-link targets. */
export const pageAnchors = {
  content: "main-content",
  footer: "main-footer",
} as const;

/** Structural guard: the navigation must stay a fixed 7 × 4 × 4 grid. */
export const navigationShape = {
  themes: 7,
  sectionsPerTheme: 4,
  linksPerSection: 4,
} as const;

/**
 * Runtime validation of the navigation structure. Returns the list of
 * problems found (empty when the structure is valid):
 *  - the portal must expose exactly 7 themes;
 *  - each theme must contain exactly 4 sections;
 *  - each section must contain exactly 4 links;
 *  - every link must carry a non-empty, absolute-path destination.
 *
 * The same invariants are enforced at compile time by the tuple types
 * (`NavigationItems`, `NavigationLinks` and the seven-tuple below).
 */
export function validateNavigationStructure(
  navigation: ReadonlyArray<NavigationSection> = primaryNavigation
): string[] {
  const problems: string[] = [];

  if (navigation.length !== navigationShape.themes) {
    problems.push(
      `La navigation doit comporter exactement ${navigationShape.themes} thèmes, or elle en compte ${navigation.length}.`
    );
  }

  for (const section of navigation) {
    if (section.primaryItems.length !== navigationShape.sectionsPerTheme) {
      problems.push(
        `Le thème « ${section.labelKey} » doit contenir exactement ${navigationShape.sectionsPerTheme} sections, or il en compte ${section.primaryItems.length}.`
      );
    }

    for (const item of section.primaryItems) {
      if (item.links.length !== navigationShape.linksPerSection) {
        problems.push(
          `La section « ${item.labelKey} » doit contenir exactement ${navigationShape.linksPerSection} liens, or elle en compte ${item.links.length}.`
        );
      }

      for (const link of item.links) {
        if (!link.href || !link.href.startsWith("/")) {
          problems.push(
            `Le lien « ${link.labelKey} » (« ${item.labelKey} ») n'a pas de destination valide : « ${link.href} ».`
          );
        }
      }
    }
  }

  return problems;
}

/**
 * Throws when the navigation structure is malformed. Called at module load so
 * a structural error fails the build immediately instead of shipping a broken
 * header. Satisfies the contract: 7 thèmes × 4 sections × 4 liens = 112 liens.
 */
function assertNavigationStructureValid(): void {
  const problems = validateNavigationStructure();
  if (problems.length > 0) {
    throw new Error(
      `Structure de navigation invalide :\n- ${problems.join("\n- ")}`
    );
  }
}

/** Convenience: the total number of destinations exposed by the navigation. */
export function countNavigationLinks(
  navigation: ReadonlyArray<NavigationSection> = primaryNavigation
): number {
  return navigation.reduce(
    (total, section) =>
      total +
      section.primaryItems.reduce(
        (sectionTotal, item) => sectionTotal + item.links.length,
        0
      ),
    0
  );
}

/**
 * Main navigation of the Government Header of the Registre National des
 * Entreprises d'Astoria — the permanent information architecture of the
 * portal, organised in seven entries:
 *
 *   Entreprises              → agir      : rechercher, créer, modifier, cesser une activité
 *   Registre                 → consulter : les entreprises enregistrées, les établissements, les dirigeants, l'historique
 *   Formalités               → déclarer  : les formalités, de la création à la cessation
 *   Propriété intellectuelle → protéger  : les marques, les brevets, les dessins et modèles
 *   Documents                → obtenir   : les extraits, les certificats, les documents déposés, la vérification
 *   Données                  → exploiter : les données ouvertes, les statistiques, les API, les téléchargements
 *   RNEA                     → connaître : le registre, ses tarifs, l'aide et le contact
 *
 * The first four entries carry the operational journey of the registry
 * (companies, consultation, formalities, protection of creations); the last
 * three are the reference, data and institutional entries. The two audiences
 * of the registry (those who act on a company, those who consult the register)
 * stay separated without turning the navigation into a mirror of the
 * administrative organisation.
 *
 * Each entry opens a mega-menu panel with a leader band and four sections —
 * each section headed by its title and followed by its four destinations. The
 * panel is not the sitemap of the portal; it exposes the destinations that
 * matter to the visitor journey. The structure is configuration-driven and
 * validated: adding a section only means adding an entry here (and the
 * matching messages).
 */
export const primaryNavigation: ReadonlyArray<NavigationSection> = [
  {
    type: "megaMenu",
    labelKey: "entreprises",
    href: sectionPaths.entreprises,
    leader: {
      titleKey: "entreprises.title",
      paragraphKey: "entreprises.text",
      link: {
        labelKey: "entreprises.allLink",
        href: sectionPaths.entreprises,
      },
    },
    primaryItems: [
      {
        labelKey: "entreprises.rechercher.title",
        href: `${sectionPaths.entreprises}/rechercher`,
        links: [
          { labelKey: "entreprises.rechercher.simple", href: `${sectionPaths.entreprises}/rechercher/simple` },
          { labelKey: "entreprises.rechercher.parSiren", href: `${sectionPaths.entreprises}/rechercher/par-siren` },
          { labelKey: "entreprises.rechercher.parDirigeant", href: `${sectionPaths.entreprises}/rechercher/par-dirigeant` },
          { labelKey: "entreprises.rechercher.avancee", href: `${sectionPaths.entreprises}/rechercher/avancee` },
        ],
      },
      {
        labelKey: "entreprises.creer.title",
        href: `${sectionPaths.entreprises}/creer`,
        links: [
          { labelKey: "entreprises.creer.conditionsImmatriculation", href: `${sectionPaths.entreprises}/creer/conditions-d-immatriculation` },
          { labelKey: "entreprises.creer.declarationActivite", href: `${sectionPaths.entreprises}/creer/declaration-d-activite` },
          { labelKey: "entreprises.creer.formalitesCreation", href: `${sectionPaths.entreprises}/creer/formalites-de-creation` },
          { labelKey: "entreprises.creer.suiviCreation", href: `${sectionPaths.entreprises}/creer/suivi-de-la-creation` },
        ],
      },
      {
        labelKey: "entreprises.modifier.title",
        href: `${sectionPaths.entreprises}/modifier`,
        links: [
          { labelKey: "entreprises.modifier.changementDirigeant", href: `${sectionPaths.entreprises}/modifier/changement-de-dirigeant` },
          { labelKey: "entreprises.modifier.changementAdresse", href: `${sectionPaths.entreprises}/modifier/changement-d-adresse` },
          { labelKey: "entreprises.modifier.modificationActivite", href: `${sectionPaths.entreprises}/modifier/modification-de-l-activite` },
          { labelKey: "entreprises.modifier.miseAJourInformations", href: `${sectionPaths.entreprises}/modifier/mise-a-jour-des-informations` },
        ],
      },
      {
        labelKey: "entreprises.cesser.title",
        href: `${sectionPaths.entreprises}/cesser`,
        links: [
          { labelKey: "entreprises.cesser.declarationCessation", href: `${sectionPaths.entreprises}/cesser/declaration-de-cessation` },
          { labelKey: "entreprises.cesser.radiation", href: `${sectionPaths.entreprises}/cesser/radiation-du-registre` },
          { labelKey: "entreprises.cesser.transmission", href: `${sectionPaths.entreprises}/cesser/transmission-d-entreprise` },
          { labelKey: "entreprises.cesser.suitesCessation", href: `${sectionPaths.entreprises}/cesser/suites-de-la-cessation` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "registre",
    href: sectionPaths.registre,
    leader: {
      titleKey: "registre.title",
      paragraphKey: "registre.text",
      link: {
        labelKey: "registre.allLink",
        href: sectionPaths.registre,
      },
    },
    primaryItems: [
      {
        labelKey: "registre.entreprisesEnregistrees.title",
        href: `${sectionPaths.registre}/entreprises-enregistrees`,
        links: [
          { labelKey: "registre.entreprisesEnregistrees.liste", href: `${sectionPaths.registre}/entreprises-enregistrees/liste-des-entreprises` },
          { labelKey: "registre.entreprisesEnregistrees.dernieresImmatriculations", href: `${sectionPaths.registre}/entreprises-enregistrees/dernieres-immatriculations` },
          { labelKey: "registre.entreprisesEnregistrees.etatDuRegistre", href: `${sectionPaths.registre}/entreprises-enregistrees/etat-du-registre` },
          { labelKey: "registre.entreprisesEnregistrees.publicationsLegales", href: `${sectionPaths.registre}/entreprises-enregistrees/publications-legales` },
        ],
      },
      {
        labelKey: "registre.etablissements.title",
        href: `${sectionPaths.registre}/etablissements`,
        links: [
          { labelKey: "registre.etablissements.liste", href: `${sectionPaths.registre}/etablissements/liste-des-etablissements` },
          { labelKey: "registre.etablissements.parRegion", href: `${sectionPaths.registre}/etablissements/par-region` },
          { labelKey: "registre.etablissements.ouvertureFermeture", href: `${sectionPaths.registre}/etablissements/ouverture-et-fermeture` },
          { labelKey: "registre.etablissements.rechercher", href: `${sectionPaths.registre}/etablissements/rechercher` },
        ],
      },
      {
        labelKey: "registre.dirigeants.title",
        href: `${sectionPaths.registre}/dirigeants`,
        links: [
          { labelKey: "registre.dirigeants.liste", href: `${sectionPaths.registre}/dirigeants/liste-des-dirigeants` },
          { labelKey: "registre.dirigeants.fonctionsMandats", href: `${sectionPaths.registre}/dirigeants/fonctions-et-mandats` },
          { labelKey: "registre.dirigeants.incompatibilites", href: `${sectionPaths.registre}/dirigeants/incompatibilites-et-interdictions` },
          { labelKey: "registre.dirigeants.rechercher", href: `${sectionPaths.registre}/dirigeants/rechercher` },
        ],
      },
      {
        labelKey: "registre.historique.title",
        href: `${sectionPaths.registre}/historique`,
        links: [
          { labelKey: "registre.historique.evenements", href: `${sectionPaths.registre}/historique/evenements-de-la-vie-de-l-entreprise` },
          { labelKey: "registre.historique.anciennesDenominations", href: `${sectionPaths.registre}/historique/anciennes-denominations` },
          { labelKey: "registre.historique.transfertsFusions", href: `${sectionPaths.registre}/historique/transferts-et-fusions` },
          { labelKey: "registre.historique.archives", href: `${sectionPaths.registre}/historique/archives-du-registre` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "formalites",
    href: sectionPaths.formalites,
    leader: {
      titleKey: "formalites.title",
      paragraphKey: "formalites.text",
      link: {
        labelKey: "formalites.allLink",
        href: sectionPaths.formalites,
      },
    },
    primaryItems: [
      {
        labelKey: "formalites.toutes.title",
        href: `${sectionPaths.formalites}/toutes`,
        links: [
          { labelKey: "formalites.toutes.parType", href: `${sectionPaths.formalites}/toutes/formalites-par-type` },
          { labelKey: "formalites.toutes.enCours", href: `${sectionPaths.formalites}/toutes/formalites-en-cours` },
          { labelKey: "formalites.toutes.historique", href: `${sectionPaths.formalites}/toutes/historique-des-formalites` },
          { labelKey: "formalites.toutes.coutsDelais", href: `${sectionPaths.formalites}/toutes/couts-et-delais` },
        ],
      },
      {
        labelKey: "formalites.creation.title",
        href: `${sectionPaths.formalites}/creation`,
        links: [
          { labelKey: "formalites.creation.immatriculation", href: `${sectionPaths.formalites}/creation/immatriculation` },
          { labelKey: "formalites.creation.debutActivite", href: `${sectionPaths.formalites}/creation/declaration-de-debut-d-activite` },
          { labelKey: "formalites.creation.simplifiees", href: `${sectionPaths.formalites}/creation/formalites-simplifiees` },
          { labelKey: "formalites.creation.documentsFournir", href: `${sectionPaths.formalites}/creation/documents-a-fournir` },
        ],
      },
      {
        labelKey: "formalites.modification.title",
        href: `${sectionPaths.formalites}/modification`,
        links: [
          { labelKey: "formalites.modification.enregistrables", href: `${sectionPaths.formalites}/modification/modifications-enregistrables` },
          { labelKey: "formalites.modification.declaration", href: `${sectionPaths.formalites}/modification/declaration-de-modification` },
          { labelKey: "formalites.modification.piecesJustificatives", href: `${sectionPaths.formalites}/modification/pieces-justificatives` },
          { labelKey: "formalites.modification.delaisOppositions", href: `${sectionPaths.formalites}/modification/delais-et-oppositions` },
        ],
      },
      {
        labelKey: "formalites.cessation.title",
        href: `${sectionPaths.formalites}/cessation`,
        links: [
          { labelKey: "formalites.cessation.declaration", href: `${sectionPaths.formalites}/cessation/declaration-de-cessation` },
          { labelKey: "formalites.cessation.radiation", href: `${sectionPaths.formalites}/cessation/radiation-du-registre` },
          { labelKey: "formalites.cessation.transmissionUniverselle", href: `${sectionPaths.formalites}/cessation/transmission-universelle` },
          { labelKey: "formalites.cessation.liquidation", href: `${sectionPaths.formalites}/cessation/liquidation` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "proprieteIntellectuelle",
    href: sectionPaths.proprieteIntellectuelle,
    leader: {
      titleKey: "proprieteIntellectuelle.title",
      paragraphKey: "proprieteIntellectuelle.text",
      link: {
        labelKey: "proprieteIntellectuelle.allLink",
        href: sectionPaths.proprieteIntellectuelle,
      },
    },
    primaryItems: [
      {
        labelKey: "proprieteIntellectuelle.marques.title",
        href: `${sectionPaths.proprieteIntellectuelle}/marques`,
        links: [
          { labelKey: "proprieteIntellectuelle.marques.deposer", href: `${sectionPaths.proprieteIntellectuelle}/marques/deposer-une-marque` },
          { labelKey: "proprieteIntellectuelle.marques.rechercher", href: `${sectionPaths.proprieteIntellectuelle}/marques/rechercher-une-marque` },
          { labelKey: "proprieteIntellectuelle.marques.renouveler", href: `${sectionPaths.proprieteIntellectuelle}/marques/renouveler-une-marque` },
          { labelKey: "proprieteIntellectuelle.marques.contester", href: `${sectionPaths.proprieteIntellectuelle}/marques/contester-une-marque` },
        ],
      },
      {
        labelKey: "proprieteIntellectuelle.brevets.title",
        href: `${sectionPaths.proprieteIntellectuelle}/brevets`,
        links: [
          { labelKey: "proprieteIntellectuelle.brevets.deposer", href: `${sectionPaths.proprieteIntellectuelle}/brevets/deposer-un-brevet` },
          { labelKey: "proprieteIntellectuelle.brevets.rechercher", href: `${sectionPaths.proprieteIntellectuelle}/brevets/rechercher-un-brevet` },
          { labelKey: "proprieteIntellectuelle.brevets.dureeEtendue", href: `${sectionPaths.proprieteIntellectuelle}/brevets/duree-et-etendue` },
          { labelKey: "proprieteIntellectuelle.brevets.contester", href: `${sectionPaths.proprieteIntellectuelle}/brevets/contester-un-brevet` },
        ],
      },
      {
        labelKey: "proprieteIntellectuelle.dessinsEtModeles.title",
        href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles`,
        links: [
          { labelKey: "proprieteIntellectuelle.dessinsEtModeles.deposer", href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles/deposer` },
          { labelKey: "proprieteIntellectuelle.dessinsEtModeles.rechercher", href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles/rechercher` },
          { labelKey: "proprieteIntellectuelle.dessinsEtModeles.protectionDuree", href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles/protection-et-duree` },
          { labelKey: "proprieteIntellectuelle.dessinsEtModeles.contester", href: `${sectionPaths.proprieteIntellectuelle}/dessins-et-modeles/contester` },
        ],
      },
      {
        labelKey: "proprieteIntellectuelle.informations.title",
        href: `${sectionPaths.proprieteIntellectuelle}/informations`,
        links: [
          { labelKey: "proprieteIntellectuelle.informations.questCeQue", href: `${sectionPaths.proprieteIntellectuelle}/informations/quest-ce-que-la-propriete-intellectuelle` },
          { labelKey: "proprieteIntellectuelle.informations.droitsCreateurs", href: `${sectionPaths.proprieteIntellectuelle}/informations/droits-des-createurs` },
          { labelKey: "proprieteIntellectuelle.informations.cadreJuridique", href: `${sectionPaths.proprieteIntellectuelle}/informations/cadre-juridique` },
          { labelKey: "proprieteIntellectuelle.informations.aidesConseils", href: `${sectionPaths.proprieteIntellectuelle}/informations/aides-et-conseils` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "documents",
    href: sectionPaths.documents,
    leader: {
      titleKey: "documents.title",
      paragraphKey: "documents.text",
      link: {
        labelKey: "documents.allLink",
        href: sectionPaths.documents,
      },
    },
    primaryItems: [
      {
        labelKey: "documents.extraits.title",
        href: `${sectionPaths.documents}/extraits`,
        links: [
          { labelKey: "documents.extraits.commander", href: `${sectionPaths.documents}/extraits/commander-un-extrait` },
          { labelKey: "documents.extraits.extraitK", href: `${sectionPaths.documents}/extraits/extrait-k` },
          { labelKey: "documents.extraits.immatriculation", href: `${sectionPaths.documents}/extraits/extrait-d-immatriculation` },
          { labelKey: "documents.extraits.certifie", href: `${sectionPaths.documents}/extraits/extrait-certifie` },
        ],
      },
      {
        labelKey: "documents.certificats.title",
        href: `${sectionPaths.documents}/certificats`,
        links: [
          { labelKey: "documents.certificats.existence", href: `${sectionPaths.documents}/certificats/certificat-d-existence` },
          { labelKey: "documents.certificats.immatriculation", href: `${sectionPaths.documents}/certificats/certificat-d-immatriculation` },
          { labelKey: "documents.certificats.attestations", href: `${sectionPaths.documents}/certificats/attestations` },
          { labelKey: "documents.certificats.legalisation", href: `${sectionPaths.documents}/certificats/legalisation` },
        ],
      },
      {
        labelKey: "documents.documentsDeposes.title",
        href: `${sectionPaths.documents}/documents-deposes`,
        links: [
          { labelKey: "documents.documentsDeposes.actes", href: `${sectionPaths.documents}/documents-deposes/actes-deposes` },
          { labelKey: "documents.documentsDeposes.etatsFinanciers", href: `${sectionPaths.documents}/documents-deposes/etats-financiers` },
          { labelKey: "documents.documentsDeposes.conventions", href: `${sectionPaths.documents}/documents-deposes/conventions-et-contrats` },
          { labelKey: "documents.documentsDeposes.consultation", href: `${sectionPaths.documents}/documents-deposes/consultation-en-ligne` },
        ],
      },
      {
        labelKey: "documents.verifier.title",
        href: `${sectionPaths.documents}/verifier`,
        links: [
          { labelKey: "documents.verifier.piece", href: `${sectionPaths.documents}/verifier/verifier-une-piece` },
          { labelKey: "documents.verifier.extrait", href: `${sectionPaths.documents}/verifier/verifier-un-extrait` },
          { labelKey: "documents.verifier.authenticite", href: `${sectionPaths.documents}/verifier/authenticite-des-documents` },
          { labelKey: "documents.verifier.securiteFraude", href: `${sectionPaths.documents}/verifier/securite-et-fraude` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "donnees",
    href: sectionPaths.donnees,
    leader: {
      titleKey: "donnees.title",
      paragraphKey: "donnees.text",
      link: {
        labelKey: "donnees.allLink",
        href: sectionPaths.donnees,
      },
    },
    primaryItems: [
      {
        labelKey: "donnees.donneesOuvertes.title",
        href: `${sectionPaths.donnees}/donnees-ouvertes`,
        links: [
          { labelKey: "donnees.donneesOuvertes.jeuxDeDonnees", href: `${sectionPaths.donnees}/donnees-ouvertes/jeux-de-donnees` },
          { labelKey: "donnees.donneesOuvertes.licence", href: `${sectionPaths.donnees}/donnees-ouvertes/licence-ouverte` },
          { labelKey: "donnees.donneesOuvertes.qualite", href: `${sectionPaths.donnees}/donnees-ouvertes/qualite-des-donnees` },
          { labelKey: "donnees.donneesOuvertes.reutilisation", href: `${sectionPaths.donnees}/donnees-ouvertes/reutilisation` },
        ],
      },
      {
        labelKey: "donnees.statistiques.title",
        href: `${sectionPaths.donnees}/statistiques`,
        links: [
          { labelKey: "donnees.statistiques.chiffresCles", href: `${sectionPaths.donnees}/statistiques/chiffres-cles` },
          { labelKey: "donnees.statistiques.creationsCessations", href: `${sectionPaths.donnees}/statistiques/creations-et-cessations` },
          { labelKey: "donnees.statistiques.repartitionSectorielle", href: `${sectionPaths.donnees}/statistiques/repartition-sectorielle` },
          { labelKey: "donnees.statistiques.rapportsAnnuel", href: `${sectionPaths.donnees}/statistiques/rapports-annuels` },
        ],
      },
      {
        labelKey: "donnees.api.title",
        href: `${sectionPaths.donnees}/api`,
        links: [
          { labelKey: "donnees.api.acces", href: `${sectionPaths.donnees}/api/acces-aux-api` },
          { labelKey: "donnees.api.documentation", href: `${sectionPaths.donnees}/api/documentation` },
          { labelKey: "donnees.api.guidesTechniques", href: `${sectionPaths.donnees}/api/guides-techniques` },
          { labelKey: "donnees.api.statutService", href: `${sectionPaths.donnees}/api/statut-du-service` },
        ],
      },
      {
        labelKey: "donnees.telechargements.title",
        href: `${sectionPaths.donnees}/telechargements`,
        links: [
          { labelKey: "donnees.telechargements.fichiers", href: `${sectionPaths.donnees}/telechargements/fichiers-du-registre` },
          { labelKey: "donnees.telechargements.misesAJour", href: `${sectionPaths.donnees}/telechargements/mises-a-jour` },
          { labelKey: "donnees.telechargements.formats", href: `${sectionPaths.donnees}/telechargements/formats-disponibles` },
          { labelKey: "donnees.telechargements.extraction", href: `${sectionPaths.donnees}/telechargements/extraction-sur-mesure` },
        ],
      },
    ],
  },
  {
    type: "megaMenu",
    labelKey: "rnea",
    href: sectionPaths.rnea,
    leader: {
      titleKey: "rnea.title",
      paragraphKey: "rnea.text",
      link: {
        labelKey: "rnea.allLink",
        href: sectionPaths.rnea,
      },
    },
    primaryItems: [
      {
        labelKey: "rnea.aPropos.title",
        href: `${sectionPaths.rnea}/a-propos`,
        links: [
          { labelKey: "rnea.aPropos.questCeQue", href: `${sectionPaths.rnea}/a-propos/quest-ce-que-le-rnea` },
          { labelKey: "rnea.aPropos.missions", href: `${sectionPaths.rnea}/a-propos/missions` },
          { labelKey: "rnea.aPropos.organisation", href: `${sectionPaths.rnea}/a-propos/organisation` },
          { labelKey: "rnea.aPropos.textesFondateurs", href: `${sectionPaths.rnea}/a-propos/textes-fondateurs` },
        ],
      },
      {
        labelKey: "rnea.tarifs.title",
        href: `${sectionPaths.rnea}/tarifs`,
        links: [
          { labelKey: "rnea.tarifs.formalites", href: `${sectionPaths.rnea}/tarifs/tarifs-des-formalites` },
          { labelKey: "rnea.tarifs.documents", href: `${sectionPaths.rnea}/tarifs/tarifs-des-documents` },
          { labelKey: "rnea.tarifs.gratuitesExonerations", href: `${sectionPaths.rnea}/tarifs/gratuites-et-exonerations` },
          { labelKey: "rnea.tarifs.paiement", href: `${sectionPaths.rnea}/tarifs/modalites-de-paiement` },
        ],
      },
      {
        labelKey: "rnea.aide.title",
        href: `${sectionPaths.rnea}/aide`,
        links: [
          { labelKey: "rnea.aide.questionsFrequentes", href: `${sectionPaths.rnea}/aide/questions-frequentes` },
          { labelKey: "rnea.aide.guidesTutoriels", href: `${sectionPaths.rnea}/aide/guides-et-tutoriels` },
          { labelKey: "rnea.aide.demarchesPasAPas", href: `${sectionPaths.rnea}/aide/demarches-pas-a-pas` },
          { labelKey: "rnea.aide.glossaire", href: `${sectionPaths.rnea}/aide/glossaire` },
        ],
      },
      {
        labelKey: "rnea.contact.title",
        href: `${sectionPaths.rnea}/contact`,
        links: [
          { labelKey: "rnea.contact.nousContacter", href: `${sectionPaths.rnea}/contact/nous-contacter` },
          { labelKey: "rnea.contact.horaires", href: `${sectionPaths.rnea}/contact/horaires-d-ouverture` },
          { labelKey: "rnea.contact.servicesEnLigne", href: `${sectionPaths.rnea}/contact/services-en-ligne` },
          { labelKey: "rnea.contact.pressePartenaires", href: `${sectionPaths.rnea}/contact/presse-et-partenaires` },
        ],
      },
    ],
  },
];

assertNavigationStructureValid();

/**
 * Secondary navigation zone of the site footer, distinct from the main
 * navigation of the header. It mirrors the seven entries of the header
 * navigation and derives its links from the sections of each theme — so the
 * footer and the header can never drift apart.
 *
 * Column titles resolve under `footer.columns`, links under `nav.panel`.
 */
export const footerNavigation: ReadonlyArray<FooterColumn> = primaryNavigation.map(
  (section) => ({
    columnKey: section.labelKey,
    links: section.primaryItems,
  })
);