import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, BookOpen, Plus } from "lucide-react";
import Search from "./Search";
import TemplateGrid from "./TemplateGrid";
import { Button } from "./ui/button";
import { Container } from "./Container";
import { useTemplates } from "@/hooks/use-templates";
import { allTags, filterTemplates } from "@/lib/templates";
import { useStore } from "@/store";

const Gallery = () => {
  const [, setSearchParams] = useSearchParams();

  const { templates, status, error, retry } = useTemplates();
  const searchQuery = useStore((state) => state.searchQuery);
  const selectedTags = useStore((state) => state.selectedTags);
  const view = useStore((state) => state.view);
  const clearFilters = useStore((state) => state.clearFilters);

  const filteredTemplates = React.useMemo(
    () => filterTemplates(templates, searchQuery, selectedTags),
    [templates, searchQuery, selectedTags]
  );
  const tags = React.useMemo(() => allTags(templates), [templates]);

  const hasFilters = searchQuery.trim().length > 0 || selectedTags.length > 0;

  const handleClearFilters = () => {
    clearFilters();
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("q");
        next.delete("tags");
        return next;
      },
      { replace: true }
    );
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/50">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 12%, transparent), transparent 62%)",
          }}
        />
        <Container className="relative py-14 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Templates
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Deploy open source software in one click.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {templates.length > 0
              ? `${templates.length} production-ready blueprints with Docker Compose, environment defaults and volumes already configured.`
              : "A curated catalogue of production-ready Docker Compose blueprints, ready to run on your own infrastructure."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#catalogue">
                Browse the catalogue
                <ArrowDown aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a
                href="https://docs.notploy.com/docs/core/installation"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen aria-hidden="true" />
                Read the docs
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a
                href="https://github.com/skygenesisenterprise/notploy/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Plus aria-hidden="true" />
                Add a template
              </a>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-border/50 pt-6">
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Blueprints
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold">
                {status === "ready" ? templates.length : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Categories
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold">
                {status === "ready" ? tags.length : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Runtime
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold">Docker</dd>
            </div>
          </dl>
        </Container>
      </section>

      <Search
        resultCount={filteredTemplates.length}
        totalCount={templates.length}
        tags={tags}
      />
      <TemplateGrid
        templates={filteredTemplates}
        totalCount={templates.length}
        view={view}
        status={status}
        error={error}
        hasFilters={hasFilters}
        onRetry={retry}
        onClearFilters={handleClearFilters}
      />
    </>
  );
};

export default Gallery;
