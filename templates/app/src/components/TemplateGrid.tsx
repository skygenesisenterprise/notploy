import type * as React from "react";
import { SearchX } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Container } from "./Container";
import { TemplateCard } from "./TemplateCard";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/templates";
import type { TemplatesStatus } from "@/hooks/use-templates";

interface TemplateGridProps {
  templates: Template[];
  totalCount: number;
  view: "grid" | "rows";
  status: TemplatesStatus;
  error: string | null;
  hasFilters: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
}

const gridClasses = (view: "grid" | "rows") =>
  cn("grid gap-4", {
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3": view === "grid",
    "grid-cols-1": view === "rows",
  });

const TemplateGrid: React.FC<TemplateGridProps> = ({
  templates,
  totalCount,
  view,
  status,
  error,
  hasFilters,
  onRetry,
  onClearFilters,
}) => {
  if (status === "loading") {
    return (
      <Container className="py-10 sm:py-12">
        <div className={gridClasses(view)}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
            <div
              key={item}
              className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card/50 p-6"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="mt-2 flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    );
  }

  if (status === "error") {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-xl rounded-xl border border-border/50 bg-card p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Catalogue unavailable
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold">
            Templates could not be loaded
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error ??
              "An unexpected error occurred while loading the catalogue."}
          </p>
          <Button className="mt-6" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10 sm:py-12">
      {templates.length > 0 ? (
        <div className={gridClasses(view)}>
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} view={view} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-xl rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
          <SearchX
            aria-hidden="true"
            className="mx-auto size-7 text-muted-foreground"
          />
          <h2 className="mt-4 font-display text-xl font-semibold">
            {hasFilters
              ? "No templates match your criteria"
              : "No templates are available"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {hasFilters
              ? `${totalCount} templates are available in the catalogue. Try a different search or remove some tags.`
              : "The catalogue is empty right now. Try again later."}
          </p>
          {hasFilters && (
            <Button variant="outline" className="mt-6" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </Container>
  );
};

export default TemplateGrid;
