import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Settings, Info } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';

export default function AdminSettingsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    writerFirstTaskBonus: 10,
    writerCommissionRate: 0.02,
    posterFirstTaskBonus: 10,
    posterMilestoneBonus: 40,
    posterMilestoneCount: 2
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/settings');
      if (res.data.success && res.data.settings) {
        setSettings(res.data.settings);
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiClient.patch('/admin/settings', settings);
      if (res.data.success) {
        Alert.alert('Success', 'Settings updated successfully!');
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    const numValue = field === 'posterMilestoneCount' ? parseInt(value) || 0 : parseFloat(value) || 0;
    setSettings(prev => ({ ...prev, [field]: numValue }));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Settings</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save color="#fff" size={20} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Info size={16} color={Colors.primary} />
          <Text style={styles.infoText}>These values control all referral payouts across the platform. Changes take effect immediately for all new completions.</Text>
        </View>

        <Text style={styles.sectionTitle}>Writer Referral Rewards</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Task Bonus (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.writerFirstTaskBonus.toString()}
              onChangeText={(v) => updateField('writerFirstTaskBonus', v)}
            />
            <Text style={styles.hint}>Paid one-time when the referred writer completes their first task.</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lifetime Commission (Rate)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.writerCommissionRate.toString()}
              onChangeText={(v) => updateField('writerCommissionRate', v)}
            />
            <Text style={styles.hint}>Percentage of worker payout earned by the referrer (e.g., 0.02 = 2%).</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Poster Referral Rewards</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Task Bonus (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.posterFirstTaskBonus.toString()}
              onChangeText={(v) => updateField('posterFirstTaskBonus', v)}
            />
            <Text style={styles.hint}>Paid one-time when the referred poster completes their first task.</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Milestone Bonus (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.posterMilestoneBonus.toString()}
              onChangeText={(v) => updateField('posterMilestoneBonus', v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Milestone Trigger (Friends Count)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.posterMilestoneCount.toString()}
              onChangeText={(v) => updateField('posterMilestoneCount', v)}
            />
            <Text style={styles.hint}>Referrer earns the bonus above for every X friends who complete a task.</Text>
          </View>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
    lineHeight: 14,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  footerSpace: {
    height: 40,
  }
});
