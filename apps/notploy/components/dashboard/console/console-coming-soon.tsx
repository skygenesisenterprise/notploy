import type { LucideIcon } from "lucide-react";
import {
	ConsoleBody,
	ConsoleEmpty,
	ConsoleHeader,
	ConsoleShell,
} from "@/components/shared/console-shell";

interface ConsoleComingSoonProps {
	icon: LucideIcon;
	title: string;
	description: string;
}

/**
 * Placeholder for the reserved console destinations. Keeps every navigation
 * entry reachable while the real console page is being built.
 */
export const ConsoleComingSoon = ({
	icon,
	title,
	description,
}: ConsoleComingSoonProps) => (
	<ConsoleShell>
		<ConsoleHeader icon={icon} title={title} description={description} />
		<ConsoleBody>
			<ConsoleEmpty
				icon={icon}
				title="Coming soon"
				description="This console is reserved and will be available in an upcoming release. The navigation entry is in place so the destination already resolves."
			/>
		</ConsoleBody>
	</ConsoleShell>
);
