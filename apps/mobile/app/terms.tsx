import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, ShieldAlert, Scale, Gavel } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing, FontSize } from '../constants/Colors';

export default function TermsScreen() {
  const { colors: Colors } = useTheme();
  const router = useRouter();
  const styles = createStyles(Colors);

  const sections = [
    {
      title: '1. Acceptance of Terms',
      icon: <FileText size={20} color={Colors.primary} />,
      content: 'By accessing or using Peerlance, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our services.'
    },
    {
      title: '2. User Accounts',
      icon: <Scale size={20} color={Colors.primary} />,
      content: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.'
    },
    {
      title: '3. Service Usage',
      icon: <Gavel size={20} color={Colors.primary} />,
      content: 'Peerlance is a marketplace for assignments. Users must not use the platform for any illegal activities. We reserve the right to suspend accounts that violate our community standards.'
    },
    {
      title: '4. Payments and Fees',
      icon: <ShieldAlert size={20} color={Colors.primary} />,
      content: 'Payments for assignments are held in escrow and released upon completion. Service fees are non-refundable once an assignment has been started by a writer.'
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.descriptionCard}>
          <Text style={styles.lastUpdated}>Last updated: April 17, 2026</Text>
          <Text style={styles.introText}>
            Welcome to Peerlance. These terms govern your use of our mobile application and services. 
            Please read them carefully to understand your rights and obligations.
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
            If you have any questions regarding these terms, please contact us via the Support Chat.
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
    backgroundColor: Colors.primarySoft,
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
