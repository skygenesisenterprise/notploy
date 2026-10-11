/**
 * Button Component for Notploy Voyager
 * 
 * A reusable button component with multiple variants and sizes.
 */

import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import { useColor } from '@/hooks/use-color';

// ============================================================================
// Types
// ============================================================================

/** Button variant */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';

/** Button size */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Button props */
interface ButtonProps extends TouchableOpacityProps {
  /** Button text */
  children: React.ReactNode;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Whether the button is loading */
  isLoading?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Custom style */
  style?: any;
  /** Custom text style */
  textStyle?: any;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Button component.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const color = useColor();

  // Determine button styles based on variant
  const getButtonStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? color.primary + '80' : color.primary,
          borderColor: color.primary,
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? color.surface + '80' : color.surface,
          borderColor: color.border,
          borderWidth: StyleSheet.hairlineWidth,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: color.border,
          borderWidth: StyleSheet.hairlineWidth,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: disabled ? color.error + '80' : color.error,
          borderColor: color.error,
        };
      case 'link':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: color.primary,
          borderColor: color.primary,
        };
    }
  };

  // Determine text styles based on variant
  const getTextStyles = () => {
    switch (variant) {
      case 'primary':
        return { color: color.primaryForeground };
      case 'secondary':
        return { color: color.foreground };
      case 'outline':
        return { color: color.foreground };
      case 'ghost':
        return { color: color.foreground };
      case 'danger':
        return { color: color.primaryForeground };
      case 'link':
        return { color: color.primary, textDecorationLine: 'underline' };
      default:
        return { color: color.primaryForeground };
    }
  };

  // Determine size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          minHeight: 32,
        };
      case 'md':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 40,
        };
      case 'lg':
        return {
          paddingHorizontal: 24,
          paddingVertical: 12,
          minHeight: 48,
        };
      default:
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 40,
        };
    }
  };

  const buttonStyles = [
    styles.base,
    getButtonStyles(),
    getSizeStyles(),
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.baseText,
    getTextStyles(),
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      {...props}
      style={buttonStyles}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? color.primaryForeground : color.foreground}
          size={size === 'lg' ? 'small' : 'small'}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
          <Text style={textStyles}>{children}</Text>
          {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  baseText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginHorizontal: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
});
