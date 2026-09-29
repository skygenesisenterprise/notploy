/**
 * The one data-loading hook every page uses.
 *
 * Three properties the pages depend on:
 *
 * - **Stale responses are dropped.** A slow request that resolves after a newer
 *   one must not overwrite fresher data, so each run takes a ticket and only the
 *   latest one is allowed to write.
 * - **Unmount is safe.** Nothing is written after the component goes away.
 * - **`error` is a value.** The main process normalises every failure, so the
 *   page renders the message and its hint instead of guessing.
 */

import * as React from "react";
import { asFailure, type BridgeFailure } from "@/renderer/lib/bridge";

export interface AsyncState<T> {
	data: T | undefined;
	error: BridgeFailure | undefined;
	loading: boolean;
	/** Re-runs the loader, keeping the current data visible while it loads. */
	reload: () => void;
}

export interface UseAsyncOptions {
	/** When false, the loader is not run (e.g. no connection is selected). */
	enabled?: boolean;
}

export function useAsync<T>(
	loader: () => Promise<T>,
	deps: React.DependencyList,
	options: UseAsyncOptions = {},
): AsyncState<T> {
	const { enabled = true } = options;
	const [data, setData] = React.useState<T | undefined>(undefined);
	const [error, setError] = React.useState<BridgeFailure | undefined>(
		undefined,
	);
	const [loading, setLoading] = React.useState(enabled);
	const [nonce, setNonce] = React.useState(0);

	const sequence = React.useRef(0);
	const loaderRef = React.useRef(loader);
	loaderRef.current = loader;

	// The caller owns the dependency list; `nonce` and `enabled` are added so a
	// manual reload and a disabled→enabled flip both re-run the loader.
	React.useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}
		const ticket = ++sequence.current;
		let cancelled = false;
		setLoading(true);

		loaderRef
			.current()
			.then((value) => {
				if (cancelled || ticket !== sequence.current) return;
				setData(value);
				setError(undefined);
			})
			.catch((caught) => {
				if (cancelled || ticket !== sequence.current) return;
				setError(asFailure(caught));
			})
			.finally(() => {
				if (cancelled || ticket !== sequence.current) return;
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [...deps, nonce, enabled]);

	const reload = React.useCallback(() => setNonce((value) => value + 1), []);

	return { data, error, loading, reload };
}
