import * as React from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Search from "./Search";
import TemplateGrid from "./TemplateGrid";
import TemplateDialog from "./TemplateDialog";
import NotFoundPage from "./NotFoundPage";
import { useTemplates } from "@/hooks/use-templates";
import {
  allTags,
  fetchTemplateFiles,
  filterTemplates,
  type TemplateFiles,
} from "@/lib/templates";
import { useStore } from "@/store";

type FilesStatus = "idle" | "loading" | "ready" | "error";

const Gallery = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
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

  const requestedId = id ?? null;
  const selectedTemplate = React.useMemo(
    () =>
      requestedId
        ? (templates.find((template) => template.id === requestedId) ?? null)
        : null,
    [requestedId, templates]
  );

  // The app is a SPA: keep the document title and canonical URL in sync with
  // the selected template so direct links read correctly and are self-canonical.
  React.useEffect(() => {
    if (!selectedTemplate) return;

    const previousTitle = document.title;
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    const previousCanonical = canonical?.getAttribute("href") ?? null;

    document.title = `${selectedTemplate.name} — Notploy Templates`;
    canonical?.setAttribute(
      "href",
      `https://templates.notploy.com/templates/${encodeURIComponent(selectedTemplate.id)}`
    );

    return () => {
      document.title = previousTitle;
      if (canonical && previousCanonical) {
        canonical.setAttribute("href", previousCanonical);
      }
    };
  }, [selectedTemplate]);

  const [templateFiles, setTemplateFiles] = React.useState<TemplateFiles | null>(
    null
  );
  const [filesStatus, setFilesStatus] = React.useState<FilesStatus>("idle");
  const [filesError, setFilesError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);

  const loadFiles = React.useCallback(async (templateId: string) => {
    const requestId = ++requestRef.current;
    setTemplateFiles(null);
    setFilesStatus("loading");
    setFilesError(null);

    try {
      const files = await fetchTemplateFiles(templateId);
      if (requestRef.current !== requestId) return;
      setTemplateFiles(files);
      setFilesStatus("ready");
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      setFilesError(
        caught instanceof Error
          ? caught.message
          : "The template files could not be loaded"
      );
      setFilesStatus("error");
    }
  }, []);

  React.useEffect(() => {
    if (!requestedId) {
      requestRef.current += 1;
      setTemplateFiles(null);
      setFilesStatus("idle");
      setFilesError(null);
      return;
    }

    void loadFiles(requestedId);
    return () => {
      requestRef.current += 1;
    };
  }, [requestedId, loadFiles]);

  const retryFiles = () => {
    if (requestedId) void loadFiles(requestedId);
  };

  const hasFilters = searchQuery.trim().length > 0 || selectedTags.length > 0;

  const handleClearFilters = () => {
    clearFilters();
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("q");
        return next;
      },
      { replace: true }
    );
  };

  const handleCloseDialog = () => {
    if (location.key === "default") {
      navigate(
        { pathname: "/", search: location.search },
        { replace: true }
      );
      return;
    }
    navigate(-1);
  };

  if (status === "ready" && requestedId && !selectedTemplate) {
    return (
      <NotFoundPage
        title="Template not found"
        description={`No template matches "${requestedId}". It may have been renamed or removed from the catalogue.`}
      />
    );
  }

  return (
    <>
      <h1 className="sr-only">Notploy Templates, open source deployment blueprints</h1>
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
      <TemplateDialog
        selectedTemplate={selectedTemplate}
        templateFiles={templateFiles}
        modalLoading={filesStatus === "loading"}
        modalError={filesStatus === "error" ? filesError : null}
        onRetry={retryFiles}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      />
    </>
  );
};

export default Gallery;
