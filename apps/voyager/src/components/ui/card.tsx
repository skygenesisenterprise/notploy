/**
 * Card Component for Notploy Voyager
 * 
 * A reusable card component for displaying content in a contained layout.
 */

import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useColor } from '@/hooks/use-color';

// ============================================================================
// Types
// ============================================================================

/** Card props */
interface CardProps extends ViewProps {
  /** Whether the card has padding */
  padded?: boolean;
  /** Whether the card has a border */
  bordered?: boolean;
  /** Custom style */
  style?: any;
  /** Children */
  children?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Card component.
 */
export function Card({
  padded = true,
  bordered = true,
  style,
  children,
  ...props
}: CardProps) {
  const color = useColor();

  const cardStyles = [
    {
      backgroundColor: color.surface,
      borderColor: bordered ? color.border : 'transparent',
    },
    padded && styles.padded,
    bordered && styles.bordered,
    styles.base,
    style,
  ];

  return (
    <View {...props} style={cardStyles}>
      {children}
    </View>
  );
}

// ============================================================================
// Card Header
// ============================================================================

/** Card header props */
interface CardHeaderProps extends ViewProps {
  children?: React.ReactNode;
}

/**
 * Card header component.
 */
export function CardHeader({ children, ...props }: CardHeaderProps) {
  return (
    <View {...props} style={[styles.header, props.style]}>
      {children}
    </View>
  );
}

// ============================================================================
// Card Content
// ============================================================================

/** Card content props */
interface CardContentProps extends ViewProps {
  children?: React.ReactNode;
}

/**
 * Card content component.
 */
export function CardContent({ children, ...props }: CardContentProps) {
  return (
    <View {...props} style={[props.style]}>
      {children}
    </View>
  );
}

// ============================================================================
// Card Footer
// ============================================================================

/** Card footer props */
interface CardFooterProps extends ViewProps {
  children?: React.ReactNode;
}

/**
 * Card footer component.
 */
export function CardFooter({ children, ...props }: CardFooterProps) {
  return (
    <View {...props} style={[styles.footer, props.style]}>
      {children}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
  },
  padded: {
    padding: 16,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export { Card };
