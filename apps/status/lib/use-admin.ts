"use client";

import * as React from "react";
import { adminRequest } from "./admin-client";

export interface AdminResource<T> {
	data: T | null;
	error: string | null;
	loading: boolean;
	reload: () => void;
}

/** GET an admin resource, re-fetching whenever `path` or the token changes. */
export const useAdminResource = <T>(
	token: string | null,
	path: string | null,
): AdminResource<T> => {
	const [data, setData] = React.useState<T | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(Boolean(token && path));
	const [nonce, setNonce] = React.useState(0);

	React.useEffect(() => {
		if (!token || !path) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		adminRequest<T>(token, path)
			.then((next) => {
				if (!cancelled) {
					setData(next);
				}
			})
			.catch((cause: unknown) => {
				if (!cancelled) {
					setError(cause instanceof Error ? cause.message : "Request failed");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [token, path, nonce]);

	const reload = React.useCallback(() => setNonce((value) => value + 1), []);
	return { data, error, loading, reload };
};
