import { useTheme } from '../hooks/useTheme';
import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { Radius, Spacing, FontSize } from '../constants/Colors';
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
export function Input({
  label,
  error,
  icon,
  rightIcon,
  style,
  ...props
}: InputProps) {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  return <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error ? styles.inputError : null, props.editable === false && styles.inputDisabled]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput style={[styles.input, icon ? styles.inputWithIcon : null, rightIcon ? styles.inputWithRightIcon : null, style]} placeholderTextColor={Colors.textTertiary} {...props} />
        {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    width: '100%'
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 52,
    overflow: 'hidden',
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorSoft
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.overlayLight
  },
  iconContainer: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '500'
  },
  inputWithIcon: {
    paddingLeft: 0
  },
  inputWithRightIcon: {
    paddingRight: 0
  },
  rightIconContainer: {
    paddingRight: Spacing.lg,
    paddingLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 4,
    fontWeight: '500'
  }
});