import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AdminComponentDto } from "@/lib/status";

/**
 * Checkbox list of the components of a status page. Attaching components is
 * what links an incident (or a maintenance) to the services it affects on
 * the public page.
 */
export const ComponentPicker = ({
	components,
	selected,
	onChange,
}: {
	components: AdminComponentDto[];
	selected: string[];
	onChange: (componentIds: string[]) => void;
}) => {
	if (components.length === 0) {
		return null;
	}
	return (
		<div className="space-y-2">
			<Label>Affected components</Label>
			<div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
				{components.map((component) => {
					const checked = selected.includes(component.id);
					return (
						<div key={component.id} className="flex items-center gap-2">
							<Checkbox
								id={`component-${component.id}`}
								checked={checked}
								onCheckedChange={(value) => {
									onChange(
										value
											? [...selected, component.id]
											: selected.filter((id) => id !== component.id),
									);
								}}
							/>
							<Label
								htmlFor={`component-${component.id}`}
								className="flex flex-col gap-0.5 font-normal"
							>
								<span>{component.name}</span>
								{component.description ? (
									<span className="text-xs text-muted-foreground">
										{component.description}
									</span>
								) : null}
							</Label>
						</div>
					);
				})}
			</div>
		</div>
	);
};
