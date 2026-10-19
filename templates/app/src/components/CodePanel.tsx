import * as React from "react";
import copy from "copy-to-clipboard";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "./ui/code-editor";
import { cn } from "@/lib/utils";

export function TrafficLights() {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
      <span className="size-3 rounded-full bg-[#FF5F57]" />
      <span className="size-3 rounded-full bg-[#FEBC2E]" />
      <span className="size-3 rounded-full bg-[#28C840]" />
    </div>
  );
}

export function CopyButton({
  text,
  className,
  label = "Copy code",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = () => {
    if (!text) return;
    if (copy(text)) {
      setCopied(true);
      toast.success("Copied to clipboard");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className
      )}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4 text-green-500" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

interface CodePanelProps {
  code: string;
  language: "yaml" | "toml";
  fileName: string;
  height?: string;
  className?: string;
}

export function CodePanel({
  code,
  language,
  fileName,
  height = "24rem",
  className,
}: CodePanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-lg",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-foreground/[0.03] px-4 py-2">
        <TrafficLights />
        <span className="truncate font-mono text-xs text-muted-foreground">
          {fileName}
        </span>
        <div className="ml-auto">
          <CopyButton text={code} />
        </div>
      </div>
      <CodeEditor
        className="code-editor"
        value={code}
        language={language}
        height={height}
        readOnly
        lineWrapping
      />
    </div>
  );
}
