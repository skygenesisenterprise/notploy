/**
 * The connection list, kept in sync with the main process.
 *
 * The main process is the single owner of connection state: it pushes the full
 * list whenever something changes (a check finishing, an API key stored, a
 * connection added elsewhere in the app). The renderer never polls and never
 * keeps a second copy that could disagree.
 */

import * as React from "react";
import {
	asFailure,
	type BridgeFailure,
	getBridge,
} from "@/renderer/lib/bridge";
import type { ConnectionSummary } from "@/shared/domain";

export interface ConnectionsState {
	connections: ConnectionSummary[];
	active: ConnectionSummary | undefined;
	loading: boolean;
	error: BridgeFailure | undefined;
	reload: () => Promise<void>;
}

export function useConnections(): ConnectionsState {
	const [connections, setConnections] = React.useState<ConnectionSummary[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<BridgeFailure | undefined>(
		undefined,
	);

	const reload = React.useCallback(async () => {
		try {
			setConnections(await getBridge().connections.list());
			setError(undefined);
		} catch (caught) {
			setError(asFailure(caught));
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void reload();

		// Subscribing can fail when the preload bridge is missing (a packaged app
		// with a broken preload, or the bundle opened in a browser). A throw here
		// would propagate out of the effect and take the whole tree down — a blank
		// window instead of the explanation the shell is about to render.
		try {
			return getBridge().connections.onChanged((next) => {
				setConnections(next);
				setError(undefined);
			});
		} catch (caught) {
			setError(asFailure(caught));
			return undefined;
		}
	}, [reload]);

	const active = React.useMemo(
		() => connections.find((connection) => connection.active),
		[connections],
	);

	return { connections, active, loading, error, reload };
}

/** True when the active connection exposes a capability. */
export function hasCapability(
	connection: ConnectionSummary | undefined,
	capability: keyof NonNullable<ConnectionSummary["capabilities"]>,
): boolean {
	return connection?.capabilities?.[capability] === true;
}
