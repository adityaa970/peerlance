import { useTheme } from '../hooks/useTheme';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, TextInput } from 'react-native';
import { useRouter as useExpoRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, XCircle, ArrowLeft, UploadCloud } from 'lucide-react-native';
import { useAuth, useUser } from '@clerk/expo';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useUserStore } from '../store/userStore';
import { apiClient } from '../utils/api';
import { uploadToCloudinary } from '../utils/upload';

export default function ActivateScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useExpoRouter();
  const {
    getToken
  } = useAuth();
  const {
    user: clerkUser
  } = useUser();
  const user = useUserStore();
  const [description, setDescription] = useState('');
  const [showcaseImages, setShowcaseImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handlePickImage = () => {
    Alert.alert('Upload Showcase', 'Choose an option', [{
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
          setShowcaseImages([...showcaseImages, result.assets[0].uri]);
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
          quality: 0.8,
          allowsMultipleSelection: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const newUris = result.assets.map(asset => asset.uri);
          setShowcaseImages([...showcaseImages, ...newUris]);
        }
      }
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const removeImage = (index: number) => {
    const updated = [...showcaseImages];
    updated.splice(index, 1);
    setShowcaseImages(updated);
  };

  // Replaced local mock with actual upload utility

  const handleActivate = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please enter a description about yourself or your handwriting skills.');
      return;
    }
    if (showcaseImages.length === 0) {
      Alert.alert('Missing Showcase', 'Please upload at least one image of your handwriting.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await getToken();

      // Upload images to Cloudinary First
      const uploadedUrls = await Promise.all(
        showcaseImages.map(uri => uploadToCloudinary(uri))
      );
      // Filter out any failed uploads (nulls)
      const finalShowcaseUrls = uploadedUrls.filter(url => url) as string[];

      const response = await apiClient.patch(`/users/${clerkUser?.id}`, {
        description: description.trim(),
        showcaseUrls: finalShowcaseUrls,
        isActive: true // You can make this 'true' immediately, or keep false to require admin approval
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const result = response.data;
      if (!result.success) throw new Error(result?.error || 'Failed to activate');
      user.login({
        isActive: true
      });
      Alert.alert('Success', 'Your account has been activated!', [{
        text: 'OK',
        onPress: () => router.back()
      }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft color={Colors.textPrimary} size={24} />
            </TouchableOpacity>
            <Text style={styles.title}>Activate Account</Text>
            <View style={{
            width: 24
          }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            
            <View style={styles.infoCard}>
              <UploadCloud color={Colors.primary} size={32} />
              <Text style={styles.infoTitle}>Become an Active Tasker</Text>
              <Text style={styles.infoDesc}>Update your description and upload samples of your handwriting or recent assignments to verify your skills.</Text>
            </View>

            {/* Description */}
            <Text style={styles.sectionTitle}>About You / Strategy</Text>
            <View style={styles.inputWrapper}>
              <TextInput placeholder="Briefly describe your handwriting style or subjects you excel at..." placeholderTextColor={Colors.textTertiary} value={description} onChangeText={setDescription} multiline style={styles.textArea} />
            </View>

            {/* Showcase Images */}
            <Text style={styles.sectionTitle}>Handwriting Showcase</Text>
            <View style={styles.imagesGrid}>
              {showcaseImages.map((uri, index) => <View key={index} style={styles.imageWrapper}>
                  <Image source={{
                uri
              }} style={styles.showcaseImage} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(index)}>
                    <XCircle color={Colors.error} size={20} fill={Colors.surface} />
                  </TouchableOpacity>
                </View>)}

              {showcaseImages.length < 3 && <TouchableOpacity style={styles.addImgBtn} onPress={handlePickImage} activeOpacity={0.7}>
                  <Camera color={Colors.textTertiary} size={24} />
                  <Text style={styles.addImgText}>Add Photo</Text>
                </TouchableOpacity>}
            </View>
            <Text style={styles.hint}>Upload up to 3 samples (.jpg, .png)</Text>

            <View style={styles.footer}>
              <Button title="Activate Account" onPress={handleActivate} isLoading={isSubmitting} disabled={isSubmitting} />
            </View>

          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  inner: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl
  },
  infoCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primaryGlow
  },
  infoTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: Spacing.sm,
    marginBottom: 4
  },
  infoDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md
  },
  inputWrapper: {
    marginBottom: Spacing.md
  },
  textArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    overflow: 'visible',
    position: 'relative'
  },
  showcaseImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated
  },
  removeImgBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 10
  },
  addImgBtn: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs
  },
  addImgText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm
  },
  footer: {
    marginTop: Spacing['2xl'],
    marginBottom: Spacing['2xl']
  }
});