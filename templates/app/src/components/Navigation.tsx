import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Github, Menu, Plus, Star, X } from "lucide-react";
import { ModeToggle } from "@/mode-toggle";
import { Button } from "./ui/button";
import { Container } from "./Container";
import NotployLogo from "./ui/notploy-logo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Templates", internal: true },
  { href: "https://notploy.com", label: "Website", internal: false },
  {
    href: "https://docs.notploy.com",
    label: "Documentation",
    internal: false,
  },
] as const;

const REPOSITORY_URL = "https://github.com/skygenesisenterprise/notploy";

function useGithubStars() {
  const [githubStars, setGithubStars] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchGithubStars = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/skygenesisenterprise/notploy"
        );
        if (!response.ok) return;

        const data: unknown = await response.json();
        if (
          !cancelled &&
          typeof data === "object" &&
          data !== null &&
          "stargazers_count" in data &&
          typeof data.stargazers_count === "number" &&
          Number.isFinite(data.stargazers_count)
        ) {
          setGithubStars(data.stargazers_count);
        }
      } catch {
        // Stars are decorative; a rate-limited request must not break the header.
      }
    };

    void fetchGithubStars();
    return () => {
      cancelled = true;
    };
  }, []);

  return githubStars;
}

function GithubStarsButton({
  githubStars,
  className,
}: {
  githubStars: number | null;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        "rounded-full border-border/60 bg-card/40 shadow-none",
        className
      )}
    >
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the Notploy repository on GitHub${
          githubStars === null ? "" : ` (${githubStars} stars)`
        }`}
      >
        <Star aria-hidden="true" className="size-4 fill-muted text-muted" />
        <span className="tabular-nums">
          {githubStars === null ? "Star" : githubStars.toLocaleString()}
        </span>
        <Github aria-hidden="true" className="size-4" />
      </a>
    </Button>
  );
}

const Navigation = () => {
  const githubStars = useGithubStars();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const previousPathname = React.useRef(location.pathname);

  React.useEffect(() => {
    if (previousPathname.current === location.pathname) return;
    previousPathname.current = location.pathname;
    setMobileOpen(false);
  }, [location.pathname]);

  const isTemplatesRoute = location.pathname === "/" || location.pathname.startsWith("/templates/");

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Notploy Templates home"
            className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <NotployLogo className="h-8 w-auto text-primary" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-sm font-semibold tracking-tight">
                Notploy
              </span>
              <span className="mt-0.5 text-[0.65rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Templates
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active = link.internal && isTemplatesRoute;
              const className = cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              );

              return link.internal ? (
                <Link key={link.href} to={link.href} className={className}>
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <GithubStarsButton
              githubStars={githubStars}
              className="hidden sm:inline-flex"
            />
            <Button asChild className="hidden rounded-full sm:inline-flex">
              <a
                href="https://github.com/skygenesisenterprise/notploy/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Plus aria-hidden="true" />
                Add template
              </a>
            </Button>
            <ModeToggle />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full md:hidden"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
            </Button>
          </div>
        </nav>

        {mobileOpen && (
          <div
            id="mobile-navigation"
            className="border-t border-border/50 py-4 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) =>
                link.internal ? (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {link.label === "Documentation" ? (
                      <BookOpen aria-hidden="true" className="size-4" />
                    ) : null}
                    {link.label}
                  </a>
                )
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3">
              <Button asChild className="rounded-full">
                <a
                  href="https://github.com/skygenesisenterprise/notploy/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Plus aria-hidden="true" />
                  Add template
                </a>
              </Button>
              <GithubStarsButton githubStars={githubStars} className="w-full" />
            </div>
          </div>
        )}
      </Container>
    </header>
  );
};

export default Navigation;
