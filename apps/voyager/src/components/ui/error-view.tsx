/**
 * Error View Component for Notploy Voyager
 * 
 * Displays an error message with optional retry button.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from './button';

// ============================================================================
// Types
// ============================================================================

/** Error view props */
interface ErrorViewProps {
  /** Error message */
  message?: string;
  /** Error description */
  description?: string;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Retry callback */
  onRetry?: () => void;
  /** Retry button text */
  retryText?: string;
  /** Custom style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: any;
  /** Custom description style */
  descriptionStyle?: any;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Error view component.
 */
export function ErrorView({
  message,
  description,
  showRetry = true,
  onRetry,
  retryText,
  style,
  textStyle,
  descriptionStyle,
}: ErrorViewProps) {
  const color = useColor();
  const t = useTranslation();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.errorIcon, { color: color.error }]}>⚠️</Text>
      
      {message && (
        <Text style={[styles.message, { color: color.foreground }, textStyle]}>
          {message}
        </Text>
      )}

      {description && (
        <Text 
          style={[styles.description, { color: color.mutedForeground }, descriptionStyle]}
        >
          {description}
        </Text>
      )}

      {showRetry && onRetry && (
        <Button
          onPress={onRetry}
          variant="outline"
          size="md"
        >
          {retryText || t('app.retry')}
        </Button>
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
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
