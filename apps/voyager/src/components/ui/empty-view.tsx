/**
 * Empty View Component for Notploy Voyager
 * 
 * Displays a message when there's no data to show.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from './button';

// ============================================================================
// Types
// ============================================================================

/** Empty view props */
export interface EmptyViewProps {
  /** Icon to display */
  icon?: string;
  /** Title message */
  message?: string;
  /** Description message */
  description?: string;
  /** Whether to show action button */
  showAction?: boolean;
  /** Action button text */
  actionText?: string;
  /** Action callback */
  onAction?: () => void;
  /** Custom style */
  style?: StyleProp<ViewStyle>;
  /** Custom text style */
  textStyle?: any;
  /** Custom description style */
  descriptionStyle?: any;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Empty view component.
 */
export function EmptyView({
  icon = '📭',
  message,
  description,
  showAction = false,
  actionText,
  onAction,
  style,
  textStyle,
  descriptionStyle,
}: EmptyViewProps) {
  const color = useColor();
  const t = useTranslation();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.icon, { color: color.mutedForeground }]}>
        {icon}
      </Text>
      
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

      {showAction && onAction && (
        <Button
          onPress={onAction}
          variant="outline"
          size="md"
        >
          {actionText || t('app.getStarted')}
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
    gap: 12,
    padding: 20,
  },
  icon: {
    fontSize: 48,
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
