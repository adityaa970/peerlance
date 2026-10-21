import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { RefreshCcw, AlertOctagon } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  fullScreen?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't connect to the server. Please try again.",
  onRetry,
  fullScreen = true
}: ErrorStateProps) {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <View style={[styles.iconBox, { backgroundColor: Colors.errorSoft }]}>
        <AlertOctagon color={Colors.error} size={32} strokeWidth={2} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: Colors.primary }]} 
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <RefreshCcw color="#FFF" size={18} strokeWidth={2.5} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    flex: 1,
    minHeight: 300,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  }
});
