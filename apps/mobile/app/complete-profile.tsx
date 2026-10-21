import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { User, Mail, PenTool, Target, Camera, CheckCircle2, Search, Building, Shield, XCircle, Tag } from 'lucide-react-native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Spacing, Radius, FontSize, UserRole } from '../constants/Colors';
import { useUser, useAuth } from '@clerk/expo';
import { verifyIdCard } from '../utils/idVerification';
import debounce from 'lodash.debounce';
import { apiClient } from '../utils/api';
import { LogOut, ArrowLeft } from 'lucide-react-native';
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
export default function CompleteProfileScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const {
    user
  } = useUser();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [role, setLocalRole] = useState<UserRole | null>(null);
  const [idUploaded, setIdUploaded] = useState(false);
  const [idCardUri, setIdCard] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');

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
    } catch (err: any) {
      // Just drop the error to not disrupt UX gracefully
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
    Alert.alert('📸 Upload ID Card', 'Choose a method to upload your college ID card.', [{
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
  const handleComplete = async () => {
    if (!selectedCollege) {
      Alert.alert('Select College', 'Please choose your college from the search suggestions.');
      return;
    }
    if (!role) {
      Alert.alert('Select Role', 'Please choose your role.');
      return;
    }
    // ID is now optional during onboarding
    if (!user) {
      Alert.alert('Error', 'User not found. Please restart the app.');
      return;
    }
    setIsLoading(true);
    try {
      let uploadedUrl = '';
      if (idCardUri) {
        try {
          const result = await verifyIdCard(idCardUri);
          if (!result.passed) {
            Alert.alert(
              'ID Verification Failed',
              `${result.reason}

Please ensure your ID card is clearly visible and try again.`,
              [{ text: 'OK' }]
            );
            setIsLoading(false);
            return;
          }
          uploadedUrl = result.idCardUrl;
        } catch (verificationError) {
          console.error('ID upload/verification error:', verificationError);
          Alert.alert('Verification Error', 'We could not upload or verify your ID card. Please try again.');
          setIsLoading(false);
          return;
        }
      }
      await user.update({
        unsafeMetadata: {
          collegeId: selectedCollege.id,
          collegeName: selectedCollege.Name,
          idCardUrl: uploadedUrl,
          referralCode: referralCode.trim().toUpperCase()
        }
      });
      router.replace('/onboarding');
    } catch (err: any) {
      const msg = err.errors && err.errors.length > 0 ? err.errors[0].longMessage : err.message || 'An error occurred';
      Alert.alert('Update Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('Sign out error:', err);
      Alert.alert('Sign Out Error', 'Unable to sign out. Please try again.');
    }
  };

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>

          <View style={styles.headerContainer}>
            <View style={styles.iconCircle}>
              <Target color={Colors.textInverse} size={32} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Complete Profile</Text>
            <Text style={styles.subtitle}>You're almost there! We need a few details to verify you.</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Role Selection */}
            <Text style={styles.roleLabel}>I want to... (Optional)</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleCard, role === 'poster' && styles.roleCardActive]} onPress={() => setLocalRole('poster')} activeOpacity={0.8}>
                <View style={[styles.roleIconBg, {
                backgroundColor: role === 'poster' ? Colors.primarySoft : Colors.surfaceElevated
              }]}>
                  <PenTool color={role === 'poster' ? Colors.primary : Colors.textTertiary} size={24} />
                </View>
                <Text style={[styles.roleTitle, role === 'poster' && {
                color: Colors.primaryDark
              }]}>Find a Writer</Text>
                <Text style={styles.roleDesc}>Post assignments{'\n'}& get them written</Text>
                {role === 'poster' && <View style={styles.roleCheck}>
                    <View style={styles.roleCheckInner} />
                  </View>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.roleCard, role === 'writer' && styles.roleCardActive]} onPress={() => setLocalRole('writer')} activeOpacity={0.8}>
                <View style={[styles.roleIconBg, {
                backgroundColor: role === 'writer' ? Colors.accentSoft : Colors.surfaceElevated
              }]}>
                  <Target color={role === 'writer' ? Colors.accent : Colors.textTertiary} size={24} />
                </View>
                <Text style={[styles.roleTitle, role === 'writer' && {
                color: Colors.accent
              }]}>Become a Writer</Text>
                <Text style={styles.roleDesc}>Write assignments{'\n'}& earn ₹5–₹10/page</Text>
                {role === 'writer' && <View style={[styles.roleCheck, {
                backgroundColor: Colors.accent
              }]}>
                    <View style={styles.roleCheckInner} />
                  </View>}
              </TouchableOpacity>
            </View>

            {/* College Selection */}
            <View style={{
            zIndex: 999
          }}>
              <Input label="College" placeholder={selectedCollege ? selectedCollege.Name : "Search for your college"} value={selectedCollege ? '' : collegeSearch} onChangeText={handleCollegeSearchChanged} autoCapitalize="words" icon={<Building color={Colors.textTertiary} size={20} />} rightIcon={isSearchingColleges ? <ActivityIndicator size="small" color={Colors.primary} /> : null} />
              
              {selectedCollege && <View style={[styles.suggestionItem, {
              backgroundColor: Colors.primarySoft,
              borderRadius: 8,
              marginBottom: 16,
              marginTop: -8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12
            }]}>
                  <View style={{
                flex: 1
              }}>
                    <Text style={[styles.suggestionName, {
                  color: Colors.primaryDark,
                  fontSize: 13
                }]} numberOfLines={2}>
                      ✓ {selectedCollege.Name}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                setSelectedCollege(null);
                setCollegeSearch('');
                setCollegeSuggestions([]);
              }}>
                    <XCircle color={Colors.primary} size={20} />
                  </TouchableOpacity>
                </View>}

              {!selectedCollege && collegeSuggestions.length > 0 && <View style={styles.suggestionsContainer}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {collegeSuggestions.map(item => <TouchableOpacity key={item.id} style={styles.suggestionItem} onPress={() => {
                  setSelectedCollege(item);
                  setCollegeSearch('');
                  setCollegeSuggestions([]);
                  Keyboard.dismiss();
                }}>
                        <Text style={styles.suggestionName} numberOfLines={2}>{item.Name}</Text>
                        <Text style={styles.suggestionLocation}>{item.District}, {item.State}</Text>
                        <Text style={styles.suggestionLocation} numberOfLines={1}>
                          <Text style={{
                      fontWeight: '700',
                      color: Colors.primaryLight
                    }}>ID: </Text>
                          {formatCollegeDisplayName(item.Name)}
                        </Text>
                      </TouchableOpacity>)}
                  </ScrollView>
                </View>}
            </View>

            {/* ID Card Upload */}
            <Text style={styles.roleLabel}>College ID Verification (Optional)</Text>
            <TouchableOpacity style={[styles.idUploadCard, idUploaded && styles.idUploadCardDone]} onPress={handleIdUpload} activeOpacity={0.7}>
              <View style={styles.idUploadContent}>
                <View style={idUploaded ? styles.idUploadIconDone : styles.idUploadIcon}>
                  {idUploaded ? <CheckCircle2 color={Colors.accent} size={28} /> : <Camera color={Colors.primary} size={28} />}
                </View>
                <View style={styles.idUploadTextContainer}>
                  <Text style={idUploaded ? styles.idUploadTitleDone : styles.idUploadTitle}>
                    {idUploaded ? 'ID Card Uploaded' : 'Upload ID Card'}
                  </Text>
                  <Text style={styles.idUploadSubtitle}>
                    {idUploaded ? 'Tap to change photo' : 'Required for student verification'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {!idUploaded && <View style={styles.idInfoBox}>
                <Shield color={Colors.primary} size={18} />
                <Text style={styles.idInfoText}>
                  ID verification is required before your first withdrawal. You can skip this for now.
                </Text>
              </View>}

            <Input label="Referral Code (Optional)" placeholder="Enter code if someone referred you" autoCapitalize="characters" value={referralCode} onChangeText={setReferralCode} icon={<Tag color={Colors.textTertiary} size={20} />} />

            <Button title="Complete Profile" onPress={handleComplete} isLoading={isLoading} style={styles.registerButton} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topActions, { top: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton} activeOpacity={0.7}>
          <LogOut color={Colors.textTertiary} size={18} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  suggestionsContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderFocus,
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
  topActions: {
    position: 'absolute',
    right: Spacing['2xl'],
    zIndex: 100
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated
  },
  signOutText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600'
  }
});