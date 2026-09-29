import * as React from "react";
import { getBridge } from "@/renderer/lib/bridge";
import { DEFAULT_PREFERENCES, type DesktopPreferences } from "@/shared/ipc";

export interface PreferencesState {
	preferences: DesktopPreferences;
	update: (patch: Partial<DesktopPreferences>) => Promise<void>;
	loaded: boolean;
}

export function usePreferences(): PreferencesState {
	const [preferences, setPreferences] =
		React.useState<DesktopPreferences>(DEFAULT_PREFERENCES);
	const [loaded, setLoaded] = React.useState(false);

	React.useEffect(() => {
		let cancelled = false;
		void getBridge()
			.app.getPreferences()
			.then((value) => {
				if (cancelled) return;
				setPreferences(value);
				setLoaded(true);
			})
			.catch(() => {
				// Defaults are a safe fallback: they are confirmation dialogues and
				// display limits, nothing that could act on its own.
				if (!cancelled) setLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const update = React.useCallback(
		async (patch: Partial<DesktopPreferences>) => {
			const next = await getBridge().app.updatePreferences(patch);
			setPreferences(next);
		},
		[],
	);

	return { preferences, update, loaded };
}
