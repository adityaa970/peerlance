import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Tabs, Redirect } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Users, Wallet, Settings, History } from 'lucide-react-native';
import { useUserStore } from '../../store/userStore';
import { useAuth } from '@clerk/expo';

export default function AdminTabLayout() {
  const { colors: Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(Colors, insets), [Colors, insets]);
  const role = useUserStore(s => s.role);
  const email = useUserStore(s => s.email);
  const { isSignedIn, isLoaded } = useAuth();

  // Only allow admin access
  const isAdmin = role === 'admin' || email === 'adityak.writer@gmail.com';

  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLoaded && !isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        sceneStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <LayoutDashboard color={color} size={22} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <Users color={color} size={22} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="financial-requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <Wallet color={color} size={22} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <History color={color} size={22} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="admin-settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrapper}>
              <Settings color={color} size={22} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="revenue-details"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="deposits"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="withdrawals"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
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
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 2,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
