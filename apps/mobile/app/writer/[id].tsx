import { useTheme } from '../../hooks/useTheme';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, ActivityIndicator,
  TouchableOpacity, Platform, Dimensions, Animated
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Star, MapPin, CheckCircle2, Award, FileText,
  Shield, TrendingUp, Clock, MessageSquare, ChevronRight, Zap,
  BookOpen, ThumbsUp, Eye
} from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../../constants/Colors';
import { useAuth } from '@clerk/expo';
import { apiClient } from '../../utils/api';
import { ErrorState } from '../../components/ErrorState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHOWCASE_CARD_WIDTH = SCREEN_WIDTH * 0.72;
const SHOWCASE_CARD_HEIGHT = 200;

export default function WriterProfileScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [writer, setWriter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [activeShowcase, setActiveShowcase] = useState(0);

  const fetchWriter = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorProfile(null);
      const token = await getToken();
      const res = await apiClient.get(`/users/${id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = res.data;
      if (data.success) setWriter(data.data);
      else setErrorProfile(data.error || 'Failed to load writer info');
    } catch (err: any) {
      setErrorProfile(err instanceof Error ? err.message : 'Failed to fetch writer profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWriter(); }, [id]);

  // ── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Error State ────────────────────────────────────────
  if (errorProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <ErrorState message={errorProfile} onRetry={fetchWriter} />
      </View>
    );
  }

  // ── Not Found ──────────────────────────────────────────
  if (!writer) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.emptyIconBox}>
          <Eye color={Colors.textTertiary} size={32} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Profile not found</Text>
        <Text style={styles.emptyDesc}>This writer profile doesn't exist or was removed.</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Computed Values ────────────────────────────────────
  const calculateRealRating = (writer: any) => {
    // 1. Use pre-calculated rating from database if it exists
    if (writer.avgRatingRecvd !== null && writer.avgRatingRecvd !== undefined) {
      return Number(writer.avgRatingRecvd).toFixed(1);
    }
    // 2. Fallback to calculating from Rating_received array if pre-calculated is missing
    const ratings = writer.Rating_received || [];
    if (ratings.length === 0) return null;
    const total = ratings.reduce((sum: number, r: any) => sum + r.score, 0);
    return (total / ratings.length).toFixed(1);
  };

  const realRating = calculateRealRating(writer);
  const ratingAvg = realRating || (writer.totalCompleted > 0 ? (writer.trustScore > 90 ? '5.0' : writer.trustScore > 80 ? '4.8' : writer.trustScore > 70 ? '4.5' : '4.0') : 'New');
  const ratingNum = parseFloat(String(ratingAvg)) || 0;
  const trustLevel = writer.trustScore >= 90 ? 'Excellent' : writer.trustScore >= 80 ? 'Great' : writer.trustScore >= 70 ? 'Good' : 'Building';
  const trustColor = writer.trustScore >= 90 ? Colors.accent : writer.trustScore >= 80 ? Colors.primary : writer.trustScore >= 70 ? Colors.warning : Colors.textTertiary;
  const hasShowcase = writer.showcaseUrls && writer.showcaseUrls.length > 0;
  const hasReviews = writer.Rating_received && writer.Rating_received.length > 0;
  const reviewCount = hasReviews ? writer.Rating_received.length : 0;

  // ══════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── Floating Back Button ─────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Writer Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero Section: Avatar + Identity ─────── */}
        <View style={styles.heroSection}>
          {/* Glow circles */}
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          {/* Avatar */}
          <View style={styles.avatarOuter}>
            <View style={styles.avatarRing}>
              {writer.avatarUrl ? (
                <Image source={{ uri: writer.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{writer.name?.charAt(0) || 'W'}</Text>
                </View>
              )}
            </View>
            {writer.isVerified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle2 color="#fff" fill={Colors.accent} size={22} />
              </View>
            )}
          </View>

          {/* Name + Location */}
          <Text style={styles.writerName}>{writer.name}</Text>
          {writer.isVerified && (
            <View style={styles.verifiedPill}>
              <Shield color={Colors.accent} size={12} strokeWidth={2.5} />
              <Text style={styles.verifiedPillText}>Verified Writer</Text>
            </View>
          )}
          <View style={styles.locationPill}>
            <MapPin color={Colors.textSecondary} size={13} strokeWidth={2} />
            <Text style={styles.locationText}>{writer.college || 'Campus'}</Text>
          </View>
        </View>

        {/* ── Stats Cards Row ─────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: Colors.warningSoft }]}>
              <Star color={Colors.warning} fill={Colors.warning} size={18} />
            </View>
            <Text style={styles.statValue}>{ratingAvg}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: Colors.primarySoft }]}>
              <Award color={Colors.primary} size={18} />
            </View>
            <Text style={styles.statValue}>{writer.totalCompleted || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: Colors.accentSoft }]}>
              <TrendingUp color={Colors.accent} size={18} />
            </View>
            <Text style={styles.statValue}>{trustLevel}</Text>
            <Text style={styles.statLabel}>Trust</Text>
          </View>
        </View>

        {/* ── Trust Score Bar ─────── */}
        <View style={styles.trustBarSection}>
          <View style={styles.trustBarHeader}>
            <Text style={styles.trustBarLabel}>Trust Score</Text>
            <Text style={[styles.trustBarValue, { color: trustColor }]}>{writer.trustScore || 0}%</Text>
          </View>
          <View style={styles.trustBarTrack}>
            <View style={[styles.trustBarFill, { width: `${Math.min(writer.trustScore || 0, 100)}%`, backgroundColor: trustColor }]} />
          </View>
        </View>

        {/* ── About / Description ─────── */}
        {writer.description ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen color={Colors.textTertiary} size={16} strokeWidth={2} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutText}>{writer.description}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Showcase Gallery ─────── */}
        {hasShowcase && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Eye color={Colors.textTertiary} size={16} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Showcase</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{writer.showcaseUrls.length}</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.showcaseScroll}
              pagingEnabled={false}
              snapToInterval={SHOWCASE_CARD_WIDTH + Spacing.md}
              decelerationRate="fast"
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (SHOWCASE_CARD_WIDTH + Spacing.md));
                setActiveShowcase(idx);
              }}
              scrollEventThrottle={16}
            >
              {writer.showcaseUrls.map((url: string, index: number) => (
                <View key={index} style={styles.showcaseCard}>
                  <Image source={{ uri: url }} style={styles.showcaseImage} resizeMode="cover" />
                  <View style={styles.showcaseOverlay} />
                  <View style={styles.showcaseLabel}>
                    <Text style={styles.showcaseLabelText}>Sample {index + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            {/* Pagination dots */}
            {writer.showcaseUrls.length > 1 && (
              <View style={styles.dotsRow}>
                {writer.showcaseUrls.map((_: any, i: number) => (
                  <View key={i} style={[styles.dot, activeShowcase === i && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Quick Info Cards ─────── */}
        <View style={styles.quickInfoGrid}>
          <View style={styles.quickInfoCard}>
            <FileText color={Colors.primary} size={18} />
            <View style={styles.quickInfoContent}>
              <Text style={styles.quickInfoValue}>{writer.totalPagesWritten || 0}</Text>
              <Text style={styles.quickInfoLabel}>Pages Written</Text>
            </View>
          </View>
          <View style={styles.quickInfoCard}>
            <MessageSquare color={Colors.accent} size={18} />
            <View style={styles.quickInfoContent}>
              <Text style={styles.quickInfoValue}>{reviewCount}</Text>
              <Text style={styles.quickInfoLabel}>Reviews</Text>
            </View>
          </View>
        </View>

        {/* ── Reviews Section ─────── */}
        {hasReviews && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThumbsUp color={Colors.textTertiary} size={16} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Reviews</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{reviewCount}</Text>
              </View>
            </View>

            {/* Average star display */}
            <View style={styles.reviewSummaryCard}>
              <Text style={styles.reviewSummaryBigNum}>{ratingAvg}</Text>
              <View style={styles.reviewSummaryRight}>
                <View style={styles.starsRow}>
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} color={i < ratingNum ? Colors.warning : Colors.border} fill={i < ratingNum ? Colors.warning : 'transparent'} />
                  ))}
                </View>
                <Text style={styles.reviewSummarySubtext}>Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {/* Individual reviews */}
            {writer.Rating_received.map((review: any) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewUserRow}>
                    {review.User_giver?.avatarUrl ? (
                      <Image source={{ uri: review.User_giver.avatarUrl }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={styles.reviewAvatarFallback}>
                        <Text style={styles.reviewAvatarLetter}>{review.User_giver?.name?.charAt(0) || 'U'}</Text>
                      </View>
                    )}
                    <View style={styles.reviewUserInfo}>
                      <Text style={styles.reviewUserName}>{review.User_giver?.name || 'Anonymous'}</Text>
                      <View style={styles.starsRowSmall}>
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={11} color={i < review.score ? Colors.warning : Colors.border} fill={i < review.score ? Colors.warning : 'transparent'} />
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.reviewScorePill}>
                    <Text style={styles.reviewScoreText}>{review.score}.0</Text>
                  </View>
                </View>

                {review.comment ? (
                  <Text style={styles.reviewComment}>"{review.comment}"</Text>
                ) : null}

                {review.Task?.title ? (
                  <View style={styles.reviewTaskPill}>
                    <FileText size={11} color={Colors.textTertiary} strokeWidth={2} />
                    <Text style={styles.reviewTaskText} numberOfLines={1}>{review.Task.title}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* ── Empty Reviews Placeholder ─────── */}
        {!hasReviews && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThumbsUp color={Colors.textTertiary} size={16} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Reviews</Text>
            </View>
            <View style={styles.emptyReviewsCard}>
              <View style={styles.emptyIconBoxSmall}>
                <MessageSquare color={Colors.textTertiary} size={24} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyReviewsTitle}>No reviews yet</Text>
              <Text style={styles.emptyReviewsDesc}>Reviews will appear here after completed tasks.</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
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

  // ── Top Bar ──────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  topBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  // ── Hero / Profile Header ────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowA: {
    position: 'absolute',
    top: -30,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    opacity: 0.5,
  },
  heroGlowB: {
    position: 'absolute',
    top: 20,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: Colors.accentSoft,
    opacity: 0.4,
  },
  avatarOuter: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.primary + '40',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  avatarImg: {
    width: 98,
    height: 98,
    borderRadius: 33,
    backgroundColor: Colors.surfaceElevated,
  },
  avatarFallback: {
    width: 98,
    height: 98,
    borderRadius: 33,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  writerName: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginBottom: 8,
  },
  verifiedPillText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  locationText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // ── Stats Cards ──────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // ── Trust Score Bar ──────────────────────────────────
  trustBarSection: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trustBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  trustBarLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  trustBarValue: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  trustBarTrack: {
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // ── Sections ─────────────────────────────────────────
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },

  // ── About Card ───────────────────────────────────────
  aboutCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  aboutText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // ── Showcase Gallery ─────────────────────────────────
  showcaseScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  showcaseCard: {
    width: SHOWCASE_CARD_WIDTH,
    height: SHOWCASE_CARD_HEIGHT,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  showcaseImage: {
    width: '100%',
    height: '100%',
  },
  showcaseOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  showcaseLabel: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  showcaseLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },

  // ── Quick Info Grid ──────────────────────────────────
  quickInfoGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickInfoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
  },
  quickInfoContent: {
    flex: 1,
  },
  quickInfoValue: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  quickInfoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginTop: 1,
  },

  // ── Review Summary ───────────────────────────────────
  reviewSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    gap: Spacing.lg,
  },
  reviewSummaryBigNum: {
    fontSize: FontSize['4xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  reviewSummaryRight: {
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  starsRowSmall: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewSummarySubtext: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
  },

  // ── Review Cards ─────────────────────────────────────
  reviewCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
  },
  reviewAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarLetter: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accent,
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  reviewScorePill: {
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  reviewScoreText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.warning,
  },
  reviewComment: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
    letterSpacing: 0.1,
  },
  reviewTaskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
  },
  reviewTaskText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '600',
    flexShrink: 1,
  },

  // ── Empty States ─────────────────────────────────────
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    marginBottom: Spacing.lg,
  },
  goBackBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  goBackText: {
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  emptyReviewsCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  emptyIconBoxSmall: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyReviewsTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptyReviewsDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});