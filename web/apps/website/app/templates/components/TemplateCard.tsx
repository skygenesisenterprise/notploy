import { type Template, getTemplateLogoUrl } from "@/lib/templates";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface TemplateCardProps {
	template: Template;
}

export function TemplateCard({ template }: TemplateCardProps) {
	return (
		<Link
			href={`/templates/${template.id}`}
			className="group flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-6 transition-colors hover:border-primary/40"
		>
			<div className="flex items-center gap-3">
				<img
					src={getTemplateLogoUrl(template)}
					alt={`${template.name} logo`}
					width={40}
					height={40}
					loading="lazy"
					decoding="async"
					className="h-10 w-10 shrink-0 rounded-md object-contain"
				/>
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-lg font-semibold text-foreground group-hover:text-primary">
						{template.name}
					</h3>
					<p className="text-sm text-muted-foreground">
						Version {template.version}
					</p>
				</div>
				<ArrowUpRight
					className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
					aria-hidden="true"
				/>
			</div>
			<p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
				{template.description}
			</p>
			{template.tags.length > 0 && (
				<div className="mt-auto flex flex-wrap gap-1.5">
					{template.tags.slice(0, 3).map((tag) => (
						<span
							key={tag}
							className="rounded-full bg-secondary px-2.5 py-1 text-sm text-muted-foreground"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</Link>
	);
}
