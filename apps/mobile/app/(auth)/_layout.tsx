import { useTheme } from '@/hooks/useTheme';
import { Stack, Redirect } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
export default function AuthLayout() {
  const { colors: Colors } = useTheme();
  const {
    isSignedIn,
    isLoaded
  } = useAuth();
  const {
    user
  } = useUser();
  if (!isLoaded) {
    return null;
  }
  if (isSignedIn && user) {
    if (!user.unsafeMetadata.role) {
      return <Redirect href="/complete-profile" />;
    }
    return <Redirect href="/(tabs)" />;
  }
  return <Stack screenOptions={{
    headerShown: false,
    contentStyle: {
      backgroundColor: Colors.background
    }
  }} />;
}