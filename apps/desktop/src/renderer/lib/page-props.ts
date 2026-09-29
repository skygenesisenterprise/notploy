import type { DeepLinkResource, RouteState } from "@/renderer/lib/routes";
import type { ConnectionSummary } from "@/shared/domain";

/**
 * What the shell hands to an instance-scoped page.
 *
 * `refreshToken` changes whenever the user asks for a refresh (the menu item,
 * `Cmd/Ctrl+R`, the palette or the title-bar button), and pages include it in
 * their loader dependencies — one refresh mechanism for every page instead of one
 * per page.
 *
 * `route` is the page's own destination, including the resource it should open.
 * A page that can drill down updates the URL through `onNavigate`, so a
 * breadcrumb, the browser history of a deep link and the sidebar all agree.
 */
export interface InstancePageProps {
	connection: ConnectionSummary | undefined;
	refreshToken: number;
	onNavigate: (route: RouteState) => void;
	/** Nothing to do with the resource; used by pages that open a sibling section. */
	onOpenResource?: (resource: DeepLinkResource) => void;
	/** The resource this page was asked to open, if any. */
	route: RouteState;
}

/** True when the page was asked to open a resource of this kind. */
export function resourceOfKind<K extends DeepLinkResource["kind"]>(
	route: RouteState,
	kind: K,
): Extract<DeepLinkResource, { kind: K }> | undefined {
	if (route.resource?.kind === kind) {
		return route.resource as Extract<DeepLinkResource, { kind: K }>;
	}
	return undefined;
}
