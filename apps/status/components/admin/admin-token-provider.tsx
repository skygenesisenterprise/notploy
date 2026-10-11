"use client";

import * as React from "react";

const STORAGE_KEY = "notploy.status.adminToken";

interface AdminTokenContextValue {
	token: string | null;
	/** `null` clears the stored credential. */
	setToken: (token: string | null) => void;
	ready: boolean;
}

const AdminTokenContext = React.createContext<AdminTokenContextValue | null>(
	null,
);

export const AdminTokenProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [token, setTokenState] = React.useState<string | null>(null);
	const [ready, setReady] = React.useState(false);

	React.useEffect(() => {
		setTokenState(window.localStorage.getItem(STORAGE_KEY));
		setReady(true);
	}, []);

	const setToken = React.useCallback((next: string | null) => {
		if (next) {
			window.localStorage.setItem(STORAGE_KEY, next);
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
		setTokenState(next);
	}, []);

	const value = React.useMemo(
		() => ({ token, setToken, ready }),
		[token, setToken, ready],
	);

	return (
		<AdminTokenContext.Provider value={value}>
			{children}
		</AdminTokenContext.Provider>
	);
};

export const useAdminToken = (): AdminTokenContextValue => {
	const context = React.useContext(AdminTokenContext);
	if (!context) {
		throw new Error("useAdminToken must be used inside AdminTokenProvider");
	}
	return context;
};
