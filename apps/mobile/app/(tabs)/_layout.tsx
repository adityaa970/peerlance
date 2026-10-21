import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Tabs, Redirect } from 'expo-router';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Plus, ClipboardList, User as UserIcon, Settings } from 'lucide-react-native';
import { useUserStore } from '../../store/userStore';
import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useRef } from 'react';

export default function TabLayout() {
  const { colors: Colors } = useTheme();
  const { user: clerkUser } = useUser();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(Colors, insets), [Colors, insets]);
  const role = useUserStore(s => s.role);
  const email = useUserStore(s => s.email);
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const {
    isSignedIn,
    isLoaded,
    getToken
  } = useAuth();
  const hasSynced = useRef(false);
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasSynced.current) {
      hasSynced.current = true;
      getToken().then(token => {
        if (!token) {
          hasSynced.current = false; // allow retry if token was null
          return;
        }
        const metadata = (clerkUser?.unsafeMetadata || {}) as Record<string, any>;
        
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            referralCode: metadata.referralCode
          })
        }).then(async res => {
          const text = await res.text();
          if (!res.ok) {
            hasSynced.current = false; // allow retry on error
            throw new Error(text);
          }
          return JSON.parse(text);
        }).then(data => {
          // Sync happens in the background natively now to refresh walletBalance, etc.
          // Removed the console.log spam
          if (data?.user) {
            useUserStore.getState().login({
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role || 'poster',
              college: data.user.college,
              walletBalance: data.user.walletBalance || 0,
              earnedBalance: data.user.earnedBalance || 0,
              promoBalance: data.user.promoBalance || 0,
              district: data.user.district || null,
              ...(data.user.taskScope ? { taskScope: data.user.taskScope } : {}),
              referralCode: data.user.referralCode || null,
              isVerified: data.user.isVerified || false,
              isActive: data.user.isActive || false,
              isPublicProfile: data.user.isPublicProfile ?? true,
              trustScore: data.user.trustScore || 100,
              assignmentsCompleted: data.user.totalCompleted || 0,
              avatarInitial: data.user.name ? data.user.name.charAt(0).toUpperCase() : 'U',
              avatarUrl: data.user.avatarUrl || null,
              idCardUrl: data.user.idCardUrl || null,
              pushNotificationsEnabled: data.user.pushNotificationsEnabled ?? true,
              assignmentAlertsEnabled: data.user.assignmentAlertsEnabled ?? true
            });
          }
        }).catch(err => {
          // Ignore sync errors gracefully
        });
      });
    }
  }, [isLoaded, isSignedIn, getToken]);
  if (!isLoaded || isSignedIn && !isLoggedIn) {
    return <View style={{
      flex: 1,
      backgroundColor: Colors.background,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>;
  }
  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }
  // Redirect admin users to the admin panel
  const isAdmin = role === 'admin' || email === 'adityak.writer@gmail.com';
  if (isAdmin) {
    return <Redirect href="/(admin)" />;
  }
  const isWriter = role === 'writer';
  const tabIcon = (Icon: typeof Home) => ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Icon color={color} size={21} strokeWidth={focused ? 2.4 : 1.8} />
    </View>
  );
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarStyle: styles.tabBar,
    tabBarActiveTintColor: Colors.tabBarActive,
    tabBarInactiveTintColor: Colors.tabBarInactive,
    tabBarLabelStyle: styles.tabLabel,
    tabBarItemStyle: styles.tabItem,
    sceneStyle: { backgroundColor: Colors.background }
  }}>
      <Tabs.Screen name="index" options={{
      title: isWriter ? 'Browse' : 'Home',
      tabBarIcon: tabIcon(Home)
    }} />
      <Tabs.Screen name="my-tasks" options={{
      title: 'My Work',
      tabBarIcon: tabIcon(ClipboardList)
    }} />
      <Tabs.Screen name="post" options={{
      title: 'Post',
      // Hide Post tab for writers — only posters can post assignments
      href: isWriter ? null : '/(tabs)/post',
      tabBarIcon: ({ focused }) => (
        <View style={[styles.postButton, focused && styles.postButtonActive]}>
          <Plus color={Colors.textInverse} size={22} strokeWidth={2.6} />
        </View>
      )
    }} />
      <Tabs.Screen name="profile" options={{
      title: 'Profile',
      tabBarIcon: tabIcon(UserIcon)
    }} />
      <Tabs.Screen name="settings" options={{
      title: 'Settings',
      tabBarIcon: tabIcon(Settings)
    }} />
    </Tabs>;
}
const createStyles = (Colors: any, insets: any) => StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBarBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    height: Platform.OS === 'ios' ? (88 + Math.max(0, insets.bottom - 20)) : (68 + insets.bottom),
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? Math.max(28, insets.bottom + 4) : Math.max(10, insets.bottom),
    elevation: 20,
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: -4
    },
    shadowOpacity: 0.06,
    shadowRadius: 12
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3
  },
  tabItem: {
    paddingTop: 2
  },
  iconWrapper: {
    width: 48,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconWrapperActive: {
    backgroundColor: Colors.primarySoft
  },
  postButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    marginTop: -14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.tabBarBackground,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  postButtonActive: {
    backgroundColor: Colors.primaryDark
  }
});