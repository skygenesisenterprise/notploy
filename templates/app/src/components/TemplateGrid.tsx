import type * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { TemplateLogo } from "./TemplateLogo";
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
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4": view === "grid",
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
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className={gridClasses(view)}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <Skeleton
              key={item}
              className={cn({
                "h-[300px]": view === "grid",
                "h-[135px]": view === "rows",
              })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold">Templates could not be loaded</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {error ?? "An unexpected error occurred while loading the catalogue."}
        </p>
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {templates.length > 0 ? (
        <div className={gridClasses(view)}>
          {templates.map((template) => (
            <Link
              key={template.id}
              to={{
                pathname: `/templates/${encodeURIComponent(template.id)}`,
                search: location.search,
              }}
              className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card
                className={cn(
                  "h-full max-h-[300px] transition-all duration-200 group-hover:shadow-lg",
                  {
                    "flex-col": view === "grid",
                    "flex-row gap-0": view === "rows",
                  }
                )}
              >
                <CardHeader
                  className={cn("flex gap-2", {
                    "flex-row": view === "grid",
                    "ms-4 flex-col items-center justify-center": view === "rows",
                  })}
                >
                  <TemplateLogo
                    template={template}
                    className={cn("mb-2 h-12 w-auto", {
                      "h-12 w-auto": view === "grid",
                      "h-auto w-12": view === "rows",
                    })}
                  />
                </CardHeader>
                <CardContent className="flex-1">
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {template.description}
                  </p>
                  {template.tags.length > 0 && (
                    <div className="mt-2 flex w-fit flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {template.version || "latest"}
                  </span>
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className="h-4 w-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <h2 className="text-xl font-semibold">
            {hasFilters
              ? "No templates match your criteria"
              : "No templates are available"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFilters
              ? `${totalCount} templates are available in the catalogue.`
              : "The catalogue is empty right now. Try again later."}
          </p>
          {hasFilters && (
            <Button variant="outline" className="mt-6" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateGrid;
