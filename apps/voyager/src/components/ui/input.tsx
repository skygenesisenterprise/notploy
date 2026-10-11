/**
 * Input Component for Notploy Voyager
 * 
 * A reusable text input component with label and validation support.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { useColor } from '@/hooks/use-color';

// ============================================================================
// Types
// ============================================================================

/** Input variant */
export type InputVariant = 'default' | 'outline' | 'filled';

/** Input size */
export type InputSize = 'sm' | 'md' | 'lg';

/** Input props */
interface InputProps extends TextInputProps {
  /** Input label */
  label?: string;
  /** Input variant */
  variant?: InputVariant;
  /** Input size */
  size?: InputSize;
  /** Whether the input has an error */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Custom container style */
  containerStyle?: any;
  /** Custom label style */
  labelStyle?: any;
  /** Custom input style */
  inputStyle?: any;
  /** Custom error message style */
  errorMessageStyle?: any;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Input component.
 */
export function Input({
  label,
  variant = 'outline',
  size = 'md',
  error = false,
  errorMessage,
  disabled = false,
  leftIcon,
  rightIcon,
  containerStyle,
  labelStyle,
  inputStyle,
  errorMessageStyle,
  ...props
}: InputProps) {
  const color = useColor();
  const [isFocused, setIsFocused] = useState(false);

  // Determine container styles based on variant and state
  const getContainerStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: disabled ? color.surface + '80' : color.surface,
          borderColor: 'transparent',
        };
      case 'outline':
      default:
        return {
          backgroundColor: 'transparent',
          borderColor: error 
            ? color.error 
            : isFocused 
              ? color.primary 
              : color.border,
          borderWidth: StyleSheet.hairlineWidth,
        };
    }
  };

  // Determine input styles
  const getInputStyles = () => {
    return {
      color: disabled ? color.mutedForeground : color.foreground,
    };
  };

  const containerStyles = [
    styles.container,
    getContainerStyles(),
    disabled && styles.disabled,
    containerStyle,
  ];

  const inputStyles = [
    styles.input,
    getInputStyles(),
    getSizeStyles(size),
    disabled && styles.disabledInput,
    inputStyle,
  ];

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: color.foreground }, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={containerStyles}>
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        
        <TextInput
          {...props}
          style={inputStyles}
          editable={!disabled}
          placeholderTextColor={color.mutedForeground}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {rightIcon && (
          <TouchableOpacity style={styles.icon} disabled={disabled}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {error && errorMessage && (
        <Text style={[styles.errorMessage, { color: color.error }, errorMessageStyle]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// Size Styles
// ============================================================================

function getSizeStyles(size: InputSize) {
  switch (size) {
    case 'sm':
      return {
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 32,
        fontSize: 14,
      };
    case 'md':
      return {
        paddingHorizontal: 14,
        paddingVertical: 8,
        minHeight: 40,
        fontSize: 14,
      };
    case 'lg':
      return {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
        fontSize: 16,
      };
    default:
      return {
        paddingHorizontal: 14,
        paddingVertical: 8,
        minHeight: 40,
        fontSize: 14,
      };
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  icon: {
    marginHorizontal: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  disabledInput: {
    opacity: 0.6,
  },
  errorMessage: {
    fontSize: 12,
    marginTop: 4,
  },
});
