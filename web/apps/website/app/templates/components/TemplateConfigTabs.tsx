"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
	EditorCopyButton,
	TemplateCodeBlock,
	TrafficLights,
} from "./TemplateCodeBlock";

interface TemplateConfigTabsProps {
	dockerCompose: string | null;
	templateToml: string | null;
}

const tabTriggerClasses =
	"rounded-md px-2.5 py-1 font-mono text-xs text-muted-foreground data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground data-[state=active]:shadow-none";

export function TemplateConfigTabs({
	dockerCompose,
	templateToml,
}: TemplateConfigTabsProps) {
	const [activeTab, setActiveTab] = useState("compose");

	const compose = dockerCompose ?? "# Not available";
	const toml = templateToml ?? "# Not available";
	const activeCode = activeTab === "compose" ? compose : toml;

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
				<div className="flex items-center gap-3 border-b border-border bg-foreground/[0.03] px-4 py-2">
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
						<EditorCopyButton text={activeCode} />
					</div>
				</div>
				<TabsContent value="compose" className="mt-0">
					<TemplateCodeBlock bare lang="yaml" code={compose} />
				</TabsContent>
				<TabsContent value="toml" className="mt-0">
					<TemplateCodeBlock bare lang="toml" code={toml} />
				</TabsContent>
			</div>
		</Tabs>
	);
}
