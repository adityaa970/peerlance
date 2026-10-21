import { useTheme } from '../../hooks/useTheme';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, Alert, Linking, Image as RNImage, Modal, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, FileText, Clock, Star, User, Shield, CheckCircle2, MessageCircle, Camera, AlertTriangle, ArrowRight, Share2, PenTool, BookOpen, IndianRupee, Image, AlertCircle } from 'lucide-react-native';
import { SubjectColors, SubjectLabels, SubjectEmojis, Spacing, Radius, FontSize } from '../../constants/Colors';
import { useUserStore } from '../../store/userStore';
import { useAuth } from '@clerk/expo';
import { ActivityIndicator } from 'react-native';
// The classic download API lives in /legacy since Expo SDK 54; the main entry throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { apiClient } from '../../utils/api';
import { scheduleDeadlineReminders, cancelDeadlineReminders } from '../../utils/notifications';
import { CountdownTimer } from '../../components/CountdownTimer';
import { ErrorState } from '../../components/ErrorState';
import { formatINR, describeStatus, toneColors } from '../../utils/format';

const STATUS_STEPS = [{
  key: 'OPEN',
  label: 'Posted',
  icon: BookOpen
}, {
  key: 'CLAIMED',
  label: 'Accepted',
  icon: User
}, {
  key: 'IN_PROGRESS',
  label: 'Writing',
  icon: PenTool
}, {
  key: 'UNDER REVIEW',
  label: 'Review',
  icon: AlertCircle
}, {
  key: 'COMPLETED',
  label: 'Done',
  icon: CheckCircle2
}];
function getStatusIndex(status: string) {
  // Map legacy frontend terms to actual DB enums
  if (status === 'ACCEPTED') status = 'CLAIMED';
  if (status === 'WRITING') status = 'IN_PROGRESS';
  if (status === 'UNDER_REVIEW' || status === 'NEEDS APPROVAL' || status === 'NEEDS_APPROVAL') status = 'UNDER REVIEW';
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}
export default function AssignmentDetailScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const {
    id,
    status: paramStatus
  } = useLocalSearchParams();
  const router = useRouter();
  const currentUserId = useUserStore(s => s.id);
  const role = useUserStore(s => s.role);
  const currentUserCollege = useUserStore(s => s.college);
  const {
    getToken
  } = useAuth();
  const isWriter = role === 'writer';
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [posterRating, setPosterRating] = useState(5);
  const [posterFeedback, setPosterFeedback] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = async () => {
    try {
      setError(null);
      setLoading(true);
      const token = await getToken();
      const res = await apiClient.get(`/tasks/${id}`, {
        headers: {
          ...(token ? {
            Authorization: `Bearer ${token}`
          } : {})
        }
      });
      const data = res.data;
      const taskData = data.task || data; // handle different API structures securely
      if (paramStatus && typeof paramStatus === 'string') {
        taskData.status = paramStatus;
      }
      setAssignment(taskData);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Could not load assignment details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!id) return;
    fetchTask();
  }, [id, paramStatus]);
  if (loading) {
    return <View style={[styles.container, {
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={fetchTask} />
      </View>
    );
  }

  if (!assignment) {
    return <View style={[styles.container, {
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
        <Text style={{
        fontFamily: 'Urbanist-Medium',
        fontSize: 16
      }}>Assignment not found.</Text>
        <TouchableOpacity style={{
        marginTop: 20
      }} onPress={() => router.back()}>
          <Text style={{
          color: Colors.primary
        }}>Go Back</Text>
        </TouchableOpacity>
      </View>;
  }
  const subjectColor = SubjectColors[assignment.subject] || Colors.subjectOther;
  const emoji = SubjectEmojis[assignment.subject] || '📋';
  const subjectLabel = SubjectLabels[assignment.subject]?.replace(/^.+\s/, '') || assignment.subject;
  const statusIdx = getStatusIndex(assignment.status);

  const statusInfo = describeStatus(assignment.status);
  const statusTone = toneColors(statusInfo.tone, Colors);

  const handleReferenceClick = (url: string, index: number) => {
    Alert.alert('Reference Material', `File ${index + 1}: View or Download?`, [{
      text: 'View (In App)',
      onPress: async () => await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.POPOVER
      })
    }, {
      text: 'Download & Share',
      onPress: async () => {
        try {
          Alert.alert('Status', 'Downloading...');
          const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
          // Handle Cloudinary URLs edge cases
          const cleanExt = ext.length > 4 ? 'jpg' : ext;
          const fileUri = `${FileSystem.documentDirectory || ''}reference_${index + 1}_${Date.now()}.${cleanExt}`;
          const downloadRes = await FileSystem.downloadAsync(url, fileUri);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadRes.uri, {
              dialogTitle: 'Save Reference Material'
            });
          } else {
            Alert.alert('Success', 'File downloaded, but sharing is not available.');
          }
        } catch (e) {
          Alert.alert('Error', 'Failed to download file');
        }
      }
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const handleShare = async () => {
    if (!assignment) return;
    try {
      const message = `Someone at ${assignment.college} needs help with a ${assignment.pages}-page ${SubjectLabels[assignment.subject]?.replace(/^.+\s/, '') || assignment.subject} assignment! Earn ₹${assignment.writerEarns} by completing it on Peerlance.`;
      const url = ExpoLinking.createURL(`task/${assignment.id}`);
      await Share.share({
        message: Platform.OS === 'ios' ? message : `${message}\n${url}`,
        url: Platform.OS === 'ios' ? url : undefined
      }, {
        dialogTitle: 'Share Assignment'
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };
  const handleAccept = async () => {
    if (!assignment) return;
    try {
      setIsAccepting(true);
      const token = await getToken();
      const response = await apiClient.post(`/tasks/${assignment.id}/accept`, {}, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = response.data;
      if (data.success) {
        Alert.alert('✍️ Assignment Accepted!', `You've accepted this ${assignment.pages}-page ${subjectLabel} assignment.\nYou'll earn ₹${assignment.writerEarns} when you complete it.`, [{
          text: 'Open Chat',
          onPress: () => {
            setAssignment((prev: any) => prev ? {
              ...prev,
              status: 'CLAIMED'
            } : null);
            router.push(`/task/chat/${assignment.id}`);

            // Schedule reminders for the worker
            if (assignment && assignment.id) {
              scheduleDeadlineReminders(assignment.id, `${subjectLabel} Assignment`, assignment.deadline);
            }
          }
        }, {
          text: 'OK',
          onPress: () => {
            setAssignment((prev: any) => prev ? {
              ...prev,
              status: 'CLAIMED'
            } : null);

            // Schedule reminders for the worker
            if (assignment && assignment.id) {
              scheduleDeadlineReminders(assignment.id, `${subjectLabel} Assignment`, assignment.deadline);
            }
          }
        }]);
      } else {
        Alert.alert('Unable to accept', data.error || 'Failed to claim task.');
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Network request failed';
      
      // If the user is a writer but not active, show a redirect to activation
      if (errorMessage.includes('Only active writers can accept tasks')) {
        Alert.alert(
          'Account Activation Required',
          'You need to verify your skills and activate your account before you can accept assignments.',
          [
            { text: 'Not Now', style: 'cancel' },
            { 
              text: 'Activate Now', 
              onPress: () => router.push('/activate') 
            }
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!assignment) return;
    try {
      setIsCompleting(true);
      const token = await getToken();
      const response = await apiClient.patch(`/tasks/${assignment.id}/complete`, {}, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (response.data.success) {
        Alert.alert('Done!', 'Task marked as completed. Waiting for poster approval.');
        setAssignment((prev: any) => prev ? { ...prev, completedAt: new Date().toISOString() } : null);
        // Cancel reminders as task is done
        if (assignment.id) cancelDeadlineReminders(assignment.id);
      } else {
        Alert.alert('Error', response.data.error || 'Failed to mark complete');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark complete');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Assignment',
      'Are you sure you want to cancel this assignment? This cannot be undone.',
      [
        { text: 'No, Keep It', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            if (!assignment) return;
            try {
              setIsCancelling(true);
              const token = await getToken();
              const response = await apiClient.post(`/tasks/${assignment.id}/cancel`, {}, {
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
              });
              
              if (response.data.success) {
                Alert.alert('Cancelled!', 'Your assignment has been removed.');
                
                // Cancel reminders
                if (assignment.id) cancelDeadlineReminders(assignment.id);

                setAssignment((prev: any) => prev ? {
                  ...prev,
                  status: 'CANCELLED'
                } : null);
                router.back();
              } else {
                Alert.alert('Unable to cancel', response.data.error || 'Failed to cancel task.');
              }
            } catch (e: any) {
              const errorMessage = e instanceof Error ? e.message : 'Network request failed';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleApprove = async () => {
    if (!assignment) return;
    setRatingModalVisible(true);
  };

  const submitApprove = async () => {
    if (!assignment) return;
    try {
      setIsApproving(true);
      const token = await getToken();
      const response = await apiClient.patch(`/tasks/${assignment.id}/approve`, {
        rating: posterRating,
        feedback: posterFeedback
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (response.data.success) {
        setRatingModalVisible(false);
        Alert.alert('Success', 'Assignment approved! Payout initiated.');
        setAssignment((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : null);
      } else {
        Alert.alert('Error', response.data.error || 'Failed to approve');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  return <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignment Details</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
          <Share2 color={Colors.textSecondary} size={20} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Status */}
        <View style={[styles.statusBanner, {
        backgroundColor: statusTone.bg
      }]}>
          <View style={[styles.statusDot, {
          backgroundColor: statusTone.fg
        }]} />
          <Text style={[styles.statusText, {
          color: statusTone.fg
        }]}>{statusInfo.label}</Text>
        </View>

        {/* Subject + Payout */}
        <View style={styles.topSection}>
          <View style={[styles.subjectBadge, {
          backgroundColor: subjectColor + '18'
        }]}>
            <Text style={{
            fontSize: 16
          }}>{emoji}</Text>
            <Text style={[styles.subjectText, {
            color: subjectColor
          }]}>{subjectLabel}</Text>
          </View>
          <View style={styles.payoutContainer}>
            <Text style={styles.payoutLabel}>{isWriter ? 'You earn' : 'Total cost'}</Text>
            <View style={styles.payoutRow}>
              <Text style={styles.payoutAmount}>{formatINR(isWriter ? assignment.writerEarns : assignment.totalCost)}</Text>
            </View>
          </View>
        </View>

        {assignment.college && currentUserCollege && assignment.college !== currentUserCollege && <View style={{
        marginHorizontal: Spacing.xl,
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.warningSoft,
        borderWidth: 1,
        borderColor: Colors.warning + '40',
        borderRadius: Radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm
      }}>
            <AlertCircle color={Colors.warning} size={20} />
            <Text style={{
          color: Colors.warning,
          fontSize: FontSize.sm,
          fontWeight: '600',
          flex: 1,
          lineHeight: 20
        }}>
              This assignment is from {assignment.college}. You are currently at {currentUserCollege}.
            </Text>
          </View>}

        {/* Key Details */}
        <View style={styles.keyDetails}>
          <View style={styles.keyDetailItem}>
            <View style={[styles.keyDetailIcon, {
            backgroundColor: Colors.primarySoft
          }]}>
              <FileText color={Colors.primary} size={18} strokeWidth={2} />
            </View>
            <Text style={styles.keyDetailValue}>{assignment.pages}</Text>
            <Text style={styles.keyDetailLabel}>Pages</Text>
          </View>
          <View style={styles.keyDetailDivider} />
          <View style={styles.keyDetailItem}>
            <View style={[styles.keyDetailIcon, {
            backgroundColor: Colors.accentSoft
          }]}>
              <IndianRupee color={Colors.accent} size={18} strokeWidth={2} />
            </View>
            <Text style={styles.keyDetailValue}>₹{assignment.ratePerPage}</Text>
            <Text style={styles.keyDetailLabel}>Per Page</Text>
          </View>
          <View style={styles.keyDetailDivider} />
          <View style={styles.keyDetailItem}>
            <View style={[styles.keyDetailIcon, {
            backgroundColor: Colors.warningSoft
          }]}>
              <Clock color={Colors.warning} size={18} strokeWidth={2} />
            </View>
            {assignment.writer?.id === currentUserId && (assignment.status === 'CLAIMED' || assignment.status === 'ACCEPTED' || assignment.status === 'IN_PROGRESS' || assignment.status === 'WRITING') ? (
              <CountdownTimer deadline={assignment.deadline} />
            ) : (
              <Text style={styles.keyDetailValue}>{assignment.deadline}</Text>
            )}
            <Text style={styles.keyDetailLabel}>Deadline</Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 Special Instructions</Text>
          <Text style={styles.instructionsText}>{assignment.instructions}</Text>
        </View>

        {/* Reference Material */}
        {assignment.hasReference && assignment.images && assignment.images.length > 0 && <View style={styles.referenceContainer}>
            <Text style={styles.referenceSectionTitle}>📎 Reference Material</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.referenceScroll}>
              {assignment.images.map((url: string, index: number) => {
            const isPdf = url.toLowerCase().endsWith('.pdf');
            // Cloudinary can generate a thumbnail of the first page of a PDF by changing the extension to .jpg
            const thumbnailUri = isPdf ? url.replace(/\.pdf$/i, '.jpg') : url;
            return <TouchableOpacity key={index} onPress={() => {
              if (isPdf) {
                handleReferenceClick(url, index);
              } else {
                setSelectedImage(url);
              }
            }} activeOpacity={0.8} style={{
              position: 'relative'
            }}>
                    <RNImage source={{
                uri: thumbnailUri
              }} style={styles.referenceThumbnail} />
                    {isPdf && <View style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: 'rgba(0,0,0,0.6)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4
              }}>
                        <Text style={{
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}>PDF</Text>
                      </View>}
                  </TouchableOpacity>;
          })}
            </ScrollView>
          </View>}

        {/* Payment Breakdown */}
        {isWriter && <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>💰 Payment Breakdown</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{assignment.pages} pages × ₹{assignment.ratePerPage}/page</Text>
            <Text style={styles.paymentValue}>{formatINR(assignment.totalCost)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Platform fee (12%)</Text>
            <Text style={styles.paymentFee}>−{formatINR(assignment.platformFee)}</Text>
          </View>
          <View style={styles.paymentDivider} />
          <View style={styles.paymentRow}>
            <Text style={styles.paymentWorkerLabel}>You earn</Text>
            <Text style={styles.paymentWorkerValue}>{formatINR(assignment.writerEarns)}</Text>
          </View>
        </View>}

        {/* User Card */}
        {!isWriter && assignment.status === 'OPEN' ? <View style={styles.posterCard}>
            <Text style={styles.posterCardTitle}>Status</Text>
            <Text style={{
          color: Colors.textSecondary,
          marginTop: Spacing.sm
        }}>Waiting for a writer to accept this assignment.</Text>
          </View> : (!isWriter && assignment.status === 'CANCELLED') ? <View style={styles.posterCard}>
            <Text style={styles.posterCardTitle}>Status</Text>
            <Text style={{
          color: Colors.error,
          marginTop: Spacing.sm,
          fontWeight: '500'
        }}>This assignment was cancelled before a writer was assigned.</Text>
          </View> : <View style={styles.posterCard}>
          <Text style={styles.posterCardTitle}>{isWriter ? 'Posted by' : 'Assigned Writer'}</Text>
          <View style={styles.posterHeader}>
            <View style={styles.posterAvatarWrapper}>
              {isWriter ? (
                assignment.poster?.avatarUrl ? (
                  <RNImage
                    source={{ uri: assignment.poster.avatarUrl }}
                    style={[styles.posterAvatar, { backgroundColor: Colors.surface }]}
                  />
                ) : (
                  <View style={[styles.posterAvatar, { backgroundColor: subjectColor + '20' }]}>
                    <Text style={[styles.posterInitial, { color: subjectColor }]}>
                      {assignment.poster?.avatarInitial || 'U'}
                    </Text>
                  </View>
                )
              ) : (
                assignment.writer?.avatarUrl ? (
                  <RNImage
                    source={{ uri: assignment.writer.avatarUrl }}
                    style={[styles.posterAvatar, { backgroundColor: Colors.surface }]}
                  />
                ) : (
                  <View style={[styles.posterAvatar, { backgroundColor: subjectColor + '20' }]}>
                    <Text style={[styles.posterInitial, { color: subjectColor }]}>
                      {assignment.writer?.avatarInitial || 'W'}
                    </Text>
                  </View>
                )
              )}
              <View style={styles.verifiedDot}>
                <CheckCircle2 color="#fff" fill={Colors.accent} size={16} />
              </View>
            </View>
            <View style={styles.posterInfo}>
              <Text style={styles.posterName}>{isWriter ? assignment.poster?.name : assignment.writer?.name || 'Assigned Writer'}</Text>
              <View style={styles.posterRatingRow}>
                <Star color="#F59E0B" fill="#F59E0B" size={14} />
                <Text style={styles.posterRating}>{isWriter ? (assignment.poster?.avgRating)?.toFixed(1) : (assignment.writer?.avgRating)?.toFixed(1) || 'New'}</Text>
                <Text style={styles.posterRatingCount}>· {isWriter ? assignment.poster?.totalPosted : assignment.writer?.totalCompleted || 0} {isWriter ? 'assignments posted' : 'assignments completed'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.posterStats}>
            <View style={styles.posterStatItem}>
              <Shield color={Colors.primary} size={14} strokeWidth={2.5} />
              <Text style={styles.posterStatValue}>{isWriter ? assignment.poster?.trustScore : assignment.writer?.trustScore || 100}%</Text>
              <Text style={styles.posterStatLabel}>Trust</Text>
            </View>
            <View style={styles.posterStatDivider} />
            <View style={styles.posterStatItem}>
              <Star color={Colors.warning} fill={Colors.warning} size={14} />
              <Text style={styles.posterStatValue}>{isWriter ? (assignment.poster?.avgRating)?.toFixed(1) : (assignment.writer?.avgRating)?.toFixed(1) || '5.0'}</Text>
              <Text style={styles.posterStatLabel}>Rating</Text>
            </View>
            <View style={styles.posterStatDivider} />
            <View style={styles.posterStatItem}>
              <FileText color={Colors.info} size={14} strokeWidth={2.5} />
              <Text style={styles.posterStatValue}>{isWriter ? assignment.poster?.totalPosted : assignment.writer?.totalCompleted || 0}</Text>
              <Text style={styles.posterStatLabel}>{isWriter ? 'Posted' : 'Done'}</Text>
            </View>
          </View>
        </View>}

        {/* Timeline */}
        {assignment.status === 'CANCELLED' ? (
          <View style={[styles.timelineCard, { opacity: 0.8 }]}>
            <Text style={styles.timelineTitle}>Progress</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, styles.timelineDotActive, { backgroundColor: Colors.error, borderColor: Colors.error }]}>
                    <AlertTriangle color="#fff" size={14} strokeWidth={2.5} />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, styles.timelineLabelActive, { color: Colors.error }]}>
                    Cancelled
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Progress</Text>
            <View style={styles.timeline}>
              {STATUS_STEPS.map((step, index) => {
              const isCompleted = index <= statusIdx;
              const isCurrent = index === statusIdx;
              const IconComponent = step.icon;
              return <View key={step.key} style={styles.timelineStep}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, isCompleted && styles.timelineDotActive, isCurrent && styles.timelineDotCurrent]}>
                        <IconComponent color={isCompleted ? '#fff' : Colors.textTertiary} size={14} strokeWidth={2.5} />
                      </View>
                      {index < STATUS_STEPS.length - 1 && <View style={[styles.timelineLine, isCompleted && styles.timelineLineActive]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, isCompleted && styles.timelineLabelActive, isCurrent && styles.timelineLabelCurrent]}>
                        {step.label}
                      </Text>
                      {isCurrent && <Text style={styles.timelineCurrentBadge}>Current</Text>}
                    </View>
                  </View>;
            })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      {assignment.status === 'OPEN' && <View style={styles.bottomBar}>
          <View style={styles.bottomBarInner}>
            <View style={styles.bottomEarn}>
              <Text style={styles.bottomEarnLabel}>{isWriter ? "You'll earn" : "Total cost"}</Text>
              <Text style={styles.bottomEarnAmount}>{formatINR(isWriter ? assignment.writerEarns : assignment.totalCost)}</Text>
              <Text style={styles.bottomEarnSub}>{assignment.pages} pages · {assignment.deadline}</Text>
            </View>
            {isWriter ? <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.85} disabled={isAccepting}>
                {isAccepting ? <Text style={styles.acceptButtonText}>Accepting...</Text> : <>
                    <PenTool color="#fff" size={18} strokeWidth={2} />
                    <Text style={styles.acceptButtonText}>Accept & Write</Text>
                  </>}
              </TouchableOpacity> : <TouchableOpacity style={[styles.acceptButton, {
          backgroundColor: Colors.primarySoft
        }]} activeOpacity={0.85} onPress={handleCancel} disabled={isCancelling}>
                <AlertTriangle color={Colors.primary} size={18} strokeWidth={2} />
                <Text style={[styles.acceptButtonText, {
            color: Colors.primary
          }]}>{isCancelling ? 'Cancelling...' : 'Cancel Post'}</Text>
              </TouchableOpacity>}
          </View>
        </View>}

      {assignment.status !== 'OPEN' && assignment.status !== 'CANCELLED' && <View style={styles.bottomBar}>
          <View style={styles.bottomBarInner}>
            <View style={styles.actionRow}>
              {assignment.status === 'COMPLETED' ? (
                <View style={[styles.chatBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <MessageCircle color={Colors.textTertiary} size={20} strokeWidth={2} />
                  <Text style={[styles.chatBtnText, { color: Colors.textTertiary }]}>Chat Closed</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.chatBtn} activeOpacity={0.7} onPress={() => router.push(`/task/chat/${assignment.id}` as any)}>
                  <MessageCircle color={Colors.primary} size={20} strokeWidth={2} />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </TouchableOpacity>
              )}
              {isWriter ? (
                (!assignment.completedAt && assignment.status !== 'COMPLETED') ? (
                  <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.7} onPress={handleMarkComplete} disabled={isCompleting}>
                    {isCompleting ? <ActivityIndicator color="#fff" size="small" /> : <><CheckCircle2 color={Colors.accent} size={20} strokeWidth={2} />
                    <Text style={styles.uploadBtnText}>Mark Done</Text></>}
                  </TouchableOpacity>
                ) : assignment.status === 'COMPLETED' ? (
                    <View style={[styles.uploadBtn, {backgroundColor: Colors.border}]}>
                      <CheckCircle2 color={Colors.success} size={20} />
                      <Text style={[styles.uploadBtnText, {color: Colors.success}]}>Completed</Text>
                    </View>
                  ) : (
                    <View style={[styles.uploadBtn, {backgroundColor: Colors.border}]}>
                      <CheckCircle2 color={Colors.textSecondary} size={20} />
                      <Text style={[styles.uploadBtnText, {color: Colors.textSecondary}]}>Under Review</Text>
                    </View>
                  )
                ) : (
                (assignment.completedAt && assignment.status !== 'COMPLETED') ? (
                  <TouchableOpacity style={[styles.uploadBtn, {backgroundColor: Colors.success}]} activeOpacity={0.7} onPress={handleApprove}>
                    <CheckCircle2 color="#fff" size={20} strokeWidth={2} />
                    <Text style={[styles.uploadBtnText, {color: '#fff'}]}>Approve</Text>
                  </TouchableOpacity>
                ) : (assignment.status === 'COMPLETED') ? (
                   <View style={[styles.uploadBtn, {backgroundColor: Colors.border}]}>
                    <CheckCircle2 color={Colors.textSecondary} size={20} />
                    <Text style={[styles.uploadBtnText, {color: Colors.textSecondary}]}>Completed</Text>
                  </View>
                ) : (
                  <View style={styles.uploadBtn}>
                    <Clock color={Colors.accent} size={20} strokeWidth={2} />
                    <Text style={styles.uploadBtnText}>Writing...</Text>
                  </View>
                )
              )}
            </View>
          </View>
        </View>}

      {/* Rating Modal */}
      <Modal visible={ratingModalVisible} transparent animationType="slide" onRequestClose={() => setRatingModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={{backgroundColor: Colors.surface, width: '85%', padding: 24, borderRadius: 16, alignItems: 'center'}}>
            <Text style={{fontSize: 18, fontWeight: '700', marginBottom: 8, color: Colors.textPrimary}}>Rate Writer</Text>
            <Text style={{fontSize: 14, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center'}}>Approve the assignment & add a review</Text>
            
            <View style={{flexDirection: 'row', gap: 8, marginBottom: 20}}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setPosterRating(star)}>
                     <Star color="#F59E0B" fill={posterRating >= star ? "#F59E0B" : "transparent"} size={32} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.acceptButton, {width: '100%', marginTop: 10}]} onPress={submitApprove} disabled={isApproving}>
              {isApproving ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptButtonText}>Confirm & Transfer ₹{assignment?.writerEarns}</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity style={{marginTop: 16, padding: 8}} onPress={() => setRatingModalVisible(false)}>
              <Text style={{color: Colors.textSecondary, fontWeight: '600'}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          {selectedImage && <RNImage source={{
          uri: selectedImage
        }} style={styles.modalImage} resizeMode="contain" />}
        </View>
      </Modal>

    </View>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    paddingBottom: 140
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.sm
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 6
  },
  subjectText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  payoutContainer: {
    alignItems: 'flex-end'
  },
  payoutLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  payoutSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent
  },
  payoutAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -1
  },
  keyDetails: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  keyDetailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6
  },
  keyDetailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  keyDetailValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  keyDetailLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  keyDetailDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border
  },
  instructionsCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  instructionsTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  instructionsText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22
  },
  referenceContainer: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg
  },
  referenceSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  referenceScroll: {
    gap: Spacing.md
  },
  referenceThumbnail: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.md
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700'
  },
  modalImage: {
    width: '100%',
    height: '80%'
  },
  paymentCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  paymentTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  paymentLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary
  },
  paymentValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  paymentFee: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.error
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.sm
  },
  paymentWorkerLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent
  },
  paymentWorkerValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.accent
  },
  posterCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  posterCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md
  },
  posterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg
  },
  posterAvatarWrapper: {
    position: 'relative'
  },
  posterAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  posterInitial: {
    fontSize: 22,
    fontWeight: '800'
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2
  },
  posterInfo: {
    flex: 1
  },
  posterName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  posterRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3
  },
  posterRating: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  posterRatingCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary
  },
  posterStats: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center'
  },
  posterStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4
  },
  posterStatValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  posterStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  posterStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border
  },
  timelineCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  timelineTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg
  },
  timeline: {},
  timelineStep: {
    flexDirection: 'row',
    minHeight: 48
  },
  timelineLeft: {
    alignItems: 'center',
    width: 36
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  timelineDotActive: {
    backgroundColor: Colors.primary
  },
  timelineDotCurrent: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4
  },
  timelineLineActive: {
    backgroundColor: Colors.primary
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm
  },
  timelineLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.textTertiary
  },
  timelineLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  timelineLabelCurrent: {
    fontWeight: '700',
    color: Colors.primary
  },
  timelineCurrentBadge: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.xl,
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: -4
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 20
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg
  },
  bottomEarn: {
    flex: 1
  },
  bottomEarnLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  bottomEarnAmount: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -0.5
  },
  bottomEarnSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    shadowColor: Colors.accent,
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  acceptButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary
  },
  chatBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentSoft,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent
  },
  uploadBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent
  },
  disputeBtn: {
    width: 52,
    backgroundColor: Colors.errorSoft,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center'
  }
});