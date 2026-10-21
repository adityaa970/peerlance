import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { LogOut, Moon, Sun, Shield, Info } from 'lucide-react-native';
import { useAuth } from '@clerk/expo';
import { useUserStore } from '../../store/userStore';
import { useRouter } from 'expo-router';

export default function AdminSettingsScreen() {
  const { colors: Colors, theme, toggleTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { signOut } = useAuth();
  const logout = useUserStore(s => s.logout);
  const user = useUserStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Admin Info */}
        <View style={styles.adminCard}>
          <View style={styles.adminIcon}>
            <Shield size={28} color="#A78BFA" />
          </View>
          <View style={styles.adminInfo}>
            <Text style={styles.adminName}>{user.name}</Text>
            <Text style={styles.adminEmail}>{user.email}</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMINISTRATOR</Text>
            </View>
          </View>
        </View>

        {/* Theme Toggle */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <TouchableOpacity style={styles.settingRow} onPress={toggleTheme}>
          <View style={styles.settingLeft}>
            {theme === 'dark' ? <Moon size={20} color={Colors.textPrimary} /> : <Sun size={20} color={Colors.textPrimary} />}
            <Text style={styles.settingLabel}>Theme</Text>
          </View>
          <View style={styles.themeChip}>
            <Text style={styles.themeChipText}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
          </View>
        </TouchableOpacity>

        {/* App Info */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Info size={20} color={Colors.textPrimary} />
            <Text style={styles.settingLabel}>App Version</Text>
          </View>
          <Text style={styles.settingValue}>1.0.0</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#FB7185" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  adminCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    marginBottom: 28,
  },
  adminIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 8,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingValue: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  themeChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  themeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    marginTop: 28,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FB7185',
  },
});
