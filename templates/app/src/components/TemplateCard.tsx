import { ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { TemplateLogo } from "./TemplateLogo";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/templates";

interface TemplateCardProps {
  template: Template;
  view?: "grid" | "rows";
}

export function TemplateCard({ template, view = "grid" }: TemplateCardProps) {
  const location = useLocation();
  const isRow = view === "rows";

  return (
    <Link
      to={{
        pathname: `/templates/${encodeURIComponent(template.id)}`,
        search: location.search,
      }}
      className={cn(
        "group rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:p-6",
        isRow
          ? "flex flex-col gap-4 sm:flex-row sm:items-center"
          : "flex h-full flex-col gap-4"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3",
          isRow && "sm:w-72 sm:shrink-0 sm:items-center"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40 p-1.5">
          <TemplateLogo template={template} className="h-full w-full" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
            {template.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version {template.version || "latest"}
          </p>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary",
            !isRow && "hidden sm:block"
          )}
        />
      </div>

      <p
        className={cn(
          "text-sm leading-relaxed text-muted-foreground",
          isRow ? "line-clamp-2 sm:flex-1" : "line-clamp-3"
        )}
      >
        {template.description}
      </p>

      {template.tags.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5",
            !isRow && "mt-auto",
            isRow && "sm:w-56 sm:shrink-0 sm:justify-end"
          )}
        >
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
              +{template.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
