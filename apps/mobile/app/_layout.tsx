import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Text, StatusBar, LogBox } from 'react-native';
import { PenTool } from 'lucide-react-native';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '../utils/cache';
import { setupApiClient } from '../utils/api';
import { registerForPushNotifications, setupNotificationListeners, initNotificationHandler } from '../utils/notifications';
import { checkForUpdates, AppVersion } from '../services/updateService';
import { UpdateModal } from '../components/UpdateModal';
// Clerk's native Android module creates a NativeEventEmitter without addListener/removeListeners.
// Harmless, but it warns on every launch; mute just those two messages.
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
]);

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file');
}
export function MainLayout() {
  const { colors: Colors, theme } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const {
    getToken
  } = useAuth();
  useEffect(() => {
    // Dynamically wire the axios auth token header
    setupApiClient(() => getToken());
    // Initialize notification handler (safe for Expo Go)
    initNotificationHandler();
  }, [getToken]);

  // Register push notifications once auth is ready
  useEffect(() => {
    registerForPushNotifications(() => getToken());
  }, [getToken]);

  // Set up notification tap listeners
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);
  const [isReady, setIsReady] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const [updateVersion, setUpdateVersion] = useState<AppVersion | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    async function initUpdates() {
      const update = await checkForUpdates();
      if (update) {
        setUpdateVersion(update);
        setShowUpdateModal(true);
      }
    }
    initUpdates();
  }, []);

  useEffect(() => {
    Animated.parallel([Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true
    }), Animated.timing(textOpacity, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true
    })]).start();
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      }).start(() => {
        setIsReady(true);
      });
    }, 1800);
  }, []);
  if (!isReady) {
    return <Animated.View style={[styles.splashContainer, {
      opacity
    }]}>
        <View style={styles.orbOne} />
        <View style={styles.orbTwo} />
        <Animated.View style={[styles.logoShell, {
        transform: [{
          scale
        }]
      }]}>
          <PenTool color={Colors.primary} size={50} strokeWidth={1.8} />
        </Animated.View>
        <Animated.Text style={[styles.splashText, {
        opacity: textOpacity
      }]}>Peerlance</Animated.Text>
        <Animated.Text style={[styles.splashTagline, {
        opacity: textOpacity
      }]}>A sharper campus marketplace</Animated.Text>
      </Animated.View>;
  }
  return <>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
      <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background }
    }}>
        <Stack.Screen name="(auth)" options={{
        animation: 'fade'
      }} />
        <Stack.Screen name="(tabs)" options={{
        animation: 'fade'
      }} />
        <Stack.Screen name="(admin)" options={{
        animation: 'fade'
      }} />
        <Stack.Screen name="task/[id]" options={{
        animation: 'slide_from_right'
      }} />
        <Stack.Screen name="complete-profile" options={{
        animation: 'fade'
      }} />
      </Stack>
      <UpdateModal 
        versionInfo={updateVersion} 
        isVisible={showUpdateModal} 
        onClose={() => setShowUpdateModal(false)} 
      />
    </>;
}
export default function App() {
  const { colors: Colors, theme } = useTheme();

  const navigationTheme = theme === 'dark' ? {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: Colors.background, card: Colors.surface }
  } : {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: Colors.background, card: Colors.surface }
  };

  return <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <ThemeProvider value={navigationTheme}>
          <MainLayout />
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  orbOne: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: Colors.primaryGlow
  },
  orbTwo: {
    position: 'absolute',
    bottom: -50,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: Colors.accentSoft
  },
  logoShell: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: 14
    },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 16
  },
  splashText: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  splashTagline: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    letterSpacing: 0.3
  }
});