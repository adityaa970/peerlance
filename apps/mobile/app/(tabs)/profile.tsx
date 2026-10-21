import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Platform, ActivityIndicator, Image, Modal, TextInput, 
  RefreshControl, KeyboardAvoidingView, TouchableWithoutFeedback, 
  Keyboard, Share, Alert, Clipboard 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { 
  Star, Shield, CheckCircle2, PenTool, ChevronRight, Settings, 
  LogOut, HelpCircle, Wallet, Edit3, Camera, FileText, 
  IndianRupee, Award, XCircle, Users, Copy, Share2 
} from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../../constants/Colors';
import { useUserStore } from '../../store/userStore';
import { formatINR } from '../../utils/format';
import { apiClient } from '../../utils/api';
import { uploadToCloudinary } from '../../utils/upload';
import debounce from 'lodash.debounce';
import { ErrorState } from '../../components/ErrorState';
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
export default function ProfileScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const {
    user: clerkUser
  } = useUser();
  const {
    getToken
  } = useAuth();
  const user = useUserStore();
  const isWriter = user.role === 'writer';
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingCollege, setEditingCollege] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [collegeSuggestions, setCollegeSuggestions] = useState<College[]>([]);
  const [isSearchingColleges, setIsSearchingColleges] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [editingTaskScope, setEditingTaskScope] = useState<'college' | 'district'>('college');
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const loadProfile = async () => {
    if (!clerkUser?.id) return;
    try {
      setLoading(true);
      setErrorProfile(null);
      const response = await apiClient.get(`/users/${clerkUser.id}`);
      const result = response.data;
      if (result.success) {
        if (result.data) {
          const userData = result.data;
          user.login({
            name: userData.name,
            email: userData.email,
            role: userData.role || 'poster',
            college: userData.college,
            walletBalance: userData.walletBalance || 0,
            isVerified: userData.isVerified || false,
            isActive: userData.isActive || false,
            trustScore: userData.trustScore || 100,
            assignmentsCompleted: userData.totalCompleted || 0,
            assignmentsPosted: userData.assignmentsPosted || 0,
            totalSpent: userData.totalSpent || 0,
            totalEarnings: userData.totalEarnings || 0,
            totalPagesWritten: userData.totalPagesWritten || 0,
            avatarInitial: userData.name ? userData.name.charAt(0).toUpperCase() : 'U',
            avatarUrl: userData.avatarUrl || null,
            idCardUrl: userData.idCardUrl || null,
            referralCode: userData.referralCode || null,
            promoBalance: userData.promoBalance || 0,
            earnedBalance: userData.earnedBalance || 0,
            referredById: userData.referredById || null,
            taskScope: userData.taskScope || 'college',
            district: userData.district || null
          });
        }
        if (result.data?.Rating_received) {
          const fetchedReviews = result.data.Rating_received.map((r: any) => ({
            id: r.id,
            giver: r.User_giver?.name || 'Anonymous',
            score: r.score,
            comment: r.comment,
            createdAt: r.createdAt,
            date: new Date(r.createdAt).toLocaleDateString()
          }));
          const totalScore = fetchedReviews.reduce((sum: number, review: any) => sum + review.score, 0);
          const avgScore = fetchedReviews.length > 0 ? (totalScore / fetchedReviews.length).toFixed(1) : 0;
          user.login({
            avgRating: typeof avgScore === 'number' ? avgScore : parseFloat(avgScore)
          });
          setReviews(fetchedReviews);
        }
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load profile details.';
      setErrorProfile(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await apiClient.get('/settings');
      if (res.data.success) {
        setSystemSettings(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch public settings:', e);
    }
  };

  useEffect(() => {
    loadProfile();
    fetchSystemSettings();
  }, [clerkUser?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const openEditProfile = () => {
    setEditingName(user.name);
    setEditingCollege(user.college);
    setSelectedCollege({
      id: user.college,
      Name: user.college,
      State: '',
      District: ''
    });
    setCollegeSuggestions([]);
    setEditingTaskScope(user.taskScope || 'college');
    setShowEditModal(true);
  };
  const debouncedFetchColleges = useCallback(
    debounce((query: string) => {
      fetchColleges(query);
    }, 500),
    []
  );

  const fetchColleges = async (query: string) => {
    if (query.trim().length < 2) {
      setCollegeSuggestions([]);
      return;
    }
    try {
      setIsSearchingColleges(true);
      const response = await apiClient.get(`/colleges/search?q=${encodeURIComponent(query)}`);
      setCollegeSuggestions(response.data?.colleges || []);
    } catch (error) {
      setCollegeSuggestions([]);
    } finally {
      setIsSearchingColleges(false);
    }
  };
  const saveProfile = async () => {
    if (!clerkUser?.id) return;
    const nextName = editingName.trim();
    const nextCollege = selectedCollege?.Name?.trim() || '';
    if (!nextName || !nextCollege) {
      return;
    }
    setIsSavingProfile(true);
    try {
      const token = await getToken();
      const response = await apiClient.patch(`/users/${clerkUser.id}`, {
          name: nextName,
          college: nextCollege,
          district: selectedCollege?.District || user.district,
          taskScope: editingTaskScope
        }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const result = response.data;
      if (!result.success) {
        throw new Error(result?.error || 'Failed to update profile');
      }
      const nameParts = nextName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      if (clerkUser && typeof (clerkUser as any).update === 'function') {
        await (clerkUser as any).update({
          firstName,
          lastName,
          unsafeMetadata: {
            ...(clerkUser.unsafeMetadata as any),
            collegeName: nextCollege
          }
        });
      }

      // Also grab isActive from the successful response so if they activated before reopening profile it reflects
      user.login({
        name: result.data?.name || nextName,
        college: result.data?.college || nextCollege,
        district: result.data?.district || selectedCollege?.District || user.district,
        taskScope: result.data?.taskScope || editingTaskScope,
        isActive: result.data?.isActive ?? user.isActive,
        avatarInitial: (result.data?.name || nextName).charAt(0).toUpperCase()
      });
      setShowEditModal(false);
    } catch (error: any) {
      // For mutations like saving profile, showing an alert instead of an ErrorState layout is usually preferred
      const errMessage = error instanceof Error ? error.message : 'Update failed.';
      alert(errMessage);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdateAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        const asset = result.assets[0];
        const imageUrl = await uploadToCloudinary(asset.uri);

        const token = await getToken();
        const response = await apiClient.patch(`/users/${clerkUser?.id}`, {
          avatarUrl: imageUrl
        }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (response.data.success) {
          try {
            // In React Native, passing an object with uri, type, and name to FormData handles file uploads properly
            await clerkUser?.setProfileImage({
              file: {
                uri: asset.uri,
                type: asset.mimeType || 'image/jpeg',
                name: asset.fileName || `profile-${Date.now()}.jpg`,
              } as any
            });
          } catch(e) {
            console.log('Failed to update clerk profile image immediately', e);
          }

          user.login({
            avatarUrl: imageUrl,
            avatarInitial: (user.name || 'U').charAt(0).toUpperCase()
          });
        } else {
          throw new Error('Failed to update profile image on server');
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (errorProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <ErrorState message={errorProfile} onRetry={loadProfile} />
      </View>
    );
  }

  return <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBg}>
            <View style={styles.headerGlowA} />
            <View style={styles.headerGlowB} />
          </View>
          <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {user.avatarUrl ? <Image source={{
                uri: user.avatarUrl
              }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{user.avatarInitial}</Text>}
              </View>
              <TouchableOpacity 
                style={styles.editAvatarBtn} 
                activeOpacity={0.8}
                onPress={handleUpdateAvatar}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Camera color="#fff" size={14} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
              {user.isVerified && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle2 color="#fff" fill={Colors.accent} size={20} />
                </View>
              )}
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.roleAndCollege}>
              <View style={[
                styles.roleBadge, 
                user.role === 'admin' ? styles.roleBadgeAdmin : 
                isWriter ? styles.roleBadgeWriter : 
                styles.roleBadgePoster
              ]}>
                {user.role === 'admin' ? (
                  <Shield color={Colors.warning} size={12} strokeWidth={2.5} />
                ) : isWriter ? (
                  <PenTool color={Colors.accent} size={12} strokeWidth={2.5} />
                ) : (
                  <FileText color={Colors.primary} size={12} strokeWidth={2.5} />
                )}
                <Text style={[styles.roleText, {
                  color: user.role === 'admin' ? Colors.warning : 
                         isWriter ? Colors.accent : 
                         Colors.primary
                }]}>
                  {user.role === 'admin' ? 'Admin' : isWriter ? 'Writer' : 'Poster'}
                </Text>
              </View>
              <View style={styles.collegeBadge}>
                <Text style={styles.collegeText}>{formatCollegeDisplayName(user.college)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {isWriter ? <>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, {
              backgroundColor: Colors.accentSoft
            }]}>
                  <CheckCircle2 color={Colors.accent} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{user.assignmentsCompleted}</Text>
                <Text style={styles.statLabel}>Written</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, {
              backgroundColor: Colors.warningSoft
            }]}>
                  <Star color={Colors.warning} fill={Colors.warning} size={18} />
                </View>
                <Text style={styles.statValue}>{user.avgRating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </> : <>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, {
              backgroundColor: Colors.primarySoft
            }]}>
                  <FileText color={Colors.primary} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{user.assignmentsPosted}</Text>
                <Text style={styles.statLabel}>Posted</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, {
              backgroundColor: Colors.errorSoft
            }]}>
                  <IndianRupee color={Colors.error} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{formatINR(user.totalSpent)}</Text>
                <Text style={styles.statLabel}>Spent</Text>
              </View>
            </>}
        </View>

        {/* Refer & Earn Section */}
        <View style={styles.referSection}>
          <View style={styles.referHeader}>
            <Award color={Colors.accent} size={20} strokeWidth={2.5} />
            <Text style={styles.referTitle}>Refer & Earn</Text>
          </View>
          <Text style={styles.referDesc}>
            {systemSettings 
              ? `Share your code and get ₹${systemSettings.writerFirstTaskBonus} + ${Math.round(systemSettings.writerCommissionRate * 100)}% commission from writers, or ₹${systemSettings.posterMilestoneBonus} for every ${systemSettings.posterMilestoneCount} posters.`
              : "Share your code and get ₹10 + 2% commission from writers, or ₹40 for every 2 posters."}
          </Text>
          <View style={styles.referCodeBox}>
            <View>
              <Text style={styles.referCodeLabel}>YOUR CODE</Text>
              <Text style={styles.referCode}>{user.referralCode || '...'}</Text>
            </View>
            <View style={styles.referActions}>
              <TouchableOpacity 
                style={styles.iconBtn}
                onPress={() => {
                  if (user.referralCode) {
                    Clipboard.setString(user.referralCode);
                    Alert.alert('Success', 'Referral code copied to clipboard!');
                  }
                }}
              >
                <Copy color={Colors.accent} size={20} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={async () => {
                  if (user.referralCode) {
                    try {
                      await Share.share({
                        message: `Join Peerlance using my referral code: ${user.referralCode}\n\nDownload the app now and start earning!`,
                      });
                    } catch (error) {
                      console.error('Sharing error:', error);
                    }
                  }
                }}
              >
                <Share2 color="#fff" size={16} strokeWidth={2.5} />
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.viewRefLink} 
            onPress={() => router.push('/referrals')}
          >
            <Text style={styles.viewRefLinkText}>View My Referred Friends</Text>
            <ChevronRight size={14} color={Colors.accent} strokeWidth={3} />
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <TouchableOpacity 
          style={styles.walletCard} 
          activeOpacity={0.8}
          onPress={() => router.push('/wallet')}
        >
          <View style={styles.walletLeft}>
            <View style={styles.walletIconBg}>
              <Wallet color={Colors.accent} size={20} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.walletLabel}>Wallet Balance</Text>
              <Text style={styles.walletAmount}>{formatINR(user.walletBalance)}</Text>
            </View>
          </View>
          <View style={styles.walletRight}>
            <Text style={styles.walletEarningsLabel}>
              {isWriter ? 'Withdrawable' : 'Running low?'}
            </Text>
            <Text style={styles.walletEarnings}>
              {isWriter ? formatINR(user.earnedBalance || 0) : 'Add money'}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Rating and Reviews - Only for Writers */}
        {isWriter && (
          <>
            <View style={styles.ratingDisplay}>
              <View style={styles.ratingHeader}>
                <Award color={Colors.warning} size={18} />
                <Text style={styles.ratingHeaderText}>Your Rating</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => <Star key={i} color={i <= Math.round(user.avgRating) ? '#F59E0B' : Colors.border} fill={i <= Math.round(user.avgRating) ? '#F59E0B' : 'transparent'} size={28} />)}
                <Text style={styles.ratingNumber}>{user.avgRating}/5.0</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Reviews</Text>
              {loading ? <ActivityIndicator size="small" color={Colors.primary} style={{
              marginTop: 20
            }} /> : reviews.length > 0 ? [...reviews]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map(review => <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={[styles.reviewerAvatar, {
                    backgroundColor: review.score >= 4 ? Colors.accentSoft : Colors.warningSoft
                  }]}>
                          <Text style={[styles.reviewerInitial, {
                      color: review.score >= 4 ? Colors.accent : Colors.warning
                    }]}>
                            {review.giver.charAt(0)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.reviewerName}>{review.giver}</Text>
                          <Text style={styles.reviewDate}>{review.date}</Text>
                        </View>
                      </View>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} color={i <= review.score ? '#F59E0B' : Colors.border} fill={i <= review.score ? '#F59E0B' : 'transparent'} size={14} />)}
                      </View>
                    </View>
                    {review.comment && <Text style={styles.reviewComment}>"{review.comment}"</Text>}
                  </View>) : <Text style={{
              textAlign: 'center',
              color: Colors.textTertiary,
              marginTop: 20
            }}>No reviews yet</Text>}
            </View>
          </>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          {user.role === 'admin' && (
            <>
              <TouchableOpacity 
                style={[styles.menuItem, { borderColor: Colors.accent, borderWidth: 1, backgroundColor: Colors.accentSoft, marginBottom: 12 }]} 
                activeOpacity={0.6} 
                onPress={() => router.push('/admin-deposits')}
              >
                <View style={[styles.menuIconBg, { backgroundColor: Colors.accent }]}>
                  <Shield color="#fff" size={18} strokeWidth={2.5} />
                </View>
                <Text style={[styles.menuText, { color: Colors.accent, fontWeight: '800' }]}>Admin Panel (Verify Deposits)</Text>
                <ChevronRight color={Colors.accent} size={18} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, { borderColor: Colors.primary, borderWidth: 1, backgroundColor: Colors.primarySoft, marginBottom: 12 }]} 
                activeOpacity={0.6} 
                onPress={() => router.push('/admin-referrals')}
              >
                <View style={[styles.menuIconBg, { backgroundColor: Colors.primary }]}>
                  <Users color="#fff" size={18} strokeWidth={2.5} />
                </View>
                <Text style={[styles.menuText, { color: Colors.primary, fontWeight: '800' }]}>Admin Panel (Referral View)</Text>
                <ChevronRight color={Colors.primary} size={18} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, { borderColor: Colors.secondary, borderWidth: 1, backgroundColor: Colors.surfaceElevated, marginBottom: 12 }]} 
                activeOpacity={0.6} 
                onPress={() => router.push('/admin-settings')}
              >
                <View style={[styles.menuIconBg, { backgroundColor: Colors.secondary }]}>
                  <Settings color="#fff" size={18} strokeWidth={2.5} />
                </View>
                <Text style={[styles.menuText, { color: Colors.textPrimary, fontWeight: '800' }]}>Admin Panel (App Settings)</Text>
                <ChevronRight color={Colors.textPrimary} size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            </>
          )}

          {!user.isActive && isWriter && <TouchableOpacity style={[styles.menuItem, {
          borderColor: Colors.warning,
          backgroundColor: Colors.warningSoft,
          borderWidth: 1.5,
          marginBottom: Spacing.xl
        }]} activeOpacity={0.8} onPress={() => router.push('/activate')}>
              <View style={[styles.menuIconBg, {
            backgroundColor: Colors.warning
          }]}>
                <Shield color={Colors.surface} size={20} strokeWidth={2.5} />
              </View>
              <View style={{
            flex: 1,
            paddingRight: Spacing.sm
          }}>
                <Text style={[styles.menuText, {
              color: Colors.warning,
              fontWeight: '800'
            }]}>Activate Account</Text>
                <Text style={{
              color: Colors.warning,
              fontSize: 12,
              opacity: 0.8,
              marginTop: 2
            }}>Upload showcase images to start receiving tasks</Text>
              </View>
              <ChevronRight color={Colors.warning} size={20} strokeWidth={2.5} />
            </TouchableOpacity>}

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={() => router.push(isWriter ? '/(tabs)' : '/(tabs)/post')}>
            <View style={[styles.menuIconBg, {
            backgroundColor: Colors.primarySoft
          }]}>
              {isWriter ? <FileText color={Colors.primary} size={18} strokeWidth={2} /> : <PenTool color={Colors.primary} size={18} strokeWidth={2} />}
            </View>
            <Text style={styles.menuText}>
              {isWriter ? 'Find Tasks' : 'Find Writer'}
            </Text>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={openEditProfile}>        
            <View style={[styles.menuIconBg, {
            backgroundColor: Colors.warningSoft
          }]}>
              <Edit3 color={Colors.warning} size={18} strokeWidth={2} />        
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={() => router.push('/support-chat')}>        
            <View style={[styles.menuIconBg, {
            backgroundColor: Colors.infoSoft
          }]}>
              <HelpCircle color={Colors.info} size={18} strokeWidth={2} />      
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
            <ChevronRight color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutItem]} 
            activeOpacity={0.6} 
            onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to log out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: () => user.logout() }
                ]
              );
            }}
          >        
            <View style={[styles.menuIconBg, { backgroundColor: Colors.errorSoft }]}>
              <LogOut color={Colors.error} size={18} strokeWidth={2} />      
            </View>
            <Text style={[styles.menuText, { color: Colors.error }]}>Log Out</Text>
            <ChevronRight color={Colors.error + '40'} size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Peerlance v1.0.0</Text>
      </ScrollView>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>

                  <Text style={styles.modalLabel}>Name</Text>
                  <TextInput value={editingName} onChangeText={setEditingName} placeholder="Your name" placeholderTextColor={Colors.textTertiary} style={styles.modalInput} />

                  <Text style={styles.modalLabel}>College</Text>
                  <View style={styles.inputContainerWithIcon}>
                    <TextInput 
                      value={editingCollege} 
                      onChangeText={text => {
                        setEditingCollege(text);
                        setSelectedCollege(null);
                        debouncedFetchColleges(text);
                      }} 
                      placeholder="Search your college" 
                      placeholderTextColor={Colors.textTertiary} 
                      style={[styles.modalInput, { flex: 1, paddingRight: 40 }]} 
                    />
                    {editingCollege.length > 0 && (
                      <TouchableOpacity 
                        style={styles.clearIcon} 
                        onPress={() => {
                          setEditingCollege('');
                          setSelectedCollege(null);
                          setCollegeSuggestions([]);
                        }}
                      >
                        <XCircle color={Colors.textTertiary} size={18} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {isSearchingColleges ? <ActivityIndicator size="small" color={Colors.primary} style={{
                  marginTop: Spacing.sm
                }} /> : selectedCollege || collegeSuggestions.length === 0 ? null : <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {collegeSuggestions.slice(0, 5).map(college => <TouchableOpacity key={college.id} style={styles.suggestionItem} onPress={() => {
                    setSelectedCollege(college);
                    setEditingCollege(college.Name);
                    setCollegeSuggestions([]);
                  }}>
                          <Text style={styles.suggestionName}>{college.Name}</Text>
                          <Text style={styles.suggestionLocation}>{college.District}, {college.State}</Text>
                        </TouchableOpacity>)}
                    </ScrollView>}

                  <Text style={styles.modalHint}>Choose a college from the results only.</Text>

                  <Text style={[styles.modalLabel, { marginTop: Spacing.lg }]}>Task Visibility</Text>
                  <View style={styles.scopeContainer}>
                    <TouchableOpacity 
                      style={[styles.scopeButton, editingTaskScope === 'college' && styles.scopeButtonActive]}
                      onPress={() => setEditingTaskScope('college')}
                    >
                      <Text style={[styles.scopeButtonText, editingTaskScope === 'college' && styles.scopeButtonTextActive]}>College Only</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.scopeButton, editingTaskScope === 'district' && styles.scopeButtonActive]}
                      onPress={() => setEditingTaskScope('district')}
                    >
                      <Text style={[styles.scopeButtonText, editingTaskScope === 'district' && styles.scopeButtonTextActive]}>Entire District</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalHint}>
                    {editingTaskScope === 'college' 
                      ? "You'll only see tasks posted within your college." 
                      : `You'll see tasks from all colleges in ${selectedCollege?.District || user.district || 'your district'}.`}
                  </Text>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowEditModal(false)}>
                      <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalPrimaryButton} onPress={saveProfile} disabled={isSavingProfile}>
                      <Text style={styles.modalPrimaryButtonText}>{isSavingProfile ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollContent: {
    paddingBottom: 100
  },
  header: {
    position: 'relative',
    paddingBottom: Spacing.lg
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: Colors.primaryDark,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden'
  },
  headerGlowA: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  headerGlowB: {
    position: 'absolute',
    bottom: -110,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.08)'
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 58
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.background,
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0B0F19'
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4
  },
  userName: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5
  },
  roleAndCollege: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full
  },
  roleBadgeWriter: {
    backgroundColor: Colors.accentSoft
  },
  roleBadgePoster: {
    backgroundColor: Colors.primarySoft
  },
  roleBadgeAdmin: {
    backgroundColor: Colors.warningSoft
  },
  roleText: {
    fontSize: FontSize.sm,
    fontWeight: '700'
  },
  collegeBadge: {
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full
  },
  collegeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.sm
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textTertiary
  },
  referSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10
  },
  referHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  referTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  referDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4
  },
  referCodeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent
  },
  referCodeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1
  },
  referCode: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.accent,
    letterSpacing: 2,
    marginTop: 2
  },
  viewRefLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 4
  },
  viewRefLinkText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent
  },
  referActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.accentSoft,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800'
  },
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
    shadowColor: Colors.accent,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md
  },
  walletIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  walletLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  walletAmount: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  walletRight: {
    alignItems: 'flex-end'
  },
  walletEarningsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  walletEarnings: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.accent
  },
  ratingDisplay: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md
  },
  ratingHeaderText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: Spacing.sm
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  reviewerInitial: {
    fontSize: 14,
    fontWeight: '700'
  },
  reviewerName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  reviewDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2
  },
  reviewComment: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: Spacing.sm
  },
  menuSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl']
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md
  },
  menuText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  logoutItem: {
    borderColor: Colors.errorSoft,
    backgroundColor: Colors.errorSoft
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.lg
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.xl
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  modalLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: 6
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    backgroundColor: Colors.background
  },
  inputContainerWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative'
  },
  clearIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center'
  },
  suggestionsContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderFocus,
    borderRadius: Radius.md,
    marginTop: 8,
    maxHeight: 180
  },
  suggestionItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight
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
  modalHint: {
    marginTop: 4,
    color: Colors.textTertiary,
    fontSize: 11
  },
  scopeContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  scopeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm
  },
  scopeButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  scopeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary
  },
  scopeButtonTextActive: {
    color: '#fff',
    fontWeight: '800'
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.overlayLight
  },
  modalSecondaryButtonText: {
    color: Colors.textPrimary,
    fontWeight: '700'
  },
  modalPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700'
  }
});