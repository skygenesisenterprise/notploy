/**
 * Loading View Component for Notploy Voyager
 * 
 * Displays a loading indicator with optional message.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';

// ============================================================================
// Types
// ============================================================================

/** Loading view props */
export interface LoadingViewProps {
  /** Loading message */
  message?: string;
  /** Whether to show the activity indicator */
  showSpinner?: boolean;
  /** Custom style */
  style?: StyleProp<ViewStyle>;
  /** Custom text style */
  textStyle?: any;
  /** Custom spinner color */
  spinnerColor?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Loading view component.
 */
export function LoadingView({
  message,
  showSpinner = true,
  style,
  textStyle,
  spinnerColor,
}: LoadingViewProps) {
  const color = useColor();
  const t = useTranslation();

  return (
    <View style={[styles.container, style]}>
      {showSpinner && (
        <ActivityIndicator
          size="large"
          color={spinnerColor || color.primary}
        />
      )}
      {message && (
        <Text style={[styles.message, { color: color.mutedForeground }, textStyle]}>
          {message}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
});
