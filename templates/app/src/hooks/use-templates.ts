import { useCallback, useEffect, useState } from "react";
import { normalizeTemplates } from "@/lib/templates";
import { useStore } from "@/store";

export type TemplatesStatus = "loading" | "ready" | "error";

export function useTemplates() {
  const templates = useStore((state) => state.templates);
  const setTemplates = useStore((state) => state.setTemplates);
  const [status, setStatus] = useState<TemplatesStatus>(
    templates.length > 0 ? "ready" : "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetch("/meta.json", {
          signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(
            `The templates catalogue could not be loaded (${response.status} ${response.statusText})`
          );
        }

        const data = normalizeTemplates(await response.json());
        if (signal?.aborted) return;

        setTemplates(data);
        setStatus("ready");
      } catch (caught) {
        if (signal?.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "The templates catalogue could not be loaded"
        );
        setStatus("error");
      }
    },
    [setTemplates]
  );

  useEffect(() => {
    if (templates.length > 0) {
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [templates.length, load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { templates, status, error, retry };
}
