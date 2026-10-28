/**
 * Theme Provider for Notploy Voyager
 * 
 * Provides theme context (light/dark/system) and color utilities.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Theme Types
// ============================================================================

/** Theme mode */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Theme context value */
interface ThemeContextValue {
  /** Current theme mode */
  theme: ThemeMode;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Set the theme mode */
  setTheme: (mode: ThemeMode) => Promise<void>;
  /** Get theme-aware color */
  color: {
    primary: string;
    primaryForeground: string;
    surface: string;
    background: string;
    foreground: string;
    mutedForeground: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

// ============================================================================
// Theme Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================================================
// Theme Colors
// ============================================================================

/** Light theme colors */
const lightColors = {
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  surface: '#ffffff',
  background: '#f8fafc',
  foreground: '#0f172a',
  mutedForeground: '#64748b',
  border: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

/** Dark theme colors */
const darkColors = {
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  surface: '#1e293b',
  background: '#0f172a',
  foreground: '#f8fafc',
  mutedForeground: '#94a3b8',
  border: '#334155',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

/** Storage key for theme preference */
const THEME_STORAGE_KEY = '@notploy_voyager_theme';

// ============================================================================
// Theme Provider Component
// ============================================================================

/**
 * Theme provider component.
 * Manages theme state and provides color utilities.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          setThemeMode(saved as ThemeMode);
        }
      } catch {
        // Ignore errors
      }
    };
    loadTheme();
  }, []);

  // Determine if dark mode is active
  const isDark = React.useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  // Current colors based on theme
  const colors = React.useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  // Set theme and save to storage
  const setTheme = async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore errors
    }
  };

  // Navigation theme
  const navigationTheme = React.useMemo(() => {
    return isDark ? DarkTheme : DefaultTheme;
  }, [isDark]);

  const contextValue: ThemeContextValue = {
    theme: themeMode,
    isDark,
    setTheme,
    color: colors,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <NavigationThemeProvider value={navigationTheme}>
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access theme context.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to get theme-aware colors.
 */
export function useColor() {
  const { color } = useTheme();
  return color;
}

/**
 * Hook to check if dark mode is active.
 */
export function useIsDark() {
  const { isDark } = useTheme();
  return isDark;
}
