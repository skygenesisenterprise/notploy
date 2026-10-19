import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Github,
  Globe,
  Loader2,
  Pencil,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CodeEditor } from "./ui/code-editor";
import Markdown from "./ui/markdown";
import { Container } from "./Container";
import { TemplateLogo } from "./TemplateLogo";
import { TemplateCard } from "./TemplateCard";
import { CopyButton, TrafficLights } from "./CodePanel";
import NotFoundPage from "./NotFoundPage";
import { useTemplates } from "@/hooks/use-templates";
import {
  fetchTemplateFiles,
  getRelatedTemplates,
  templateToBase64,
  type TemplateFiles,
} from "@/lib/templates";
import { Skeleton } from "./ui/skeleton";

type FilesStatus = "idle" | "loading" | "ready" | "error";

const tabTriggerClasses =
  "rounded-md px-2.5 py-1 font-mono text-xs text-muted-foreground data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground data-[state=active]:shadow-none";

function SectionHeading({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string;
  title: string;
  id: string;
}) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
    </>
  );
}

function PageSkeleton() {
  return (
    <Container className="py-14">
      <Skeleton className="h-4 w-36" />
      <div className="mt-8 flex flex-col gap-6 sm:flex-row">
        <Skeleton className="size-20 shrink-0 rounded-xl" />
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </Container>
  );
}

const TemplatePage = () => {
  const { id } = useParams<{ id: string }>();
  const { templates, status, error, retry } = useTemplates();

  const template = React.useMemo(
    () => (id ? templates.find((entry) => entry.id === id) : undefined),
    [id, templates]
  );

  const [files, setFiles] = React.useState<TemplateFiles | null>(null);
  const [filesStatus, setFilesStatus] = React.useState<FilesStatus>("idle");
  const [filesError, setFilesError] = React.useState<string | null>(null);
  const [requestKey, setRequestKey] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState("compose");

  React.useEffect(() => {
    if (!template) {
      setFiles(null);
      setFilesStatus("idle");
      setFilesError(null);
      return;
    }

    let cancelled = false;
    const attempt = requestKey;
    setFiles(null);
    setFilesStatus("loading");
    setFilesError(null);

    fetchTemplateFiles(template.id)
      .then((loaded) => {
        if (cancelled || attempt !== requestKey) return;
        setFiles(loaded);
        setFilesStatus("ready");
      })
      .catch((caught: unknown) => {
        if (cancelled || attempt !== requestKey) return;
        setFilesError(
          caught instanceof Error
            ? caught.message
            : "The template files could not be loaded"
        );
        setFilesStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [template, requestKey]);

  // Keep the document title and canonical URL in sync with the current
  // blueprint so direct links stay self-canonical and shareable.
  React.useEffect(() => {
    if (!template) return;

    const previousTitle = document.title;
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    const previousCanonical = canonical?.getAttribute("href") ?? null;

    document.title = `${template.name} — Notploy Templates`;
    canonical?.setAttribute(
      "href",
      `https://templates.notploy.com/templates/${encodeURIComponent(template.id)}`
    );

    return () => {
      document.title = previousTitle;
      if (canonical && previousCanonical) {
        canonical.setAttribute("href", previousCanonical);
      }
    };
  }, [template]);

  const base64 = React.useMemo(() => {
    if (!files?.dockerCompose && !files?.config) return "";
    return templateToBase64(files);
  }, [files]);

  const relatedTemplates = React.useMemo(
    () => (template ? getRelatedTemplates(template, templates, 3) : []),
    [template, templates]
  );

  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (status === "error" && templates.length === 0) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-xl rounded-xl border border-border/50 bg-card p-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Catalogue unavailable
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Templates could not be loaded
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {error ??
              "An unexpected error occurred while loading the catalogue."}
          </p>
          <Button className="mt-6" onClick={retry}>
            Try again
          </Button>
        </div>
      </Container>
    );
  }

  if (!template) {
    return (
      <NotFoundPage
        title="Template not found"
        description={`No template matches "${id}". It may have been renamed or removed from the catalogue.`}
      />
    );
  }

  const hasFiles = Boolean(
    files?.dockerCompose || files?.config || files?.instructions
  );
  const compose = files?.dockerCompose ?? "# Not available";
  const toml = files?.config ?? "# Not available";
  const activeCode = activeTab === "compose" ? compose : toml;

  return (
    <>
      <Container className="py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to templates
        </Link>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card p-2 shadow-sm sm:size-20">
              <TemplateLogo template={template} className="h-full w-full" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  {template.name}
                </h1>
                <Badge variant="secondary">
                  v{template.version || "latest"}
                </Badge>
              </div>

              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {template.description}
              </p>

              {template.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={{
                        pathname: "/",
                        search: `?tags=${encodeURIComponent(tag)}`,
                      }}
                      className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                {template.links.website && (
                  <a
                    href={template.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Globe aria-hidden="true" className="size-4" />
                    Website
                  </a>
                )}
                {template.links.github && (
                  <a
                    href={template.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Github aria-hidden="true" className="size-4" />
                    GitHub
                  </a>
                )}
                {template.links.docs && (
                  <a
                    href={template.links.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <BookOpen aria-hidden="true" className="size-4" />
                    Documentation
                  </a>
                )}
                <a
                  href={`https://github.com/skygenesisenterprise/notploy/tree/master/templates/blueprints/${encodeURIComponent(template.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                  Edit blueprint
                </a>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg">
              <a href="#deploy">
                Deploy on Notploy
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a
                href="https://docs.notploy.com/docs/core/installation"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen aria-hidden="true" />
                Installation guide
              </a>
            </Button>
          </div>
        </div>
      </Container>

      <section
        id="deploy"
        aria-labelledby="deploy-title"
        className="scroll-mt-24 border-t border-border/50"
      >
        <Container className="py-12 sm:py-16">
          <SectionHeading
            eyebrow="How to deploy"
            title={`Deploy ${template.name} on Notploy`}
            id="deploy-title"
          />

          <ol className="mt-6 max-w-3xl space-y-4">
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-display text-sm font-semibold text-primary">
                1
              </span>
              <p className="pt-1 text-muted-foreground">
                <a
                  href="https://docs.notploy.com/docs/core/installation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Install Notploy
                </a>{" "}
                on your server if you haven&apos;t already.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-display text-sm font-semibold text-primary">
                2
              </span>
              <p className="pt-1 text-muted-foreground">
                In your Notploy panel, open a project and click{" "}
                <strong className="font-semibold text-foreground">
                  Create Service → Template
                </strong>
                .
              </p>
            </li>
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-display text-sm font-semibold text-primary">
                3
              </span>
              <p className="pt-1 text-muted-foreground">
                Search for{" "}
                <strong className="font-semibold text-foreground">
                  {template.name}
                </strong>{" "}
                and click{" "}
                <strong className="font-semibold text-foreground">Create</strong>{" "}
                — Notploy configures domains, environment variables and volumes
                for you.
              </p>
            </li>
          </ol>

          {base64 && (
            <>
              <p className="mt-8 max-w-3xl text-muted-foreground">
                Alternatively, create a{" "}
                <strong className="font-semibold text-foreground">
                  Compose
                </strong>{" "}
                service, go to{" "}
                <strong className="font-semibold text-foreground">
                  Advanced → Import from Base64
                </strong>
                , and paste this payload:
              </p>
              <div className="mt-4 max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center gap-3 border-b border-border bg-foreground/[0.03] px-4 py-2">
                  <TrafficLights />
                  <span className="font-mono text-xs text-muted-foreground">
                    base64
                  </span>
                  <div className="ml-auto">
                    <CopyButton
                      text={base64}
                      label="Copy base64 configuration"
                    />
                  </div>
                </div>
                <pre className="max-h-40 overflow-auto break-all whitespace-pre-wrap p-4 font-mono text-xs text-muted-foreground">
                  {base64}
                </pre>
              </div>
            </>
          )}
        </Container>
      </section>

      <section
        aria-labelledby="configuration-title"
        className="border-t border-border/50"
      >
        <Container className="py-12 sm:py-16">
          <SectionHeading
            eyebrow="Reference files"
            title="Configuration"
            id="configuration-title"
          />
          <p className="mt-4 max-w-3xl text-lg tracking-tight text-muted-foreground">
            The exact Docker Compose and template configuration this blueprint
            deploys.
          </p>

          {filesStatus === "loading" && (
            <div
              className="mt-6 flex items-center justify-center rounded-xl border border-border/50 bg-card py-16"
              role="status"
            >
              <Loader2
                aria-hidden="true"
                className="size-6 animate-spin text-muted-foreground"
              />
              <span className="ml-3 text-sm text-muted-foreground">
                Loading template files...
              </span>
            </div>
          )}

          {filesStatus === "error" && (
            <div
              className="mt-6 rounded-xl border border-border/50 bg-card p-8 text-center"
              role="alert"
            >
              <p className="text-sm text-destructive">{filesError}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setRequestKey((key) => key + 1)}
              >
                Try again
              </Button>
            </div>
          )}

          {filesStatus === "ready" && hasFiles && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-6"
            >
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-foreground/[0.03] px-4 py-2">
                  <TrafficLights />
                  <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
                    <TabsTrigger value="compose" className={tabTriggerClasses}>
                      docker-compose.yml
                    </TabsTrigger>
                    <TabsTrigger value="toml" className={tabTriggerClasses}>
                      template.toml
                    </TabsTrigger>
                  </TabsList>
                  <div className="ml-auto">
                    <CopyButton text={activeCode} />
                  </div>
                </div>
                <TabsContent value="compose" className="mt-0">
                  <CodeEditor
                    className="code-editor"
                    value={compose}
                    language="yaml"
                    height="24rem"
                    readOnly
                    lineWrapping
                  />
                </TabsContent>
                <TabsContent value="toml" className="mt-0">
                  <CodeEditor
                    className="code-editor"
                    value={toml}
                    language="toml"
                    height="24rem"
                    readOnly
                    lineWrapping
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}

          {filesStatus === "ready" && !hasFiles && (
            <p className="mt-6 rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
              No configuration files are available for this template.
            </p>
          )}
        </Container>
      </section>

      {files?.instructions && (
        <section
          aria-labelledby="instructions-title"
          className="border-t border-border/50"
        >
          <Container className="py-12 sm:py-16">
            <SectionHeading
              eyebrow="Usage guide"
              title="Instructions"
              id="instructions-title"
            />
            <div className="mt-6 rounded-xl border border-border/50 bg-card p-6">
              <Markdown content={files.instructions} />
            </div>
          </Container>
        </section>
      )}

      {relatedTemplates.length > 0 && (
        <section
          aria-labelledby="related-templates-title"
          className="border-t border-border/50"
        >
          <Container className="py-12 sm:py-16">
            <SectionHeading
              eyebrow="More like this"
              title="Related templates"
              id="related-templates-title"
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedTemplates.map((related) => (
                <TemplateCard key={related.id} template={related} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="self-host-title" className="border-t border-border/50">
        <Container className="py-12 sm:py-16">
          <div className="rounded-xl border border-border/50 bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Free and open source
            </p>
            <h2
              id="self-host-title"
              className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Self-host {template.name} in minutes
            </h2>
            <p className="mt-4 max-w-3xl text-lg tracking-tight text-muted-foreground">
              Notploy is a free, open source deployment platform. Deploy{" "}
              {template.name} and {Math.max(templates.length - 1, 0)} other
              templates on your own infrastructure with a single click.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <a
                  href="https://docs.notploy.com/docs/core/installation"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get started
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Browse all templates</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
};

export default TemplatePage;
