import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, StatusBar, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Mail, Lock, PenTool, Eye, EyeOff } from 'lucide-react-native';
import { AntDesign } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Spacing, Radius, FontSize } from '../../constants/Colors';
import { useSignIn, useOAuth, useClerk } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
WebBrowser.maybeCompleteAuthSession();
export default function LoginScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    startOAuthFlow: startGoogleFlow
  } = useOAuth({
    strategy: 'oauth_google'
  });

  const handleOAuth = useCallback(async (strategy: 'oauth_google') => {
    try {
      setIsLoading(true);
      const redirectUrl = Linking.createURL('/(auth)/login');
      const {
        createdSessionId,
        setActive,
        signIn,
        signUp
      } = await startGoogleFlow({ redirectUrl });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId
        });
      }
    } catch (err: any) {
      console.log('OAuth error:', err);
      Alert.alert('Sign In Failed', err.message || 'An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleFlow]);
  const handleLogin = async () => {
    console.log('Login button pressed');
    if (!signIn) {
      console.log('Clerk signIn object not available, returning early.');
      return;
    }
    setIsLoading(true);
    try {
      const {
        error
      } = (await signIn.password({
        emailAddress: email,
        password
      })) as any;
      if (error) {
        const msg = error.longMessage || error.message || 'Invalid login credentials.';
        Alert.alert('Sign In Failed', msg);
        return;
      }
      if (signIn.status === 'complete') {
        if (typeof signIn.finalize === 'function') {
          await signIn.finalize({
            navigate: () => router.replace('/(tabs)')
          } as any);
        } else {
          if (signIn.createdSessionId) {
            await setActive({
              session: signIn.createdSessionId
            });
          }
          router.replace('/(tabs)');
        }
      } else {
        console.log('Further action required:', signIn.status);
        Alert.alert('Sign In Failed', 'Incomplete sign in step.');
      }
    } catch (err: any) {
      console.log('Sign in error details:', err);
      const msg = err.errors && err.errors.length > 0 ? err.errors[0].longMessage || err.errors[0].message : err.message || 'An error occurred';
      Alert.alert('Sign In Error', msg);
    } finally {
      setIsLoading(false);
    }
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <PenTool color={Colors.textInverse} size={34} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your Peerlance account</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} icon={<Mail color={Colors.textTertiary} size={20} />} />
            
            <Input label="Password" placeholder="••••••••" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} icon={<Lock color={Colors.textTertiary} size={20} />} rightIcon={<TouchableWithoutFeedback onPress={() => setShowPassword(!showPassword)}>
                  <View style={{
              padding: 4
            }}>
                    {showPassword ? <EyeOff color={Colors.textTertiary} size={20} /> : <Eye color={Colors.textTertiary} size={20} />}
                  </View>
                </TouchableWithoutFeedback>} />

            <Text style={styles.forgotPassword}>Forgot Password?</Text>
            
            <Button title="Sign In" onPress={handleLogin} isLoading={isLoading} style={styles.loginButton} />

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <Button title="Continue with Google" variant="secondary" onPress={() => handleOAuth('oauth_google')} disabled={isLoading} style={styles.googleButton} textStyle={styles.googleButtonText} icon={<AntDesign name="google" size={22} color={Colors.textPrimary} />} />
            

          </View>

          {/* Footer */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Text style={styles.registerText} onPress={() => router.push('/(auth)/register')}>
              Sign Up
            </Text>
          </View>
          
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface
  },
  inner: {
    flex: 1,
    padding: Spacing['2xl'],
    justifyContent: 'space-between'
  },
  headerContainer: {
    marginTop: 60,
    alignItems: 'center'
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 8
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12
  },
  title: {
    fontSize: FontSize['3xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textTertiary
  },
  formContainer: {
    width: '100%',
    marginTop: Spacing.xl
  },
  forgotPassword: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    alignSelf: 'flex-end',
    marginBottom: Spacing['2xl'],
    marginTop: -4
  },
  loginButton: {
    marginTop: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600'
  },
  googleButton: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontWeight: '600'
  },

  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40
  },
  footerText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary
  },
  registerText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary
  }
});