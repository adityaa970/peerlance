import { useTheme } from '../hooks/useTheme';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth, useUser } from '@clerk/expo';
export default function Index() {
  const { colors: Colors } = useTheme();
  const {
    isSignedIn,
    isLoaded
  } = useAuth();
  const {
    user
  } = useUser();
  if (!isLoaded || isSignedIn && !user) {
    return <View style={{
      flex: 1,
      backgroundColor: Colors.background
    }} />;
  }
  if (isSignedIn && user) {
    if (!user.unsafeMetadata.role) {
      return <Redirect href='/complete-profile' />;
    }
    return <Redirect href='/(tabs)' />;
  }
  return <Redirect href='/(auth)/login' />;
}