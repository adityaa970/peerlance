import { useTheme } from '../../hooks/useTheme';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Alert, KeyboardAvoidingView, ActionSheetIOS, Image, TextInput,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText, BookOpen, IndianRupee, Clock, AlignLeft, Eye,
  Send, Star, CreditCard, Image as ImageIcon, X, HelpCircle,
  Plus, ChevronRight, Info, ShieldCheck, Zap
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  SubjectLabels, SubjectColors, SubjectEmojis, Spacing, Radius, FontSize
} from '../../constants/Colors';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@clerk/expo';
import { useUserStore } from '../../store/userStore';
import { apiClient } from '../../utils/api';
import { scheduleDeadlineReminders } from '../../utils/notifications';
import { CoachMark } from '../../components/CoachMark';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SUBJECTS = [
  'MATH', 'PHYSICS', 'CHEMISTRY', 'COMPUTER_SCIENCE',
  'ENGLISH', 'ECONOMICS', 'HISTORY', 'BIOLOGY', 'OTHER'
];

export default function PostScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const { getToken } = useAuth();
  const user = useUserStore();
  const completedTours = useUserStore(s => s.completedTours);
  const addCompletedTour = useUserStore(s => s.addCompletedTour);
  
  // Tour Refs
  const subjectRef = useRef<View>(null);
  const pricingRef = useRef<View>(null);
  const submitRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [tourLayouts, setTourLayouts] = useState<Record<number, any>>({});
  const [showTour, setShowTour] = useState(false);

  const measureOne = (ref: React.RefObject<View | null>, index: number) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setTourLayouts(prev => ({ ...prev, [index]: { x, y, width, height } }));
      }
    });
  };

  const measureTour = () => {
    measureOne(subjectRef, 0);
    measureOne(pricingRef, 1);
    measureOne(submitRef, 2);
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    const tourId = `post_${user.role}`;
    // Only trigger if logged in, profile is synced, and FOCUSED
    if (isFocused && user.isLoggedIn && user.college !== 'Not specified' && 
        !completedTours.includes(tourId) && 
        tourLayouts[0]) {
      const timer = setTimeout(() => setShowTour(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [completedTours, tourLayouts, user.role, user.isLoggedIn, user.college, isFocused]);

  const [subject, setSubject] = useState('');
  const [pages, setPages] = useState('');
  const [ratePerPage, setRatePerPage] = useState('1');
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [deadline, setDeadline] = useState(new Date(Date.now() + 86400000 * 2)); // Default 2 days later
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<{
    uri: string;
    name: string;
    base64: string;
  }[]>([]);

  // ── Derived Values ──────────────────────
  const totalCost = useMemo(() =>
    pages && ratePerPage ? parseInt(pages) * parseInt(ratePerPage) : 0,
    [pages, ratePerPage]
  );
  const platformFee = useMemo(() => Math.round(totalCost * 0.12), [totalCost]);
  const writerEarns = useMemo(() => totalCost - platformFee, [totalCost, platformFee]);

  const handleSubmit = async () => {
    if (!subject || !pages || !ratePerPage) {
      Alert.alert('Missing Fields', 'Please select a subject and enter pages.');
      return;
    }
    const rate = parseInt(ratePerPage);
    if (isNaN(rate) || rate < 1) {
      Alert.alert('Invalid Rate', 'Minimum rate per page is ₹1.');
      return;
    }
    if (!instructions.trim() && attachments.length === 0) {
      Alert.alert('Details Needed', 'Please add either instructions or a reference file.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await apiClient.post('/tasks', {
        subject,
        pages: parseInt(pages),
        ratePerPage: parseInt(ratePerPage),
        deadline: deadline.toISOString(),
        instructions,
        attachments: attachments.map(a => a.base64),
        college: user.college,
        totalCost,
        platformFee,
        writerEarns
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = response.data;
      if (!data.success) throw new Error(data.error || 'Failed to post task');

      const taskId = data.task?.id || data.id;

      if (taskId) {
        scheduleDeadlineReminders(taskId, `${SubjectLabels[subject]?.replace(/^.+\s/, '') || subject} Assignment`, deadline);
      }

      // Reset Form
      setSubject('');
      setPages('');
      setInstructions('');
      setAttachments([]);
      setDeadline(new Date(Date.now() + 86400000 * 2));

      Alert.alert('✅ Assignment Posted!', `Writers matching ${subject} can now see your task.`, [{
        text: 'View Assignment',
        onPress: () => taskId ? router.push(`/task/${taskId}`) : router.push('/(tabs)')
      }]);
    } catch (e: any) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not post assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Attachment Handling ────────────────
  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newAttachments = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        base64: asset.base64 || ''
      })).filter(a => a.base64);
      setAttachments([...attachments, ...newAttachments]);
    }
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
      handleImageResult(result);
    } else {
      Alert.alert('Permission needed', 'Allow camera access to take pictures.');
    }
  };

  const openImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.7
    });
    handleImageResult(result);
  };

  const openDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets.length > 0) {
        const newAttachments = await Promise.all(result.assets.map(async asset => {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
          return { uri: asset.uri, name: asset.name, base64 };
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const handleAttachPress = () => {
    const options = ['Cancel', 'Take Photo', 'Choose from Library', 'Choose Document'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        options,
        cancelButtonIndex: 0
      }, buttonIndex => {
        if (buttonIndex === 1) openCamera();
        else if (buttonIndex === 2) openImagePicker();
        else if (buttonIndex === 3) openDocumentPicker();
      });
    } else {
      Alert.alert('Add Attachment', 'Choose type:', [
        { text: 'Take Photo', onPress: openCamera },
        { text: 'Library', onPress: openImagePicker },
        { text: 'Document', onPress: openDocumentPicker },
        { text: 'Cancel', style: 'cancel' }
      ]);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Top Navigation ────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View>
            <Text style={styles.topBarTitle}>Create Task</Text>
            <Text style={styles.topBarSubtitle}>Fill in the assignment details</Text>
          </View>
          <TouchableOpacity style={styles.helpBtn} activeOpacity={0.7}>
            <HelpCircle color={Colors.textTertiary} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Form Section: Assignment Basics ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assignment Basics</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Subject</Text>
          <ScrollView 
            ref={subjectRef as unknown as React.RefObject<ScrollView>} // ScrollView refs expose measureInWindow at runtime
            onLayout={measureTour}
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.subjectList}
          >
            {SUBJECTS.map(sub => {
              const isActive = sub === subject;
              const subColor = SubjectColors[sub] || Colors.subjectOther;
              const subEmoji = SubjectEmojis[sub] || '📋';
              return (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subjectChip,
                    isActive && { backgroundColor: subColor + '20', borderColor: subColor }
                  ]}
                  onPress={() => setSubject(sub)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.subjectEmoji, isActive && { fontSize: 18 }]}>{subEmoji}</Text>
                  <Text style={[styles.subjectChipText, { color: isActive ? subColor : Colors.textSecondary }]}>
                    {SubjectLabels[sub]?.replace(subEmoji, '').trim() || sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.spacer} />

          <Text style={styles.inputLabel}>Number of Pages</Text>
          <Input
            placeholder="How many pages to write?"
            keyboardType="numeric"
            value={pages}
            onChangeText={setPages}
            icon={<FileText color={Colors.textTertiary} size={18} />}
          />
        </View>

        {/* ── Section: Pricing ────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budget & Payment</Text>
          <View style={styles.sectionLine} />
        </View>

        <View ref={pricingRef} onLayout={measureTour} style={styles.card}>
          <View style={styles.rateHeader}>
            <Text style={styles.inputLabel}>Rate per Page</Text>
            <View style={styles.infoBadge}>
              <Zap color={Colors.accent} size={12} fill={Colors.accent} />
              <Text style={styles.infoBadgeText}>Market Rate</Text>
            </View>
          </View>

            <View style={styles.rateGrid}>
              {[1, 2, 5, 8, 10].map(rate => {
                const isActive = !isCustomRate && parseInt(ratePerPage) === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.ratePin, isActive && styles.ratePinActive]}
                    onPress={() => {
                      setIsCustomRate(false);
                      setRatePerPage(String(rate));
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.ratePinText, isActive && styles.ratePinTextActive]}>₹{rate}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.ratePin, isCustomRate && styles.ratePinActive]}
                onPress={() => setIsCustomRate(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.ratePinText, isCustomRate && styles.ratePinTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>

            {isCustomRate && (
              <View style={{ marginBottom: Spacing.xl }}>
                <Text style={styles.inputLabel}>Enter Manual Rate (₹)</Text>
                <Input
                  placeholder="E.g. 15"
                  keyboardType="numeric"
                  value={ratePerPage}
                  onChangeText={setRatePerPage}
                  icon={<IndianRupee color={Colors.textTertiary} size={18} />}
                />
              </View>
            )}

          {/* Budget Breakdown Card */}
          {totalCost > 0 ? (
            <View style={styles.budgetCard}>
              <View style={styles.budgetMainRow}>
                <View>
                  <Text style={styles.budgetValue}>₹{totalCost}</Text>
                  <Text style={styles.budgetLabel}>Total Budget</Text>
                </View>
                <View style={styles.budgetIconBox}>
                  <IndianRupee color={Colors.textInverse} size={20} strokeWidth={3} />
                </View>
              </View>

              <View style={styles.budgetDivider} />

              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Estimated Budget</Text>
                  <Text style={styles.breakdownValue}>Includes all taxes & security</Text>
                </View>
              </View>

              <View style={styles.trustInfo}>
                <ShieldCheck color={Colors.accent} size={14} />
                <Text style={styles.trustInfoText}>Secure Escrow Payment</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBudgetCard}>
              <Text style={styles.emptyBudgetText}>Select pages to see cost breakdown</Text>
            </View>
          )}
        </View>

        {/* ── Section: Logistics ──────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Instructions & Logistics</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Deadline</Text>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateIconBox}>
              <Clock color={Colors.primary} size={18} />
            </View>
            <Text style={styles.dateText}>
              {deadline.toLocaleDateString(undefined, {
                weekday: 'long', month: 'short', day: 'numeric'
              })}
            </Text>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          {Platform.OS === 'ios' && showDatePicker ? (
            <View style={styles.iosDatePickerContainer}>
              <DateTimePicker
                value={deadline}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(e, date) => {
                  if (date) setDeadline(date);
                }}
              />
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.doneBtnText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          ) : showDatePicker && (
            <DateTimePicker
              value={deadline}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(e, date) => {
                setShowDatePicker(false);
                if (date) setDeadline(date);
              }}
            />
          )}

          <View style={styles.spacer} />

          <View style={styles.instrHeader}>
            <Text style={styles.inputLabel}>Instructions <Text style={{fontSize: 10, opacity: 0.5}}>(Optional if files added)</Text></Text>
            <Text style={styles.charCount}>{instructions.length}/500</Text>
          </View>
          <View style={styles.textAreaContainer}>
            <TextInput
              placeholder="E.g. Use blue pen, neat handwriting, include diagrams on page 4..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              maxLength={500}
              value={instructions}
              onChangeText={setInstructions}
              style={styles.textArea}
            />
          </View>
        </View>

        {/* ── Section: Attachments ────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reference Files</Text>
          <View style={[styles.infoBadge, { paddingHorizontal: 6 }]}>
            <Info color={Colors.accent} size={10} />
            <Text style={[styles.infoBadgeText, { fontSize: 9 }]}>One is required</Text>
          </View>
        </View>

        <View style={styles.card}>
          {attachments.length > 0 ? (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachScroll}>
                {attachments.map((file, idx) => {
                  const isImage = file.uri.match(/\.(jpeg|jpg|gif|png|webp)$/i) || file.base64.startsWith('iVBORw0KGgo') || file.base64.startsWith('/9j/');
                  return (
                    <View key={idx} style={styles.attachThumb}>
                      {isImage ? (
                        <Image source={{ uri: file.uri }} style={styles.attachImg} />
                      ) : (
                        <View style={styles.attachFileIcon}>
                          <FileText color={Colors.primary} size={24} />
                          <Text style={styles.attachFileName} numberOfLines={1}>{file.name}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeAttachBtn}
                        onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X color="#fff" size={12} strokeWidth={3} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.addMorePill} onPress={handleAttachPress}>
                <Plus color={Colors.primary} size={16} />
                <Text style={styles.addMoreText}>Add More</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachArea} onPress={handleAttachPress} activeOpacity={0.7}>
              <View style={styles.attachIconCircle}>
                <Plus color={Colors.primary} size={24} strokeWidth={3} />
              </View>
              <Text style={styles.attachMainText}>Add Reference Files</Text>
              <Text style={styles.attachSubText}>PDFs or Images (Max 5MB)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Final Action ────────────────── */}
        <View style={styles.footer}>
          <Button
            ref={submitRef}
            onLayout={measureTour}
            title={isSubmitting ? 'Processing...' : `Post & Pay ₹${totalCost || '—'}`}
            onPress={handleSubmit}
            isLoading={isSubmitting}
            disabled={!subject || !pages || isSubmitting}
            style={styles.submitBtn}
          />
          <View style={styles.escrowNote}>
            <ShieldCheck color={Colors.textTertiary} size={13} />
            <Text style={styles.escrowText}>Peerlance Escrow Protected</Text>
          </View>
        </View>

      </ScrollView>

      <CoachMark 
        isVisible={showTour}
        onClose={() => {
          setShowTour(false);
          addCompletedTour(`post_${user.role}`);
        }}
        onStepChange={(step) => {
          if (step === 2) {
            scrollRef.current?.scrollToEnd({ animated: true });
            // Re-measure after scroll completes to get correct window coordinates
            setTimeout(measureTour, 350);
          }
        }}
        steps={[
          {
            title: "Select Subject",
            message: "Start by picking the correct subject. This helps our specialized writers find your task more easily.",
            layout: tourLayouts[0]
          },
          {
            title: "Budgeting",
            message: "Set a fair rate per page. High-quality writers usually prefer tasks with market rates or higher.",
            layout: tourLayouts[1]
          },
          {
            title: "Secure Payment",
            message: "When you post, your payment is held in escrow. It's only released once you're 100% satisfied with the work.",
            layout: tourLayouts[2]
          }
        ]}
      />
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────
  topBar: {
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  topBarTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  topBarSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  // ── Scroll Layout ──────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ── Section Headers ───────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: Spacing.md,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
    opacity: 0.5,
  },

  // ── Card Common ───────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  inputLabel: {
    fontSize: FontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  spacer: {
    height: Spacing.xl,
  },

  // ── Subjects ──────────────────────────────────────
  subjectList: {
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  subjectEmoji: {
    fontSize: 16,
  },
  subjectChipText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // ── Pricing ───────────────────────────────────────
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  infoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
  },
  rateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    marginTop: -4,
  },
  ratePin: {
    width: (SCREEN_WIDTH - 110) / 3,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  ratePinActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  ratePinText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  ratePinTextActive: {
    color: Colors.accent,
  },

  // ── Budget Card ───────────────────────────────────
  budgetCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    // Removed overflow: 'hidden' to prevent Android clipping/obscuring bug
    alignSelf: 'stretch',
  },
  budgetMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000', // Hardcoding solid colors for maximum safety
    letterSpacing: -1,
  },
  budgetLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#000000',
    opacity: 0.8,
  },
  budgetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginVertical: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  breakdownValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#000000',
  },
  trustInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.xs,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  trustInfoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  emptyBudgetCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyBudgetText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // ── Logistics ─────────────────────────────────────
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dateIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  dateText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  iosDatePickerContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  instrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  textAreaContainer: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    minHeight: 120,
  },
  textArea: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },

  // ── Attachments ───────────────────────────────────
  attachArea: {
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    paddingVertical: Spacing['2xl'],
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  attachIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  attachMainText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  attachSubText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginTop: 4,
  },
  attachScroll: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  attachThumb: {
    width: 90,
    height: 90,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  attachImg: {
    width: '100%',
    height: '100%',
  },
  attachFileIcon: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  attachFileName: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  removeAttachBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Footer ────────────────────────────────────────
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  submitBtn: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  escrowNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  escrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.2,
  },
});