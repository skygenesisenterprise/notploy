import { Boxes, Cloud, Layers, Sparkles, Workflow, Zap } from "lucide-react";
import { aiBrandIcons } from "@/lib/ai-provider-brand-icons";

interface Props {
	className?: string;
}

const BrandIcon = ({
	data,
	className,
	monochrome = false,
}: {
	data: { hex: string; path: string };
	className?: string;
	monochrome?: boolean;
}) => (
	<svg
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		fill={monochrome ? "currentColor" : `#${data.hex}`}
		aria-hidden="true"
	>
		<path d={data.path} />
	</svg>
);

const OpenAiIcon = ({ className }: Props) => (
	<Sparkles className={className} aria-hidden="true" />
);

const AnthropicIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.anthropic} className={className} monochrome />
);

const GeminiIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.gemini} className={className} />
);

const MistralIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.mistral} className={className} />
);

const CohereIcon = ({ className }: Props) => (
	<Layers className={className} aria-hidden="true" />
);

const PerplexityIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.perplexity} className={className} />
);

const DeepInfraIcon = ({ className }: Props) => (
	<Boxes className={className} aria-hidden="true" />
);

const OpenRouterIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.openrouter} className={className} monochrome />
);

const ZaiIcon = ({ className }: Props) => (
	<Zap className={className} aria-hidden="true" />
);

const MiniMaxIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.minimax} className={className} />
);

const OllamaIcon = ({ className }: Props) => (
	<BrandIcon data={aiBrandIcons.ollama} className={className} monochrome />
);

const AzureIcon = ({ className }: Props) => (
	<Cloud className={className} aria-hidden="true" />
);

const CustomAiIcon = ({ className }: Props) => (
	<Workflow className={className} aria-hidden="true" />
);

export const aiProviderIcons = {
	openai: OpenAiIcon,
	anthropic: AnthropicIcon,
	gemini: GeminiIcon,
	mistral: MistralIcon,
	cohere: CohereIcon,
	perplexity: PerplexityIcon,
	deepinfra: DeepInfraIcon,
	openrouter: OpenRouterIcon,
	zai: ZaiIcon,
	minimax: MiniMaxIcon,
	ollama: OllamaIcon,
	azure: AzureIcon,
	custom: CustomAiIcon,
} as const;

export type AiProviderIconKey = keyof typeof aiProviderIcons;

export const aiProviderIconKey = (providerId: string): AiProviderIconKey =>
	(providerId in aiProviderIcons ? providerId : "custom") as AiProviderIconKey;
