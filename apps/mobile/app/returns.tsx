import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCcw, ShieldCheck, AlertCircle, Ban } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing, FontSize } from '../constants/Colors';

export default function ReturnsScreen() {
  const { colors: Colors } = useTheme();
  const router = useRouter();
  const styles = createStyles(Colors);

  const sections = [
    {
      title: '1. Refund Eligibility',
      icon: <RefreshCcw size={20} color={Colors.error} />,
      content: 'A full refund is available if a Poster cancels an assignment before a Writer has accepted or started working on it.'
    },
    {
      title: '2. Quality Disputes',
      icon: <ShieldCheck size={20} color={Colors.error} />,
      content: 'If an assignment does not meet the agreed-upon requirements, a dispute can be raised within 24 hours of delivery. Our admin team will review and determine if a partial or full refund is warranted.'
    },
    {
      title: '3. Non-Refundable Cases',
      icon: <Ban size={20} color={Colors.error} />,
      content: 'Once an assignment is marked as "Approved" by the Poster, funds are released to the Writer and cannot be refunded. Late submissions may be eligible for partial refunds depending on the delay.'
    },
    {
      title: '4. Refund Process',
      icon: <AlertCircle size={20} color={Colors.error} />,
      content: 'Approved refunds are credited back to your Peerlance Wallet within 2-3 business days. You can then use these funds for new assignments or request a withdrawal.'
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
        <Text style={styles.headerTitle}>Return Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.descriptionCard}>
          <Text style={styles.lastUpdated}>Last updated: April 17, 2026</Text>
          <Text style={styles.introText}>
            Our return and refund policy is designed to protect both Posters and Writers. We ensure fair compensation for work done and security for your funds.
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
            Please review your assignments carefully before approving them to ensure a smooth transition of funds.
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
    backgroundColor: Colors.errorSoft,
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
