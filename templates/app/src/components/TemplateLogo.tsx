import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { templateLogoUrl, type Template } from "@/lib/templates";

interface TemplateLogoProps {
  template: Template;
  className?: string;
}

export function TemplateLogo({ template, className }: TemplateLogoProps) {
  const logoUrl = templateLogoUrl(template);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (logoUrl) setFailed(false);
  }, [logoUrl]);

  if (!logoUrl || failed) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-md bg-muted/60 text-muted-foreground",
          className
        )}
      >
        <LayoutGrid className="size-5" />
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      loading="lazy"
      decoding="async"
      width={48}
      height={48}
      onError={() => setFailed(true)}
      className={cn("object-contain", className)}
    />
  );
}
