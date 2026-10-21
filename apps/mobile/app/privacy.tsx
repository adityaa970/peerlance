import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Eye, Database, Globe } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing, FontSize } from '../constants/Colors';

export default function PrivacyScreen() {
  const { colors: Colors } = useTheme();
  const router = useRouter();
  const styles = createStyles(Colors);

  const sections = [
    {
      title: '1. Information We Collect',
      icon: <Database size={20} color={Colors.accent} />,
      content: 'We collect information you provide directly to us, such as when you create an account (via Clerk), update your profile, or submit an assignment.'
    },
    {
      title: '2. How We Use Data',
      icon: <Eye size={20} color={Colors.accent} />,
      content: 'We use the information to facilitate assignment matching, process payments through Supabase, and communicate update notifications to you.'
    },
    {
      title: '3. Data Security',
      icon: <Lock size={20} color={Colors.accent} />,
      content: 'We use industry-standard security measures to protect your personal data. Your payment information is processed through secure, encrypted gateways.'
    },
    {
      title: '4. Third-Party Services',
      icon: <Globe size={20} color={Colors.accent} />,
      content: 'Your authentication is managed by Clerk, and your data is stored securely in Supabase. We do not sell your personal information to third parties.'
    }
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.descriptionCard}>
          <Text style={styles.lastUpdated}>Last updated: April 17, 2026</Text>
          <Text style={styles.introText}>
            At Peerlance, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information.
          </Text>
        </View>

        {sections.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.iconContainer}>
                {section.icon}
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have concerns about your data, please reach out via our Help & Support section.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 60,
  },
  descriptionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  lastUpdated: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  introText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionContent: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});
