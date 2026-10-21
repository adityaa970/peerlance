import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Keyboard, Animated, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MailCheck, ArrowRight, RefreshCcw } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { Spacing, Radius, FontSize } from '../../constants/Colors';
import { useSignUp, useClerk } from '@clerk/expo';
import { verifyIdCard } from '../../utils/idVerification';

export default function VerifyEmailScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const { idCardUri } = useLocalSearchParams<{ idCardUri?: string }>();
  const { signUp } = useSignUp();
  const { setActive } = useClerk();
  
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Mount animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
    
    // Auto-focus the hidden input shortly after mounting
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
  }, []);

  // Runs once the new session exists. If the user added an ID card at sign-up, upload
  // and verify it now (those endpoints need a signed-in user). Clerk calls this before
  // the app-wide session updates, so use the new session's token directly.
  const onSessionReady = async ({ session }: { session: { getToken: () => Promise<string | null> } }) => {
    if (idCardUri) {
      try {
        const token = await session.getToken();
        const result = await verifyIdCard(idCardUri, token);
        if (!result.passed) {
          Alert.alert(
            'Account created, ID not verified',
            `${result.reason}\n\nYou can verify your ID later from the withdraw screen.`
          );
        }
      } catch (e) {
        console.error('ID verification after sign-up failed:', e);
        Alert.alert(
          'Account created',
          'We could not verify your ID card right now. You can try again later from the withdraw screen.'
        );
      }
    }
    router.replace('/(tabs)');
  };

  const handleVerify = async () => {
    if (!signUp) {
      Alert.alert('Session Expired', 'We could not locate your registration session. Please sign up again.');
      return;
    }
    if (code.length < 6) {
      Alert.alert('Incomplete Code', 'Please enter the fully 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    Keyboard.dismiss();
    
    try {
      await (signUp.verifications as any).verifyEmailCode({ code });
      
      if (signUp.status === 'complete') {
        if (typeof signUp.finalize === 'function') {
          await signUp.finalize({ navigate: onSessionReady } as any);
        } else if (signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId, navigate: onSessionReady } as any);
        } else {
          router.replace('/(tabs)');
        }
      } else {
        Alert.alert('Incomplete', `Missing requirements: ${signUp.missingFields?.join(', ') || 'Contact Support'}`);
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'An error occurred';
      Alert.alert('Verification Failed', msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    setIsResending(true);
    try {
      await (signUp.verifications as any).sendEmailCode();
      Alert.alert('Sent!', 'A fresh code is zooming to your inbox.');
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'An error occurred';
      Alert.alert('Resend Failed', msg);
    } finally {
      setIsResending(false);
    }
  };

  const codeDigits = code.split('');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* Stunning Icon Header */}
          <View style={styles.iconContainer}>
            <View style={styles.iconGlowBase} />
            <View style={styles.iconGlowTop} />
            <View style={styles.iconCircle}>
              <MailCheck color={Colors.textInverse} size={42} strokeWidth={2} />
            </View>
          </View>
          
          {/* Title & Copy */}
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.description}>
            We just fired off a 6-digit security code to your college email. 
            Enter it below to authenticate your identity.
          </Text>

          {/* Custom Segmented OTP Input */}
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.otpWrapper} 
            onPress={() => inputRef.current?.focus()}
          >
            {Array(6).fill(0).map((_, index) => {
              const isFilled = index < code.length;
              const isFocused = index === code.length;
              
              return (
                <View 
                  key={index} 
                  style={[
                    styles.codeBox, 
                    isFilled && styles.codeBoxFilled,
                    isFocused && styles.codeBoxFocused,
                  ]}
                >
                  <Text style={[styles.codeText, isFilled && styles.codeTextFilled]}>
                    {codeDigits[index] || ''}
                  </Text>
                </View>
              );
            })}
            
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              caretHidden={true}
            />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.verifyTrigger, code.length === 6 && !isVerifying ? styles.verifyTriggerReady : {}]}
              activeOpacity={0.8}
              onPress={handleVerify}
              disabled={code.length < 6 || isVerifying}
            >
              <Text style={[styles.verifyTriggerText, code.length === 6 && styles.verifyTriggerTextReady]}>
                {isVerifying ? 'Verifying...' : 'Authenticate'}
              </Text>
              {!isVerifying && (
                <ArrowRight color={code.length === 6 ? '#000000' : Colors.textTertiary} size={20} />
              )}
            </TouchableOpacity>
          </View>

          {/* Resend Footer */}
          <TouchableOpacity 
            style={styles.resendLink} 
            onPress={handleResend} 
            disabled={isResending}
            activeOpacity={0.7}
          >
            <RefreshCcw color={Colors.textTertiary} size={14} />
            <Text style={styles.resendText}>
              {isResending ? 'Sending...' : 'Did not receive it? Resend code'}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Icon Glam ────────────────────────
  iconContainer: {
    marginBottom: Spacing['3xl'],
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlowBase: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
    opacity: 0.8,
  },
  iconGlowTop: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryGlow,
    top: 15,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },

  // ── Text & Typography ─────────────────
  title: {
    fontSize: FontSize['4xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    letterSpacing: -1,
  },
  description: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: Spacing.md,
  },

  // ── OTP Segmented UI ──────────────────
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 44,
    position: 'relative',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
    transform: [{ scale: 1.05 }],
  },
  codeBoxFilled: {
    borderColor: Colors.textSecondary,
    backgroundColor: Colors.surfaceElevated,
  },
  codeText: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  codeTextFilled: {
    color: Colors.textPrimary,
  },

  // ── Actions ───────────────────────────
  buttonContainer: {
    width: '100%',
    marginBottom: Spacing['2xl'],
  },
  verifyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    height: 60,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verifyTriggerReady: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  verifyTriggerText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  verifyTriggerTextReady: {
    color: '#000000',
  },

  resendLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
  },
  resendText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
});