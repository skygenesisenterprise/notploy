/**
 * App Provider for Notploy Voyager
 * 
 * Root provider that combines all app-level providers.
 */

import React from 'react';

// Re-export all providers
import { ThemeProvider } from './theme-provider';
import { InstancesProvider } from './instances-provider';
import { AuthProvider } from './auth-provider';

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </InstancesProvider>
    </ThemeProvider>
  );
}

// Re-export hooks for convenience
export { useTheme, useColor, useIsDark } from './theme-provider';
export { useInstances } from './instances-provider';
export { useAuth } from './auth-provider';
