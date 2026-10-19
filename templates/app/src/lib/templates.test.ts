import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchTemplateFiles,
  filterTemplates,
  normalizeTemplates,
  templateLogoUrl,
  templateToBase64,
  type Template,
} from "./templates.ts";

const validEntry = {
  id: "wordpress",
  name: "WordPress",
  version: "latest",
  description: "A content management system.",
  logo: "wordpress.png",
  links: {
    github: "https://github.com/WordPress/WordPress",
    website: "https://wordpress.org/",
    docs: "https://wordpress.org/documentation/",
  },
  tags: ["cms", "cms", "blog"],
};

test("normalizeTemplates keeps valid entries and normalizes them", () => {
  const templates = normalizeTemplates([validEntry]);

  assert.equal(templates.length, 1);
  assert.equal(templates[0].id, "wordpress");
  assert.equal(templates[0].version, "latest");
  assert.deepEqual(templates[0].tags, ["blog", "cms"]);
  assert.equal(templates[0].links.website, "https://wordpress.org/");
});

test("normalizeTemplates drops invalid and duplicate entries", () => {
  const templates = normalizeTemplates([
    validEntry,
    { ...validEntry, name: "Duplicate id" },
    { id: "no-name", description: "Missing name" },
    { id: "no-description", name: "Missing description" },
    null,
    "not an object",
  ]);

  assert.deepEqual(
    templates.map((template) => template.id),
    ["wordpress"]
  );
});

test("normalizeTemplates sorts templates by display name", () => {
  const templates = normalizeTemplates([
    { ...validEntry, id: "zeta", name: "Zeta" },
    { ...validEntry, id: "alpha", name: "Alpha" },
  ]);

  assert.deepEqual(
    templates.map((template) => template.name),
    ["Alpha", "Zeta"]
  );
});

test("normalizeTemplates rejects an empty catalogue", () => {
  assert.throws(() => normalizeTemplates([]), /empty/);
  assert.throws(() => normalizeTemplates({}), /JSON array/);
});

test("filterTemplates matches name and description and combines tags with AND", () => {
  const templates = normalizeTemplates([
    validEntry,
    {
      ...validEntry,
      id: "grafana",
      name: "Grafana",
      description: "Dashboards and observability.",
      tags: ["monitoring", "dashboard"],
    },
  ]);

  assert.deepEqual(
    filterTemplates(templates, "dash", []).map((template) => template.id),
    ["grafana"]
  );
  assert.deepEqual(
    filterTemplates(templates, "CONTENT", []).map((template) => template.id),
    ["wordpress"]
  );
  assert.deepEqual(
    filterTemplates(templates, "", ["cms", "blog"]).map(
      (template) => template.id
    ),
    ["wordpress"]
  );
  assert.deepEqual(filterTemplates(templates, "", ["cms", "monitoring"]), []);
});

test("templateLogoUrl encodes ids and file names", () => {
  const template: Template = {
    id: "my app",
    name: "My App",
    version: "",
    description: "Test",
    logo: "logo file.png",
    links: {},
    tags: [],
  };

  assert.equal(
    templateLogoUrl(template),
    "/blueprints/my%20app/logo%20file.png"
  );
  assert.equal(templateLogoUrl({ ...template, logo: undefined }), null);
});

test("fetchTemplateFiles ignores SPA HTML fallbacks for missing files", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("docker-compose.yml")) {
      return new Response("services: {}\n", {
        status: 200,
        headers: { "content-type": "text/yaml" },
      });
    }
    if (url.endsWith("template.toml")) {
      return new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;

  try {
    const files = await fetchTemplateFiles("wordpress");
    assert.deepEqual(files, {
      dockerCompose: "services: {}",
      config: null,
      instructions: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("templateToBase64 encodes the compose/config payload", () => {
  const encoded = templateToBase64({
    dockerCompose: "services: {}\n",
    config: "[config]\n",
    instructions: "# Ignored\n",
  });

  assert.deepEqual(JSON.parse(atob(encoded)), {
    compose: "services: {}\n",
    config: "[config]\n",
  });
});
