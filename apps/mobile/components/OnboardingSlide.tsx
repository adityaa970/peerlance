import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, FontSize } from '../constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor?: string;
}

export function OnboardingSlide({ icon, title, description, accentColor }: OnboardingSlideProps) {
  const { colors: Colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: (accentColor || Colors.primary) + '15' }]}>
        <View style={[styles.iconBox, { backgroundColor: accentColor || Colors.primary }]}>
          {icon}
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.description, { color: Colors.textTertiary }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['4xl'],
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
    fontWeight: '500',
  },
});
