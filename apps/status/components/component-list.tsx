import type { PublicComponentDto } from "@notploy/status";
import { LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	categoryLabel,
	componentStatusLabel,
	componentStatusTone,
} from "@/lib/view-model";
import { EmptyState } from "./empty-state";
import { dotClass, toneTextClass } from "./status-badge";
import { UptimeBar } from "./uptime-bar";

interface ComponentGroup {
	key: string;
	label: string;
	components: PublicComponentDto[];
}

/** Group components by explicit `groupName`, falling back to their category. */
const groupComponents = (
	components: PublicComponentDto[],
): ComponentGroup[] => {
	const groups = new Map<string, ComponentGroup>();
	for (const component of components) {
		const key = component.groupName ?? component.category;
		const group = groups.get(key) ?? {
			key,
			label: component.groupName ?? categoryLabel(component.category),
			components: [],
		};
		group.components.push(component);
		groups.set(key, group);
	}
	return [...groups.values()];
};

const ComponentRow = ({ component }: { component: PublicComponentDto }) => {
	const tone = componentStatusTone(component.status);
	return (
		<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex items-center gap-2">
					<span
						className={cn("status-dot", dotClass(tone))}
						aria-hidden="true"
					/>
					<span className="truncate font-medium">{component.name}</span>
				</div>
				{component.description ? (
					<p className="text-sm text-muted-foreground">
						{component.description}
					</p>
				) : null}
				<p className="text-xs">
					<span className={cn("font-semibold", toneTextClass(tone))}>
						{componentStatusLabel(component.status)}
					</span>
					{component.stale ? (
						<span className="text-muted-foreground"> · no recent data</span>
					) : null}
				</p>
			</div>
			<div className="sm:w-2/5 sm:min-w-60">
				<UptimeBar uptime={component.uptime} />
			</div>
		</div>
	);
};

export const ComponentList = ({
	components,
}: {
	components: PublicComponentDto[];
}) => {
	if (components.length === 0) {
		return (
			<EmptyState
				icon={LayoutList}
				message="No component is published on this status page yet."
			/>
		);
	}
	return (
		<div className="flex flex-col gap-8">
			{groupComponents(components).map((group) => (
				<section key={group.key} className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{group.label}
					</h2>
					<div className="status-card divide-y divide-border">
						{group.components.map((component) => (
							<ComponentRow key={component.id} component={component} />
						))}
					</div>
				</section>
			))}
		</div>
	);
};
