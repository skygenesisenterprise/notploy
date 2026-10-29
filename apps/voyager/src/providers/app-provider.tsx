/**
 * App Provider for Notploy Voyager
 *
 * Root provider that combines all app-level providers.
 */

import type React from "react";
import { AuthProvider } from "./auth-provider";
import { InstancesProvider } from "./instances-provider";
// Re-export all providers
import { ThemeProvider } from "./theme-provider";

/**
 * App provider props.
 */
interface AppProviderProps {
	children: React.ReactNode;
}

/**
 * App provider component.
 * Combines all the app-level providers into a single component.
 */
export function AppProvider({ children }: AppProviderProps) {
	return (
		<ThemeProvider>
			<InstancesProvider>
				<AuthProvider>{children}</AuthProvider>
			</InstancesProvider>
		</ThemeProvider>
	);
}

export { useAuth } from "./auth-provider";
export { useInstances } from "./instances-provider";
// Re-export hooks for convenience
export { useColor, useIsDark, useTheme } from "./theme-provider";
