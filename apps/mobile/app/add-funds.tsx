import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Clipboard, Platform, Linking } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, Upload, CheckCircle, Copy, Info } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';
import { uploadToCloudinary } from '../utils/upload';

const ADMIN_UPI_ID = "amit-4842@ptaxis";

const getQRUrl = (amount: string) => {
  const upiLink = `upi://pay?pa=${ADMIN_UPI_ID}&pn=peerlance&am=${amount || '0'}&cu=INR`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
};

export default function AddFundsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setScreenshot(result.assets[0].uri);
    }
  };

  const handleCopyUPI = () => {
    Clipboard.setString(ADMIN_UPI_ID);
    Alert.alert('Copied', 'UPI ID copied to clipboard');
  };

  const handlePayDirect = async () => {
    const upiLink = `upi://pay?pa=${ADMIN_UPI_ID}&pn=peerlance&am=${amount}&cu=INR`;
    try {
      const supported = await Linking.canOpenURL(upiLink);
      if (supported) {
        await Linking.openURL(upiLink);
      } else {
        Alert.alert(
          'No UPI App Found',
          'We couldn\'t find any UPI apps installed on this device. Please scan the QR code or copy the UPI ID manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to open UPI link:', error);
      Alert.alert('Error', 'Something went wrong while trying to open the UPI app.');
    }
  };

  const handleSubmit = async () => {
    if (!screenshot) {
      Alert.alert('Missing Proof', 'Please upload a screenshot of your successful payment.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Upload screenshot to Cloudinary
      const imageUrl = await uploadToCloudinary(screenshot);
      
      // 2. Create deposit request
      const response = await apiClient.post('/wallet/deposit', {
        amount: parseFloat(amount),
        screenshotUrl: imageUrl,
        transactionId: transactionId.trim() || undefined
      });

      if (response.data.success) {
        setStep(4); // Success step
      } else {
        throw new Error(response.data.error || 'Failed to submit request');
      }
    } catch (error: any) {
      Alert.alert('Submission Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 4) {
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <CheckCircle color={Colors.accent} size={80} />
          </View>
          <Text style={styles.successTitle}>Successfully Submitted!</Text>
          <Text style={styles.successText}>
            We've received your deposit request. Our team will verify the payment and update your balance within 1-2 hours.
          </Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.replace('/wallet')}
          >
            <Text style={styles.primaryButtonText}>Go to Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Step Indicator */}
        <View style={styles.stepContainer}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepWrapper}>
              <View style={[styles.stepDot, step >= s ? styles.stepDotActive : null]}>
                <Text style={[styles.stepNumber, step >= s ? styles.stepNumberActive : null]}>{s}</Text>
              </View>
              {s < 3 && <View style={[styles.stepLine, step > s ? styles.stepLineActive : null]} />}
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>How much do you want to add?</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
            <View style={styles.quickAmounts}>
              {['100', '200', '500', '1000'].map((amt) => (
                <TouchableOpacity 
                  key={amt} 
                  style={styles.quickAmtBtn}
                  onPress={() => setAmount(amt)}
                >
                  <Text style={styles.quickAmtText}>+ ₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity 
              style={[styles.primaryButton, !amount && styles.disabledButton]}
              onPress={() => amount && setStep(2)}
              disabled={!amount}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Pay ₹{amount} via UPI QR</Text>
            <View style={styles.qrContainer}>
              <Image source={{ uri: getQRUrl(amount) }} style={styles.qrImage} />
              <TouchableOpacity style={styles.upiIdRow} onPress={handleCopyUPI}>
                <Text style={styles.upiIdText}>{ADMIN_UPI_ID}</Text>
                <Copy size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.instructionContainer}>
              <Info size={20} color={Colors.primary} />
              <Text style={styles.instructionText}>
                Transfer ₹{amount} to the UPI ID above and keep a screenshot of the confirmation page.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, { marginBottom: 12, backgroundColor: Colors.accent }]}
              onPress={handlePayDirect}
            >
              <Text style={styles.primaryButtonText}>Pay with Any UPI App</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => setStep(3)}
            >
              <Text style={styles.secondaryButtonText}>I've made the payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Upload Payment Screenshot</Text>
            <TouchableOpacity style={styles.uploadArea} onPress={handlePickImage}>
              {screenshot ? (
                <Image source={{ uri: screenshot }} style={styles.previewImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Camera size={40} color={Colors.textTertiary} />
                  <Text style={styles.uploadText}>Tap to select screenshot</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Transaction ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 123456789012"
              placeholderTextColor={Colors.textTertiary}
              value={transactionId}
              onChangeText={setTransactionId}
            />

            <TouchableOpacity 
              style={[styles.primaryButton, (!screenshot || loading) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={!screenshot || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Upload size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Submit for Verification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollContent: {
    padding: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingVertical: 10,
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 40,
  },
  quickAmtBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickAmtText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sectionLabel: {
    fontSize: 14,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  qrHint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
    marginTop: 12,
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  upiIdText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  instructionContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 40,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  uploadArea: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 12,
    color: Colors.textTertiary,
    fontSize: 14,
  },
  input: {
    backgroundColor: Colors.surface,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 40,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  }
});
