import { useTheme } from '@/hooks/useTheme';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, StatusBar, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { ArrowLeft, Bell, Moon, Globe, Shield, Lock, Eye, Info, FileText, ChevronRight, HelpCircle, Mail, ExternalLink, LogOut, User as UserIcon, RefreshCcw } from 'lucide-react-native';
import { Spacing, Radius, FontSize, UserRole } from '../../constants/Colors';
import { useUserStore } from '../../store/userStore';
import { apiClient } from '../../utils/api';
import { CoachMark } from '../../components/CoachMark';
import { useIsFocused } from '@react-navigation/native';

interface SettingToggleProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  innerRef?: React.RefObject<View | null>;
  onLayout?: () => void;
}
function SettingToggle({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  onToggle,
  innerRef,
  onLayout
}: SettingToggleProps) {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return <View ref={innerRef} onLayout={onLayout} style={styles.settingRow}>
      <View style={[styles.settingIcon, {
      backgroundColor: iconBg
    }]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{
      false: Colors.border,
      true: Colors.primary + '60'
    }} thumbColor={value ? Colors.primary : '#f4f3f4'} ios_backgroundColor={Colors.border} />
    </View>;
}
interface SettingLinkProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}
function SettingLink({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  danger,
  value
}: SettingLinkProps) {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  return <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.settingIcon, {
      backgroundColor: iconBg
    }]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && {
        color: Colors.error
      }]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {value ? <Text style={styles.settingValue}>{value}</Text> : <ChevronRight color={danger ? Colors.error : Colors.textTertiary} size={18} />}
    </TouchableOpacity>;
}
export default function SettingsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const {
    role,
    isPublicProfile,
    id
  } = useUserStore();
  const {
    signOut,
    getToken,
    userId
  } = useAuth();
  const { user: clerkUser } = useUser();
  const userStoreLogout = useUserStore(s => s.logout);
  const isWriter = role === 'writer';
  const pushNotificationsEnabled = useUserStore(s => s.pushNotificationsEnabled);
  const assignmentAlertsEnabled = useUserStore(s => s.assignmentAlertsEnabled);
  const [pushNotifs, setPushNotifs] = useState(pushNotificationsEnabled);
  const [assignmentAlerts, setAssignmentAlerts] = useState(assignmentAlertsEnabled);
  const [showProfile, setShowProfile] = useState(isPublicProfile);
  const [darkMode, setDarkMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const roleSwitchRef = useRef<View>(null);
  const profileToggleRef = useRef<View>(null);
  const [tourLayouts, setTourLayouts] = useState<Record<number, any>>({});
  const [showTour, setShowTour] = useState(false);
  const completedTours = useUserStore(s => s.completedTours);
  const addCompletedTour = useUserStore(s => s.addCompletedTour);
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const college = useUserStore(s => s.college);

  const measureOne = (ref: React.RefObject<View | null>, index: number) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setTourLayouts(prev => ({ ...prev, [index]: { x, y, width, height } }));
      }
    });
  };

  const measureTour = () => {
    measureOne(roleSwitchRef, 0);
    measureOne(profileToggleRef, 1);
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    const tourId = `settings_${role}`;
    if (isFocused && isLoggedIn && college !== 'Not specified' && !completedTours.includes(tourId) && tourLayouts[0]) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [completedTours, tourLayouts, role, isLoggedIn, college, isFocused]);
  
  const handleTogglePublicProfile = async (val: boolean) => {
    setShowProfile(val);
    try {
      const token = await getToken();
      const res = await apiClient.patch(`/users/${userId}`, {
        isPublicProfile: val
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = res.data;
      if (!data.success) {
        throw new Error('Failed to update public profile');
      }
      useUserStore.setState({
        isPublicProfile: val
      });
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Could not update profile visibility';
      Alert.alert('Error', errorMessage);
      setShowProfile(!val); // revert
    }
  };

  const handleTogglePushNotifs = async (val: boolean) => {
    setPushNotifs(val);
    try {
      const token = await getToken();
      const res = await apiClient.patch(`/users/${userId}`, {
        pushNotificationsEnabled: val
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.data.success) throw new Error('Failed to update');
      useUserStore.setState({ pushNotificationsEnabled: val });
    } catch (e: any) {
      Alert.alert('Error', 'Could not update notification preference');
      setPushNotifs(!val);
    }
  };

  const handleToggleAssignmentAlerts = async (val: boolean) => {
    setAssignmentAlerts(val);
    try {
      const token = await getToken();
      const res = await apiClient.patch(`/users/${userId}`, {
        assignmentAlertsEnabled: val
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.data.success) throw new Error('Failed to update');
      useUserStore.setState({ assignmentAlertsEnabled: val });
    } catch (e: any) {
      Alert.alert('Error', 'Could not update alert preference');
      setAssignmentAlerts(!val);
    }
  };

  const startPasswordReset = () => {
    if (!clerkUser) {
      Alert.alert('Change Password', 'Your session is not ready yet. Please try again in a moment.');
      return;
    }

    if (!clerkUser.passwordEnabled) {
      Alert.alert('Change Password', 'This account does not have a password set yet.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleSubmitPasswordReset = async () => {
    if (!clerkUser) {
      Alert.alert('Change Password', 'Your session is not ready yet. Please try again in a moment.');
      return;
    }
    if (!currentPassword) {
      Alert.alert('Change Password', 'Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Change Password', 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Change Password', 'Passwords do not match.');
      return;
    }

    try {
      setIsResettingPassword(true);
      await clerkUser.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true
      });

      setShowPasswordModal(false);
      Alert.alert('Change Password', 'Your password has been updated.');
    } catch (error: any) {
      Alert.alert('Change Password', error?.errors?.[0]?.longMessage || error?.message || 'Could not update the password.');
    } finally {
      setIsResettingPassword(false);
    }
  };
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out from Peerlance?', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Logout',
      style: 'destructive',
      onPress: async () => {
        userStoreLogout();
        await signOut();
        router.replace('/(auth)/login');
      }
    }]);
  };

  const handleSwitchRole = async () => {
    const newRole: UserRole = role === 'poster' ? 'writer' : 'poster';
    const roleLabel = newRole === 'poster' ? 'Poster' : 'Writer';

    Alert.alert(
      'Switch Role', 
      `Are you sure you want to switch to ${roleLabel} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: async () => {
            try {
              setIsResettingPassword(true); // Reuse loading state
              const token = await getToken();
              const res = await apiClient.patch(`/users/${userId}`, {
                role: newRole
              }, {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                }
              });

              if (res.data.success) {
                // Update local store
                useUserStore.getState().login({
                  ...useUserStore.getState(),
                  role: newRole
                });
                
                // Force navigation reset to refresh tabs
                router.replace('/(tabs)');
              } else {
                throw new Error('Failed to switch role');
              }
            } catch (err) {
              Alert.alert('Error', 'Could not switch role. Please try again.');
            } finally {
              setIsResettingPassword(false);
            }
          }
        }
      ]
    );
  };

  return <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{
        width: 40
      }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Account Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Mode</Text>
          <View style={styles.sectionCard}>
            <View ref={roleSwitchRef} onLayout={measureTour} style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primarySoft }]}>
                <UserIcon color={Colors.primary} size={18} strokeWidth={2} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  Current Role: {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {role === 'admin' ? 'System Administrator' : 
                   role === 'poster' ? 'You are posting tasks' : 
                   'You are completing tasks'}
                </Text>
              </View>
              {role !== 'admin' && (
                <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchRole}>
                  <Text style={styles.switchBtnText}>Switch</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionCard}>
            <SettingToggle icon={<Bell color={Colors.primary} size={18} strokeWidth={2} />} iconBg={Colors.primarySoft} title="Push Notifications" subtitle="Receive updates and alerts" value={pushNotifs} onToggle={handleTogglePushNotifs} />
            <View style={styles.settingDivider} />
            <SettingToggle icon={<FileText color={Colors.accent} size={18} strokeWidth={2} />} iconBg={Colors.accentSoft} title={isWriter ? 'New Assignment Alerts' : 'Writer Accepted Alerts'} subtitle={isWriter ? 'Matching subjects you can write' : 'When a writer accepts your assignment'} value={assignmentAlerts} onToggle={handleToggleAssignmentAlerts} />
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <View style={styles.sectionCard}>
            {isWriter && <>
                <SettingToggle 
                  innerRef={profileToggleRef}
                  onLayout={measureTour}
                  icon={<Eye color={Colors.primary} size={18} strokeWidth={2} />} 
                  iconBg={Colors.primarySoft} 
                  title="Public Profile" 
                  subtitle="Let others see your profile" 
                  value={showProfile} 
                  onToggle={handleTogglePublicProfile} 
                />
                <View style={styles.settingDivider} />
              </>}
            <SettingLink icon={<Lock color={Colors.textSecondary} size={18} strokeWidth={2} />} iconBg={Colors.overlayLight} title="Change Password" subtitle="Verify your email code and set a new password" onPress={startPasswordReset} />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionCard}>
            <View style={styles.themeSelectorRow}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primarySoft }]}>
                <Moon color={Colors.primary} size={18} strokeWidth={2} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Theme</Text>
                <Text style={styles.settingSubtitle}>Choose your preferred look</Text>
              </View>
            </View>
            <View style={styles.themeOptions}>
              {(['system', 'light', 'dark'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  activeOpacity={0.7}
                  style={[
                    styles.themeOption,
                    useUserStore.getState().theme === t && { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }
                  ]}
                  onPress={() => useUserStore.getState().setTheme(t)}
                >
                  <Text style={[
                    styles.themeOptionText,
                    useUserStore.getState().theme === t && { color: Colors.primary, fontWeight: '700' }
                  ]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* General */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.sectionCard}>
            <SettingLink 
              icon={<FileText color={Colors.textSecondary} size={18} strokeWidth={2} />} 
              iconBg={Colors.overlayLight} 
              title="Terms of Service" 
              onPress={() => router.push('/terms')} 
            />
            <View style={styles.settingDivider} />
            <SettingLink 
              icon={<Shield color={Colors.textSecondary} size={18} strokeWidth={2} />} 
              iconBg={Colors.overlayLight} 
              title="Privacy Policy" 
              onPress={() => router.push('/privacy')} 
            />
            <View style={styles.settingDivider} />
            <SettingLink 
              icon={<RefreshCcw color={Colors.textSecondary} size={18} strokeWidth={2} />} 
              iconBg={Colors.overlayLight} 
              title="Return Policy" 
              onPress={() => router.push('/returns')} 
            />
            <View style={styles.settingDivider} />
            <SettingLink 
              icon={<Info color={Colors.info} size={18} strokeWidth={2} />} 
              iconBg={Colors.infoSoft} 
              title="App Version" 
              value="1.0.1" 
              onPress={() => {}} 
            />
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {
          color: Colors.error
        }]}>Account Actions</Text>
          <View style={[styles.sectionCard, {
          borderColor: Colors.errorSoft
        }]}>
            <SettingLink icon={<LogOut color={Colors.error} size={18} strokeWidth={2} />} iconBg={Colors.errorSoft} title="Logout" subtitle="Sign out of your account" danger onPress={handleLogout} />
          </View>
        </View>

        <Text style={styles.footerText}>Made with ❤️ for students</Text>
      </ScrollView>

      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalHint}>Enter your current password and choose a new one.</Text>

            <Text style={styles.modalLabel}>Current Password</Text>
            <TextInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={Colors.textTertiary} style={styles.modalInput} secureTextEntry />

            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={Colors.textTertiary} style={styles.modalInput} secureTextEntry />

            <Text style={styles.modalLabel}>Confirm Password</Text>
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={Colors.textTertiary} style={styles.modalInput} secureTextEntry />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowPasswordModal(false)} disabled={isResettingPassword}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleSubmitPasswordReset} disabled={isResettingPassword}>
                {isResettingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryButtonText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <CoachMark
        isVisible={showTour}
        onClose={() => {
          setShowTour(false);
          addCompletedTour(`settings_${role}`);
        }}
        steps={isWriter ? [
          {
            title: "Switch Role",
            message: "Easily transition between Student and Writer modes. You can post assignments or earn by writing anytime!",
            layout: tourLayouts[0]
          },
          {
            title: "Activate Profile",
            message: "Make sure this is ON to be visible in your campus. You need an active profile to receive task invites and earn money!",
            layout: tourLayouts[1]
          }
        ] : [
          {
            title: "Switch Role",
            message: "Easily transition between Student and Writer modes. You can post assignments or earn by writing anytime!",
            layout: tourLayouts[0]
          }
        ]}
      />
    </View>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
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
    borderBottomColor: Colors.borderLight
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  scrollContent: {
    paddingBottom: 120
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden'
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md
  },
  settingContent: {
    flex: 1
  },
  settingTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  settingSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1
  },
  settingValue: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textTertiary,
    marginRight: 4
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 64
  },
  rolePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.full
  },
  rolePillText: {
    fontSize: FontSize.sm,
    fontWeight: '700'
  },
  switchRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg
  },
  switchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md
  },
  switchBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#fff'
  },
  successBanner: {
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent + '30'
  },
  successBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center'
  },
  themeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm
  },
  themeOptions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm
  },
  themeOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated
  },
  themeOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  footerText: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing['3xl'],
    marginBottom: Spacing.xl
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.xl
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs
  },
  modalHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg
  },
  modalLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: Spacing.sm
  },
  modalInput: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl
  },
  modalSecondaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface
  },
  modalSecondaryButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  modalPrimaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    minWidth: 96,
    alignItems: 'center'
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '800'
  }
});