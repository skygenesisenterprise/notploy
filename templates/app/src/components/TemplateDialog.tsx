import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import copy from "copy-to-clipboard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CodeEditor } from "./ui/code-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Label } from "./ui/label";
import { Clipboard } from "lucide-react";
import { Input } from "./ui/input";
import Markdown from "./ui/markdown";
import { TemplateLogo } from "./TemplateLogo";
import {
  templateToBase64,
  type Template,
  type TemplateFiles,
} from "@/lib/templates";

interface TemplateDialogProps {
  selectedTemplate: Template | null;
  templateFiles: TemplateFiles | null;
  modalLoading: boolean;
  modalError: string | null;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({
  selectedTemplate,
  templateFiles,
  modalLoading,
  modalError,
  onRetry,
  onOpenChange,
}) => {
  const base64 = React.useMemo(() => {
    if (!templateFiles?.dockerCompose && !templateFiles?.config) return "";
    return templateToBase64(templateFiles);
  }, [templateFiles]);

  const hasFiles = Boolean(
    templateFiles?.dockerCompose ||
      templateFiles?.config ||
      templateFiles?.instructions
  );

  const copyValue = (value: string) => {
    copy(value);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={!!selectedTemplate} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col !max-w-[90vw] rounded-lg p-0 lg:max-w-[90vw]">
        <DialogHeader className="sticky top-0 z-10 space-y-4 rounded-t-lg border-b bg-background p-4 pb-4 text-start">
          <div className="flex items-center gap-4">
            {selectedTemplate && (
              <TemplateLogo
                template={selectedTemplate}
                className="h-12 w-12 shrink-0"
              />
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate text-2xl">
                {selectedTemplate?.name}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm text-muted-foreground">
                  {selectedTemplate?.version || "latest"}
                </span>
                <nav
                  aria-label="Template links"
                  className="flex flex-wrap gap-3 text-sm"
                >
                  {selectedTemplate?.links.website && (
                    <a
                      href={selectedTemplate.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Website
                    </a>
                  )}
                  {selectedTemplate?.links.github && (
                    <a
                      href={selectedTemplate.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      GitHub
                    </a>
                  )}
                  {selectedTemplate?.links.docs && (
                    <a
                      href={selectedTemplate.links.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Docs
                    </a>
                  )}
                  {selectedTemplate && (
                    <a
                      href={`https://github.com/skygenesisenterprise/notploy/tree/master/templates/blueprints/${encodeURIComponent(selectedTemplate.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Edit template
                    </a>
                  )}
                </nav>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6 pt-3">
            <div className="space-y-2">
              <DialogDescription className="text-base">
                {selectedTemplate?.description}
              </DialogDescription>
              {selectedTemplate && selectedTemplate.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {modalLoading ? (
              <div className="py-12 text-center" role="status">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Loading template files...
                </p>
              </div>
            ) : modalError ? (
              <div className="py-8 text-center" role="alert">
                <p className="text-sm text-destructive">{modalError}</p>
                <Button variant="outline" className="mt-4" onClick={onRetry}>
                  Try again
                </Button>
              </div>
            ) : hasFiles ? (
              <div className="space-y-6">
                {base64 && (
                  <div className="flex flex-col gap-3">
                    <Label className="flex w-fit flex-col items-start justify-start gap-1">
                      <span className="text-xl leading-tight font-semibold">
                        Base64 Configuration
                      </span>
                      <span className="text-sm leading-tight text-muted-foreground">
                        Encoded compose file and template.toml
                      </span>
                    </Label>
                    <div className="relative w-full">
                      <Button
                        className="absolute end-0 top-1/2 -translate-y-1/2"
                        size="icon"
                        aria-label="Copy base64 configuration"
                        onClick={() => copyValue(base64)}
                      >
                        <Clipboard aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Input
                        value={base64}
                        className="w-full pr-10"
                        readOnly
                        aria-label="Base64 configuration"
                      />
                    </div>
                  </div>
                )}

                <Tabs
                  defaultValue={
                    templateFiles?.instructions ? "instructions" : "docker-compose"
                  }
                  className="w-full"
                >
                  <TabsList className="w-full justify-start">
                    {templateFiles?.instructions && (
                      <TabsTrigger
                        value="instructions"
                        className="data-[state=active]:font-bold"
                      >
                        Instructions
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="docker-compose"
                      className="data-[state=active]:font-bold"
                    >
                      Docker Compose
                    </TabsTrigger>
                    <TabsTrigger
                      value="config"
                      className="data-[state=active]:font-bold"
                    >
                      Configuration
                    </TabsTrigger>
                  </TabsList>

                  {templateFiles?.instructions && (
                    <TabsContent value="instructions" className="mt-4">
                      <div className="space-y-2">
                        <Label className="flex w-fit flex-col items-start justify-start gap-1">
                          <span className="text-xl leading-tight font-semibold">
                            Setup Instructions
                          </span>
                          <span className="text-sm leading-tight text-muted-foreground">
                            instructions.md
                          </span>
                        </Label>
                        <div className="rounded-md border p-4">
                          <Markdown content={templateFiles.instructions} />
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="docker-compose" className="mt-4">
                    {templateFiles?.dockerCompose ? (
                      <div className="space-y-2">
                        <Label className="flex w-fit flex-col items-start justify-start gap-1">
                          <span className="text-xl leading-tight font-semibold">
                            Docker Compose
                          </span>
                          <span className="text-sm leading-tight text-muted-foreground">
                            docker-compose.yml
                          </span>
                        </Label>
                        <div className="relative w-full overflow-hidden rounded-md border">
                          <CodeEditor
                            value={templateFiles.dockerCompose}
                            language="yaml"
                            className="w-full font-mono [&_*]:!break-words"
                          />
                          <Button
                            onClick={() =>
                              copyValue(templateFiles.dockerCompose ?? "")
                            }
                            className="absolute top-2 right-2 px-3 py-1 text-sm"
                            variant="secondary"
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        This template does not publish a docker-compose.yml file.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="config" className="mt-4">
                    {templateFiles?.config ? (
                      <div className="space-y-2">
                        <Label className="flex w-fit flex-col items-start justify-start gap-1">
                          <span className="text-xl leading-tight font-semibold">
                            Configuration
                          </span>
                          <span className="text-sm leading-tight text-muted-foreground">
                            template.toml
                          </span>
                        </Label>
                        <div className="relative w-full overflow-hidden rounded-md border">
                          <CodeEditor
                            value={templateFiles.config}
                            language="toml"
                            className="w-full font-mono [&_*]:!break-words"
                          />
                          <Button
                            onClick={() => copyValue(templateFiles.config ?? "")}
                            className="absolute top-2 right-2 px-3 py-1 text-sm"
                            variant="secondary"
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        This template does not publish a template.toml file.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No configuration files are available for this template.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateDialog;
