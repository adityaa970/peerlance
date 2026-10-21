import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { User, Mail, Lock, PenTool, Target, Camera, CheckCircle2, Eye, EyeOff, Search, Building, Upload, Shield, XCircle, Tag } from 'lucide-react-native';
import { AntDesign } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Spacing, Radius, FontSize, UserRole } from '../../constants/Colors';
import { useSignUp, useOAuth } from '@clerk/expo';
import debounce from 'lodash.debounce';
import { apiClient } from '../../utils/api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
WebBrowser.maybeCompleteAuthSession();
type College = {
  id: string | number;
  Name: string;
  State: string;
  District: string;
};
const formatCollegeDisplayName = (collegeName: string) => {
  if (!collegeName) return 'Unknown';
  return collegeName.replace(/[,\-\/()]+/g, ' ').replace(/\b(?:state|district|city|campus|college|institute|technology|and|of|the|for|with|school|university|polytechnic|pharmacy)\b/gi, ' ').replace(/\d+/g, ' ').split(/\s+/).filter(Boolean).map(word => word[0]?.toUpperCase()).join('');
};
export default function RegisterScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const {
    signUp
  } = useSignUp() as any;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setLocalRole] = useState<UserRole | null>(null);
  const [idUploaded, setIdUploaded] = useState(false);
  const [idCardUri, setIdCard] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const {
    startOAuthFlow: startGoogleFlow
  } = useOAuth({
    strategy: 'oauth_google'
  });

  const handleOAuth = useCallback(async (strategy: 'oauth_google') => {
    try {
      setIsLoading(true);
      const redirectUrl = Linking.createURL('/(auth)/register');
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
      Alert.alert('Sign Up Failed', err.message || 'An error occurred during sign up');
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleFlow]);

  // College Selection State
  const [collegeSearch, setCollegeSearch] = useState('');
  const [collegeSuggestions, setCollegeSuggestions] = useState<College[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [isSearchingColleges, setIsSearchingColleges] = useState(false);
  const fetchColleges = async (query: string) => {
    if (query.length < 2) {
      setCollegeSuggestions([]);
      return;
    }
    try {
      setIsSearchingColleges(true);
      const res = await apiClient.get(`/colleges/search?q=${encodeURIComponent(query)}`);
      const data = res.data;
      if (data.colleges) {
        setCollegeSuggestions(data.colleges);
      }
    } catch (err) {
      console.log('Error fetching colleges', err);
    } finally {
      setIsSearchingColleges(false);
    }
  };
  const debouncedFetchColleges = useCallback(debounce(fetchColleges, 500), []);
  const handleCollegeSearchChanged = (text: string) => {
    setCollegeSearch(text);
    setSelectedCollege(null);
    debouncedFetchColleges(text);
  };
  const handleIdUpload = async () => {
    Alert.alert('📸 Upload ID Card', 'Choose a method to upload your college ID card for verification.', [{
      text: 'Take Photo',
      onPress: async () => {
        const {
          status
        } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setIdCard(result.assets[0].uri);
          setIdUploaded(true);
        }
      }
    }, {
      text: 'Choose from Gallery',
      onPress: async () => {
        const {
          status
        } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setIdCard(result.assets[0].uri);
          setIdUploaded(true);
        }
      }
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const handleRegister = async () => {
    console.log('Register button pressed');
    console.log('Form State:', {
      name,
      email,
      passwordLength: password.length,
      role,
      idUploaded
    });
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }
    if (!selectedCollege) {
      Alert.alert('Select College', 'Please choose your college from the search suggestions.');
      return;
    }
    if (!role) {
      Alert.alert('Select Role', 'Please choose whether you want to get assignments done or earn by writing.');
      return;
    }
    // ID is now optional during registration - will be required on withdrawal
    console.log('signUp exists:', !!signUp);
    if (!signUp) {
      console.log('Clerk signUp object not available, returning early.');
      return;
    }
    setIsLoading(true);
    try {
      // 1. Validate input fields using Clerk (create account attempt)
      await (signUp as any).create({
        emailAddress: email,
        password,
        firstName: name.split(' ')[0] || '',
        lastName: name.split(' ').slice(1).join(' ') || '',
        unsafeMetadata: {
          role: role,
          collegeId: selectedCollege.id,
          collegeName: selectedCollege.Name,
          referralCode: referralCode.trim().toUpperCase()
        }
      });

      // 2. Send the email code. The optional ID card is uploaded and checked on the
      //    verify-email screen, once the account is signed in: the upload and
      //    verification endpoints require a logged-in user.
      await (signUp.verifications as any).sendEmailCode();
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          email,
          role,
          ...(idCardUri ? { idCardUri } : {})
        }
      });
    } catch (err: any) {
      console.log('Registration error details:', err);
      const msg = err.errors && err.errors.length > 0 ? err.errors[0].longMessage || err.errors[0].message : err.message || 'An error occurred';
      Alert.alert('Registration Error', msg);
    } finally {
      setIsLoading(false);
    }
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.headerContainer}>
            <View style={styles.iconCircle}>
              <PenTool color={Colors.textInverse} size={30} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Join Peerlance</Text>
            <Text style={styles.subtitle}>Assignment help, by students, for students</Text>
          </View>

          <View style={styles.formContainer}>
            <Input label="Full Name" placeholder="Your full name" autoCapitalize="words" value={name} onChangeText={setName} icon={<User color={Colors.textTertiary} size={20} />} />
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} icon={<Mail color={Colors.textTertiary} size={20} />} />
            <Input label="Password" placeholder="Create a strong password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} icon={<Lock color={Colors.textTertiary} size={20} />} rightIcon={<TouchableWithoutFeedback onPress={() => setShowPassword(!showPassword)}>
                  <View style={{
              padding: 4
            }}>
                    {showPassword ? <EyeOff color={Colors.textTertiary} size={20} /> : <Eye color={Colors.textTertiary} size={20} />}
                  </View>
                </TouchableWithoutFeedback>} />

            <View style={{
            zIndex: 100
          }}>
              <Input label="Select College" placeholder="Search your college name..." value={selectedCollege ? formatCollegeDisplayName(selectedCollege.Name) : collegeSearch} onChangeText={handleCollegeSearchChanged} icon={<Building color={Colors.textTertiary} size={20} />} rightIcon={isSearchingColleges ? <ActivityIndicator size="small" color={Colors.primary} /> : collegeSearch.length > 0 || selectedCollege ? <TouchableWithoutFeedback onPress={() => {
              setCollegeSearch('');
              setSelectedCollege(null);
              setCollegeSuggestions([]);
            }}>
                      <View style={{
                padding: 4
              }}>
                        <XCircle color={Colors.textTertiary} size={20} />
                      </View>
                    </TouchableWithoutFeedback> : <Search color={Colors.textTertiary} size={20} />} />

              {selectedCollege || collegeSuggestions.length === 0 ? null : <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {collegeSuggestions.slice(0, 5).map(college => <TouchableOpacity key={college.id} style={styles.suggestionItem} onPress={() => {
                setSelectedCollege(college);
                setCollegeSearch(formatCollegeDisplayName(college.Name));
                setCollegeSuggestions([]);
                Keyboard.dismiss();
              }}>
                      <Text style={styles.suggestionName}>{formatCollegeDisplayName(college.Name)}</Text>
                      <Text style={styles.suggestionLocation}>{college.Name}</Text>
                    </TouchableOpacity>)}
                </ScrollView>}
            </View>

            <Input label="Referral Code (Optional)" placeholder="Enter code if someone referred you" autoCapitalize="characters" value={referralCode} onChangeText={setReferralCode} icon={<Tag color={Colors.textTertiary} size={20} />} />

            <Text style={styles.roleLabel}>I want to...</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleCard, role === 'poster' && styles.roleCardActive, role === 'poster' && {
              borderColor: Colors.primary
            }]} onPress={() => setLocalRole('poster')} activeOpacity={0.7}>
                <View style={[styles.roleIconBg, {
                backgroundColor: role === 'poster' ? Colors.primarySoft : Colors.overlayLight
              }]}>
                  <Target color={role === 'poster' ? Colors.primary : Colors.textTertiary} size={28} strokeWidth={1.8} />
                </View>
                <Text style={[styles.roleTitle, role === 'poster' && {
                color: Colors.primary
              }]}>Find a Writer</Text>
                <Text style={styles.roleDesc}>Post assignments{'\n'}& get them written</Text>
                {role === 'poster' ? <View style={styles.roleCheck}>
                    <View style={styles.roleCheckInner} />
                  </View> : null}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.roleCard, role === 'writer' && styles.roleCardActive, role === 'writer' && {
              borderColor: Colors.accent
            }]} onPress={() => setLocalRole('writer')} activeOpacity={0.7}>
                <View style={[styles.roleIconBg, {
                backgroundColor: role === 'writer' ? Colors.accentSoft : Colors.overlayLight
              }]}>
                  <PenTool color={role === 'writer' ? Colors.accent : Colors.textTertiary} size={28} strokeWidth={1.8} />
                </View>
                <Text style={[styles.roleTitle, role === 'writer' && {
                color: Colors.accent
              }]}>Become a Writer</Text>
                <Text style={styles.roleDesc}>Write assignments{'\n'}& earn ₹5–₹10/page</Text>
                {role === 'writer' ? <View style={[styles.roleCheck, {
                backgroundColor: Colors.accent
              }]}>
                    <View style={styles.roleCheckInner} />
                  </View> : null}
              </TouchableOpacity>
            </View>

            <Text style={styles.roleLabel}>College ID Verification (Optional)</Text>

            <TouchableOpacity style={[styles.idUploadCard, idUploaded && styles.idUploadCardDone]} onPress={handleIdUpload} activeOpacity={0.7}>
              {idUploaded ? <View style={styles.idUploadContent}>
                  <View style={styles.idUploadIconDone}>
                    <CheckCircle2 color={Colors.accent} size={32} strokeWidth={2} />
                  </View>
                  <View style={styles.idUploadTextContainer}>
                    <Text style={styles.idUploadTitleDone}>ID Card Uploaded ✓</Text>
                    <Text style={styles.idUploadSubtitle}>Tap to change photo</Text>
                  </View>
                </View> : <View style={styles.idUploadContent}>
                  <View style={styles.idUploadIcon}>
                    <Camera color={Colors.primary} size={28} strokeWidth={1.8} />
                  </View>
                  <View style={styles.idUploadTextContainer}>
                    <Text style={styles.idUploadTitle}>Upload College ID Card</Text>
                    <Text style={styles.idUploadSubtitle}>Take a photo or choose from gallery</Text>
                  </View>
                  <Upload color={Colors.textTertiary} size={20} strokeWidth={2} />
                </View>}
            </TouchableOpacity>

            <View style={styles.idInfoBox}>
              <Shield color={Colors.primary} size={14} strokeWidth={2} />
              <Text style={styles.idInfoText}>ID verification is required before your first withdrawal. You can skip this for now.</Text>
            </View>

            <Button title="Create Account" onPress={handleRegister} isLoading={isLoading} disabled={!role || !name || !email || !password} style={styles.registerButton} />

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <Button title="Continue with Google" variant="secondary" onPress={() => handleOAuth('oauth_google')} disabled={isLoading} style={styles.googleButton} textStyle={styles.googleButtonText} icon={<AntDesign name="google" size={22} color={Colors.textPrimary} />} />
            

          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text style={styles.loginText} onPress={() => router.push('/(auth)/login')}>Sign In</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  suggestionsContainer: {
    backgroundColor: Colors.surfaceElevated,
    // use elevated card for contrast
    borderWidth: 1,
    borderColor: Colors.borderFocus,
    // give it a distinct glow or color
    borderRadius: Radius.md,
    marginTop: -12,
    marginBottom: Spacing.md,
    maxHeight: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000
  },
  suggestionItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  suggestionName: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    // This forces it to be bright and legible
    fontWeight: '600'
  },
  suggestionLocation: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 4
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface
  },
  scrollContent: {
    flexGrow: 1
  },
  inner: {
    flex: 1,
    padding: Spacing['2xl'],
    justifyContent: 'space-between'
  },
  headerContainer: {
    marginTop: 28,
    alignItems: 'center'
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center'
  },
  formContainer: {
    width: '100%',
    marginTop: Spacing.lg
  },
  roleLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    position: 'relative'
  },
  roleCardActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  roleIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  roleTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs
  },
  roleDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  roleCheckInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0B0F19'
  },
  // ID Card Upload
  idUploadCard: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background
  },
  idUploadCardDone: {
    borderColor: Colors.accent,
    borderStyle: 'solid',
    backgroundColor: Colors.accentSoft
  },
  idUploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md
  },
  idUploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  idUploadIconDone: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  idUploadTextContainer: {
    flex: 1
  },
  idUploadTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2
  },
  idUploadTitleDone: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 2
  },
  idUploadSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary
  },
  idInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl
  },
  idInfoText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    lineHeight: 18,
    fontWeight: '500'
  },
  registerButton: {
    marginTop: Spacing.xs,
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
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg
  },
  footerText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary
  },
  loginText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary
  }
});