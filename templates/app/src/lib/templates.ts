export interface TemplateLinks {
  github?: string;
  website?: string;
  docs?: string;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  description: string;
  logo?: string;
  links: TemplateLinks;
  tags: string[];
}

export interface TemplateFiles {
  dockerCompose: string | null;
  config: string | null;
  instructions: string | null;
}

const BLUEPRINTS_PATH = "/blueprints";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLinks(value: unknown): TemplateLinks {
  if (!isRecord(value)) return {};
  const links: TemplateLinks = {};
  for (const key of ["github", "website", "docs"] as const) {
    const url = asString(value[key]);
    if (url) links[key] = url;
  }
  return links;
}

/**
 * Turns the generated `/meta.json` payload into the shape the UI renders.
 * Invalid or duplicate entries are dropped (and reported) instead of crashing
 * the catalogue, so one broken blueprint cannot take the whole gallery down.
 */
export function normalizeTemplates(payload: unknown): Template[] {
  if (!Array.isArray(payload)) {
    throw new Error("The templates catalogue is not a JSON array");
  }

  const seen = new Set<string>();
  const templates: Template[] = [];

  for (const entry of payload) {
    if (!isRecord(entry)) {
      console.warn("[templates] Ignoring catalogue entry that is not an object");
      continue;
    }

    const id = asString(entry.id);
    const name = asString(entry.name);
    const description = asString(entry.description);

    if (!id || !name || !description) {
      console.warn(
        `[templates] Ignoring incomplete catalogue entry: ${JSON.stringify(entry).slice(0, 120)}`
      );
      continue;
    }

    if (seen.has(id)) {
      console.warn(`[templates] Ignoring duplicate catalogue entry: ${id}`);
      continue;
    }
    seen.add(id);

    const tags = Array.isArray(entry.tags)
      ? [...new Set(entry.tags.map(asString).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        )
      : [];

    templates.push({
      id,
      name,
      description,
      version: asString(entry.version),
      logo: asString(entry.logo) || undefined,
      links: normalizeLinks(entry.links),
      tags,
    });
  }

  templates.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );

  if (templates.length === 0) {
    throw new Error("The templates catalogue is empty");
  }

  return templates;
}

export function filterTemplates(
  templates: Template[],
  query: string,
  selectedTags: string[]
): Template[] {
  const searchTerm = query.trim().toLowerCase();

  return templates.filter((template) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      template.name.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm);

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => template.tags.includes(tag));

    return matchesSearch && matchesTags;
  });
}

export function allTags(templates: Template[]): string[] {
  return [...new Set(templates.flatMap((template) => template.tags))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function blueprintAsset(id: string, fileName: string): string {
  return `${BLUEPRINTS_PATH}/${encodeURIComponent(id)}/${encodeURIComponent(fileName)}`;
}

export function templateLogoUrl(template: Template): string | null {
  if (!template.logo) return null;
  return blueprintAsset(template.id, template.logo);
}

async function fetchBlueprintFile(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // Cloudflare Pages serves the SPA entry point for unknown paths. Treat an
  // HTML response as "this file does not exist" instead of rendering the page.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return null;

  const text = await response.text();
  return text.trim() || null;
}

export async function fetchTemplateFiles(id: string): Promise<TemplateFiles> {
  const [dockerCompose, config, instructions] = await Promise.all([
    fetchBlueprintFile(blueprintAsset(id, "docker-compose.yml")),
    fetchBlueprintFile(blueprintAsset(id, "template.toml")),
    fetchBlueprintFile(blueprintAsset(id, "instructions.md")),
  ]);

  return { dockerCompose, config, instructions };
}

export function templateToBase64(files: TemplateFiles): string {
  const jsonString = JSON.stringify(
    {
      compose: files.dockerCompose ?? "",
      config: files.config ?? "",
    },
    null,
    2
  );

  const bytes = new TextEncoder().encode(jsonString);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
