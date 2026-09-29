import type { RouteId } from "@/renderer/lib/routes";
import type { ConnectionSummary } from "@/shared/domain";

/**
 * What the shell hands to an instance-scoped page.
 *
 * `refreshToken` changes whenever the user asks for a refresh (the menu item or
 * the title-bar button), and pages include it in their loader dependencies — one
 * refresh mechanism for every page instead of one per page.
 */
export interface InstancePageProps {
	connection: ConnectionSummary | undefined;
	refreshToken: number;
	onNavigate: (route: RouteId) => void;
}
