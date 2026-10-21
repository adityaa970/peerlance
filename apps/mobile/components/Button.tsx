import { useTheme } from '../hooks/useTheme';
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import { Radius, Spacing, FontSize } from '../constants/Colors';
interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  textStyle?: any;
  ref?: React.Ref<View>;
}
export function Button({
  title,
  variant = 'primary',
  isLoading,
  size = 'lg',
  style,
  icon,
  textStyle,
  ...props
}: ButtonProps) {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return <TouchableOpacity style={[styles.button, size === 'sm' && styles.buttonSm, size === 'md' && styles.buttonMd, variant === 'primary' && styles.primary, variant === 'secondary' && styles.secondary, variant === 'outline' && styles.outline, variant === 'danger' && styles.danger, variant === 'accent' && styles.accent, props.disabled && styles.disabled, style]} activeOpacity={0.8} {...props}>
      {isLoading ? <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.textInverse} /> : <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, size === 'sm' && styles.textSm, variant === 'primary' && styles.primaryText, variant === 'secondary' && styles.secondaryText, variant === 'outline' && styles.outlineText, variant === 'danger' && styles.dangerText, variant === 'accent' && styles.accentText, textStyle]}>
            {title}
          </Text>
        </>}
    </TouchableOpacity>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  button: {
    height: 54,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    width: '100%'
  },
  iconContainer: {
    marginRight: Spacing.sm
  },
  buttonSm: {
    height: 40,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg
  },
  buttonMd: {
    height: 46,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg
  },
  primary: {
    backgroundColor: Colors.primary
  },
  secondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary
  },
  danger: {
    backgroundColor: Colors.error
  },
  accent: {
    backgroundColor: Colors.accent
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  textSm: {
    fontSize: FontSize.sm
  },
  primaryText: {
    color: Colors.textInverse
  },
  secondaryText: {
    color: Colors.textPrimary
  },
  outlineText: {
    color: Colors.primary
  },
  dangerText: {
    color: Colors.textInverse
  },
  accentText: {
    color: Colors.textInverse
  }
});