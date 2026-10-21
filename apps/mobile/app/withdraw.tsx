import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, Smartphone, Landmark, Send, Info, AlertTriangle } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';
import { useUserStore } from '../store/userStore';
import * as ImagePicker from 'expo-image-picker';
import { verifyIdCard } from '../utils/idVerification';
import { Camera, CheckCircle2, Shield, Upload } from 'lucide-react-native';
import { useUser } from '@clerk/expo';

export default function WithdrawScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const user = useUserStore();

  const { user: clerkUser } = useUser();
  const [step, setStep] = useState(1);
  const [idStep, setIdStep] = useState(false);
  const [tempIdCardUri, setTempIdCardUri] = useState('');
  const [isIdVerified, setIsIdVerified] = useState(false);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'UPI' | 'BANK'>('UPI');
  
  // UPI details
  const [upiId, setUpiId] = useState('');
  
  // Bank details
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  const [loading, setLoading] = useState(false);

  const handleIdUpload = async () => {
    Alert.alert('📸 Upload ID Card', 'Choose a method to upload your college ID card for verification.', [{
      text: 'Take Photo',
      onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
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
          setTempIdCardUri(result.assets[0].uri);
        }
      }
    }, {
      text: 'Choose from Gallery',
      onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
          setTempIdCardUri(result.assets[0].uri);
        }
      }
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };

  const handleVerifyAndProceed = async () => {
    if (!tempIdCardUri) {
      Alert.alert('ID Required', 'Please upload your ID card first.');
      return;
    }
    if (!clerkUser) return;

    try {
      setIsUploadingId(true);
      // Uploads the photo and runs the AI check. On success the backend saves the
      // ID card to the profile and marks the account verified.
      const result = await verifyIdCard(tempIdCardUri);
      if (!result.passed) {
        Alert.alert('ID Verification Failed', result.reason);
        setIsUploadingId(false);
        return;
      }
      const uploadedUrl = result.idCardUrl;
      
      await clerkUser.update({
        unsafeMetadata: {
          ...(clerkUser.unsafeMetadata as any),
          idCardUrl: uploadedUrl
        }
      });

      user.login({ idCardUrl: uploadedUrl });
      setIsIdVerified(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
    } finally {
      setIsUploadingId(false);
    }
  };

  const validateStep1 = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return false;
    }
    if (amt > user.earnedBalance) {
      Alert.alert('Withdrawable Balance Only', 'You can only withdraw money earned from assignments or referrals. Current profit: ₹' + user.earnedBalance);
      return false;
    }
    if (amt < 50) {
      Alert.alert('Minimum Withdrawal', 'The minimum withdrawal amount is ₹50.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    // Basic validation for Step 3
    if (method === 'UPI') {
      if (!upiId.includes('@')) {
        Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@bank)');
        return;
      }
    } else {
      if (!accountName || !accountNumber || !ifsc) {
        Alert.alert('Missing Details', 'Please fill in all bank account details.');
        return;
      }
    }

    try {
      setLoading(true);
      
      const payload = {
        amount: parseFloat(amount),
        method,
        details: method === 'UPI' 
          ? { upiId } 
          : { accountName, accountNumber, ifsc, bankName }
      };

      const response = await apiClient.post('/wallet/withdraw', payload);

      if (response.data.success) {
        // Refresh balance in store
        const newEarnedBalance = user.earnedBalance - parseFloat(amount);
        const newTotalBalance = user.walletBalance - parseFloat(amount);
        user.login({ 
          earnedBalance: newEarnedBalance,
          walletBalance: newTotalBalance 
        });
        setStep(4); // Success step
      } else {
        throw new Error(response.data.error || 'Failed to submit request');
      }
    } catch (error: any) {
      Alert.alert('Request Failed', error.message || 'Something went wrong. Please try again.');
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
          <Text style={styles.successTitle}>Request Submitted!</Text>
          <Text style={styles.successText}>
            Your withdrawal request for ₹{amount} has been received. Our team will verify and transfer the funds to your {method === 'UPI' ? 'UPI ID' : 'Bank Account'} within 24-48 hours.
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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {(!user.idCardUrl && !isIdVerified) ? (
          <View style={styles.stepContent}>
            <Text style={styles.label}>ID Verification Required</Text>
            <Text style={styles.infoText}>To keep Peerlance safe, we require a one-time college ID verification before your first withdrawal.</Text>
            
            <TouchableOpacity 
              style={[styles.idUploadCard, tempIdCardUri && styles.idUploadCardDone]} 
              onPress={handleIdUpload} 
              activeOpacity={0.7}
            >
              <View style={styles.idUploadContent}>
                <View style={tempIdCardUri ? styles.idUploadIconDone : styles.idUploadIcon}>
                  {tempIdCardUri ? <CheckCircle2 color={Colors.accent} size={28} /> : <Camera color={Colors.primary} size={28} />}
                </View>
                <View style={styles.idUploadTextContainer}>
                  <Text style={tempIdCardUri ? styles.idUploadTitleDone : styles.idUploadTitle}>
                    {tempIdCardUri ? 'ID Card Selected' : 'Upload ID Card'}
                  </Text>
                  <Text style={styles.idUploadSubtitle}>
                    {tempIdCardUri ? 'Tap to change photo' : 'Required for first withdrawal'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryButton, (!tempIdCardUri || isUploadingId) && styles.disabledButton]}
              onPress={handleVerifyAndProceed}
              disabled={!tempIdCardUri || isUploadingId}
            >
              {isUploadingId ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify & Continue</Text>}
            </TouchableOpacity>

            <View style={[styles.infoBox, { marginTop: 20 }]}>
              <Shield color={Colors.primary} size={18} />
              <Text style={styles.infoText}>Your data is secure and used only for verification.</Text>
            </View>
          </View>
        ) : (
          <>
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
            <Text style={styles.label}>Enter Withdrawal Amount</Text>
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
            
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Withdrawable Profit</Text>
              <Text style={styles.balanceValue}>₹{user.earnedBalance.toLocaleString()}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, (!amount || loading) && styles.disabledButton]}
              onPress={handleNext}
              disabled={!amount || loading}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Info size={16} color={Colors.textTertiary} />
              <Text style={styles.infoText}>Min withdrawal: ₹50. Processing time: 24-48 hrs.</Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Select Payout Method</Text>
            
            <TouchableOpacity 
              style={[styles.methodCard, method === 'UPI' && styles.methodCardActive]}
              onPress={() => setMethod('UPI')}
            >
              <View style={[styles.methodIcon, { backgroundColor: Colors.primarySoft }]}>
                <Smartphone color={Colors.primary} size={24} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>UPI Transfer</Text>
                <Text style={styles.methodDesc}>Fast & direct to your UPI ID</Text>
              </View>
              <View style={[styles.radio, method === 'UPI' && styles.radioActive]} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.methodCard, method === 'BANK' && styles.methodCardActive]}
              onPress={() => setMethod('BANK')}
            >
              <View style={[styles.methodIcon, { backgroundColor: Colors.accentSoft }]}>
                <Landmark color={Colors.accent} size={24} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>Bank Account</Text>
                <Text style={styles.methodDesc}>Standard NEFT/IMPS transfer</Text>
              </View>
              <View style={[styles.radio, method === 'BANK' && styles.radioActive]} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>Proceed</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Enter {method} Details</Text>
            
            {method === 'UPI' ? (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>UPI ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. yourname@upi"
                  placeholderTextColor={Colors.textTertiary}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                />
                <View style={styles.warningBox}>
                  <AlertTriangle size={16} color={Colors.warning} />
                  <Text style={styles.warningText}>Ensure your UPI ID is correct. Transfers are irreversible.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <TextInput style={styles.input} placeholder="Full Name" value={accountName} onChangeText={setAccountName} />
                
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput style={styles.input} placeholder="Account Number" keyboardType="numeric" value={accountNumber} onChangeText={setAccountNumber} />
                
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput style={styles.input} placeholder="IFSC Code" autoCapitalize="characters" value={ifsc} onChangeText={setIfsc} />
                
                <Text style={styles.inputLabel}>Bank Name (Optional)</Text>
                <TextInput style={styles.input} placeholder="e.g. SBI, HDFC" value={bankName} onChangeText={setBankName} />
              </View>
            )}

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Send size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Confirm Withdrawal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </>
    )}
  </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    marginBottom: 12,
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
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '700',
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
  disabledButton: {
    opacity: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
    paddingHorizontal: 10,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 12,
  },
  methodCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft + '10',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  methodDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioActive: {
    borderColor: Colors.primary,
    borderWidth: 6,
  },
  form: {
    gap: 16,
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: -8,
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
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.warningSoft,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '600',
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
  },
  idUploadCard: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
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
  }
});
