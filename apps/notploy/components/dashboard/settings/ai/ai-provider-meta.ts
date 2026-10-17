import {
	AI_CAPABILITY_META,
	AI_CAPABILITY_ORDER,
	AI_PROVIDER_CATEGORY_LABELS,
	AI_PROVIDER_PRESETS,
	type AiCapabilities,
	type AiCapabilityKey,
	type AiProviderCategory,
	getAiProviderLabel,
	getAiProviderPreset,
	getCapabilityWarnings,
	getModelCapabilities,
	resolveAiProviderId,
} from "@notploy/server/utils/ai/contracts";
import {
	aiProviderIconKey,
	aiProviderIcons,
} from "@/components/icons/ai-provider-icons";

export {
	AI_CAPABILITY_META,
	AI_CAPABILITY_ORDER,
	AI_PROVIDER_CATEGORY_LABELS,
	AI_PROVIDER_PRESETS,
	type AiCapabilities,
	type AiCapabilityKey,
	type AiProviderCategory,
	aiProviderIconKey,
	aiProviderIcons,
	getAiProviderLabel,
	getAiProviderPreset,
	getCapabilityWarnings,
	getModelCapabilities,
	resolveAiProviderId,
};

export const aiTestStatusLabels = {
	success: "Connected",
	error: "Failed",
	none: "Not tested",
} as const;

export const aiTestStatusStyles: Record<string, string> = {
	success:
		"border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	error: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
	none: "border-border bg-muted/40 text-muted-foreground",
};

export const formatAiTestDate = (value: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
};

export const aiProviderCategory = (providerId: string): AiProviderCategory =>
	getAiProviderPreset(providerId)?.category ?? "custom";
