import { ArrowUpRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Container } from "./Container";
import NotployLogo from "./ui/notploy-logo";

const FOOTER_SECTIONS = [
  {
    title: "Templates",
    ariaLabel: "Templates",
    links: [
      { href: "/", label: "All templates" },
      {
        href: "https://github.com/skygenesisenterprise/notploy/tree/master/templates/blueprints",
        label: "Blueprint source",
      },
      {
        href: "https://github.com/skygenesisenterprise/notploy/issues/new",
        label: "Add a template",
      },
      {
        href: "https://docs.notploy.com/docs/core/installation",
        label: "Installation",
      },
    ],
  },
  {
    title: "Product",
    ariaLabel: "Notploy product",
    links: [
      { href: "https://notploy.com", label: "Website" },
      { href: "https://notploy.com/self", label: "Notploy Self" },
      { href: "https://notploy.com/cloud", label: "Notploy Cloud" },
      { href: "https://notploy.com/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Developers",
    ariaLabel: "Developer resources",
    links: [
      { href: "https://docs.notploy.com", label: "Documentation" },
      {
        href: "https://docs.notploy.com/docs/core/architecture",
        label: "Architecture",
      },
      { href: "https://docs.notploy.com/docs/api", label: "API reference" },
      {
        href: "https://github.com/skygenesisenterprise/notploy/releases",
        label: "Changelog",
      },
    ],
  },
  {
    title: "Community",
    ariaLabel: "Community",
    links: [
      {
        href: "https://github.com/skygenesisenterprise/notploy",
        label: "GitHub",
      },
      {
        href: "https://github.com/skygenesisenterprise/notploy/discussions",
        label: "Discussions",
      },
      { href: "https://discord.gg/GUkDugVh34", label: "Discord" },
      {
        href: "https://support.skygenesisenterprise.com",
        label: "Support",
      },
    ],
  },
] as const;

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background" role="contentinfo">
      <Container>
        <div className="py-12 md:py-16">
          <div className="flex flex-col items-center gap-2 text-center md:items-start">
            <Link
              to="/"
              aria-label="Notploy Templates — Home"
              className="flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <NotployLogo className="h-8 w-auto text-primary" />
              <span className="font-display text-lg font-semibold text-primary">
                Notploy Templates
              </span>
            </Link>
            <span className="text-sm font-medium text-muted-foreground">
              Open source deployment blueprints for your own infrastructure.
            </span>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_SECTIONS.map((section) => (
              <nav
                key={section.title}
                aria-label={section.ariaLabel}
                className="flex flex-col"
              >
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {section.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href + link.label}>
                      {link.href.startsWith("/") ? (
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-border/50 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Notploy. Open-source, Apache-2.0.
          </p>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <a
              href="https://github.com/skygenesisenterprise/notploy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github aria-hidden="true" className="size-4" />
              GitHub
            </a>
            <a
              href="https://discord.gg/GUkDugVh34"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Discord
            </a>
            <a
              href="https://docs.notploy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Docs
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
