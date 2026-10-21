import { useTheme } from '@/hooks/useTheme';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  StatusBar, Platform, TextInput, Image, ActivityIndicator, RefreshControl,
  Animated, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MapPin, Search, Shield, Star, FileText, CheckCircle2, ChevronRight,
  Clock, Award, Wallet, Bell, Zap, ArrowRight, BookOpen, Send,
  TrendingUp, Users, Briefcase, Eye, Settings, Plus, ArrowUpRight
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { AssignmentCard } from '../../components/AssignmentCard';
import { formatINR } from '../../utils/format';
import { ErrorState } from '../../components/ErrorState';
import { apiClient } from '../../utils/api';
import { Spacing, Radius, FontSize, SubjectLabels, SubjectColors } from '../../constants/Colors';
import { useUserStore } from '../../store/userStore';
import { CoachMark } from '../../components/CoachMark';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Same subject codes the Post screen uses.
const SUBJECT_KEYS = ['ALL', 'MATH', 'PHYSICS', 'CHEMISTRY', 'COMPUTER_SCIENCE', 'ENGLISH', 'ECONOMICS', 'HISTORY', 'BIOLOGY', 'OTHER'];

export default function HomeScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const user = useUserStore();

  const isWriter = user.role === 'writer';
  const [topWriters, setTopWriters] = useState<any[]>([]);
  const [loadingWriters, setLoadingWriters] = useState(false);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Tour Refs
  const headerRef = useRef<View>(null);
  const actionsRef = useRef<View>(null);
  const feedRef = useRef<View>(null);
  const feedAreaRef = useRef<View>(null);

  const [tourLayouts, setTourLayouts] = useState<Record<number, any>>({});
  const [showTour, setShowTour] = useState(false);
  const completedTours = useUserStore(s => s.completedTours);
  const addCompletedTour = useUserStore(s => s.addCompletedTour);

  const measureOne = (ref: React.RefObject<View | null>, index: number) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0) {
        setTourLayouts(prev => ({ ...prev, [index]: { x, y, width, height } }));
      }
    });
  };

  const measureTour = () => {
    measureOne(headerRef, 0);
    measureOne(actionsRef, 1);
    measureOne(feedRef, 2);
    measureOne(feedAreaRef, 3);
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    const tourId = `home_${user.role}`;
    // Only trigger tour if logged in, synced, AND FOCUSED
    if (isFocused && user.isLoggedIn && user.college !== 'Not specified' && 
        !completedTours.includes(tourId) && 
        tourLayouts[0] && tourLayouts[1]) {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [completedTours, tourLayouts, user.role, user.isLoggedIn, user.college, isFocused]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTasks = activeTasks.filter(task => {
    const matchesSearch = !normalizedQuery || [task.subject, SubjectLabels[task.subject], task.instructions, task.posterName]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery));
    const matchesCategory = selectedCategory === 'ALL' || task.subject === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredWriters = topWriters.filter(writer => {
    if (!normalizedQuery) return true;
    return [writer.name, writer.description, writer.college, writer.specialty]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery));
  }).sort((a, b) => (Number(b.avgRating) || 0) - (Number(a.avgRating) || 0));

  // ── Data Fetching ──────────────────────────────────────────
  const fetchActiveTasks = async (college: string) => {
    try {
      setError(null);
      setLoadingTasks(true);
      const isDistrict = user.taskScope === 'district' && user.district;
      const url = isDistrict 
        ? `/tasks?district=${encodeURIComponent(user.district || '')}`
        : `/tasks?college=${encodeURIComponent(college)}`;
      const response = await apiClient.get(url);
      const data = response.data;
      if (data.success) setActiveTasks(data.tasks || []);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tasks');
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchTopWriters = async (college: string) => {
    try {
      setError(null);
      setLoadingWriters(true);
      const isDistrict = user.taskScope === 'district' && user.district;
      const url = isDistrict
        ? `/users/writers?district=${encodeURIComponent(user.district || '')}`
        : `/users/writers?college=${encodeURIComponent(college)}`;
      const response = await apiClient.get(url);
      const data = response.data;
      if (data.success) setTopWriters(data.writers || []);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to fetch writers');
    } finally {
      setLoadingWriters(false);
    }
  };

  useEffect(() => {
    if (!user.college) return;
    fetchActiveTasks(user.college);
    fetchTopWriters(user.college);
  }, [isWriter, user.college, user.taskScope]);

  useEffect(() => {
    if (user.isLoggedIn && !user.hasSeenOnboarding) {
      router.replace('/onboarding');
    }
  }, [user.isLoggedIn, user.hasSeenOnboarding]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user.college) {
      if (isWriter) await fetchActiveTasks(user.college);
      else await fetchTopWriters(user.college);
    }
    setRefreshing(false);
  }, [isWriter, user.college]);

  // ── Navigation Helpers ─────────────────────────────────────
  const openPrimaryAction = () => router.push(isWriter ? '/my-tasks' as any : '/post' as any);
  const openSecondaryAction = () => router.push(isWriter ? '/post' as any : '/my-tasks' as any);

  // ── Check if user is new (for onboarding) ──────────────────
  const isNewUser = isWriter
    ? (user.assignmentsCompleted || 0) === 0
    : (user.assignmentsPosted || 0) === 0;

  // ══════════════════════════════════════════════════════════
  //  RENDER SECTIONS
  // ══════════════════════════════════════════════════════════

  // ── 1. Greeting Header ────────────────────────────────────
  const renderHeader = () => (
    <View ref={headerRef} onLayout={measureTour} style={styles.headerContainer}>
      <View style={styles.headerLeft}>
        <Text style={styles.greetingText}>{getGreeting()},</Text>
        <Text style={styles.userName} numberOfLines={1}>{user.name?.split(' ')[0] || 'User'}</Text>
        <View style={styles.locationPill}>
          <MapPin color={Colors.accent} size={12} strokeWidth={2.5} />
          <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
            {user.taskScope === 'district' && user.district ? `District: ${user.district}` : (user.college !== 'Not specified' ? user.college : 'Your Campus')}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.notifButton} activeOpacity={0.7} onPress={() => router.push('/notifications' as any)}>
          <Bell color={Colors.textSecondary} size={20} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8} onPress={() => router.push('/(tabs)/profile' as any)}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{user.avatarInitial || 'U'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── 2. Wallet card (balance, main money action, key stats) ──
  const renderWalletCard = () => {
    const stats = isWriter ? [
      { label: 'Rating', value: user.avgRating ? Number(user.avgRating).toFixed(1) : '–' },
      { label: 'Completed', value: String(user.assignmentsCompleted || 0) },
      { label: 'Earned', value: formatINR(user.totalEarnings || 0) },
    ] : [
      { label: 'Posted', value: String(user.assignmentsPosted || 0) },
      { label: 'Spent', value: formatINR(user.totalSpent || 0) },
      { label: 'Writers nearby', value: String(topWriters.length || 0) },
    ];

    return (
      <View style={styles.walletCard}>
        <View style={styles.walletGlowA} />
        <View style={styles.walletGlowB} />
        <View style={styles.walletTop}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/wallet' as any)} style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>Wallet balance</Text>
            <Text style={styles.walletAmount} numberOfLines={1} adjustsFontSizeToFit>{formatINR(user.walletBalance)}</Text>
            {isWriter && (
              <Text style={styles.walletSub}>{formatINR(user.earnedBalance || 0)} withdrawable</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.walletAction}
            activeOpacity={0.85}
            onPress={() => router.push((isWriter ? '/withdraw' : '/add-funds') as any)}
          >
            {isWriter
              ? <ArrowUpRight color={Colors.primaryDark} size={16} strokeWidth={2.8} />
              : <Plus color={Colors.primaryDark} size={16} strokeWidth={2.8} />}
            <Text style={styles.walletActionText}>{isWriter ? 'Withdraw' : 'Add money'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.walletStats}>
          {stats.map((stat, i) => (
            <React.Fragment key={stat.label}>
              {i > 0 && <View style={styles.walletStatDivider} />}
              <View style={styles.walletStat}>
                <Text style={styles.walletStatValue} numberOfLines={1}>{stat.value}</Text>
                <Text style={styles.walletStatLabel} numberOfLines={1}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  // ── 3. Quick Actions ──────────────────────────────────────
  const renderQuickActions = () => (
    <View ref={actionsRef} onLayout={measureTour} style={styles.quickActionsRow}>
      <TouchableOpacity style={styles.primaryAction} activeOpacity={0.85} onPress={openPrimaryAction}>
        <View style={styles.actionIconCircle}>
          {isWriter ? <Briefcase color="#fff" size={18} strokeWidth={2.5} /> : <Send color="#fff" size={18} strokeWidth={2.5} />}
        </View>
        <Text style={styles.primaryActionText}>{isWriter ? 'My Tasks' : 'Post Assignment'}</Text>
        <ChevronRight color={Colors.textInverse} size={16} strokeWidth={2.5} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.8} onPress={openSecondaryAction}>
        <View style={[styles.actionIconCircle, { backgroundColor: Colors.surfaceElevated }]}>
          {isWriter ? <Send color={Colors.primary} size={18} strokeWidth={2.5} /> : <Eye color={Colors.primary} size={18} strokeWidth={2.5} />}
        </View>
        <Text style={styles.secondaryActionText}>{isWriter ? 'Post New' : 'My Tasks'}</Text>
      </TouchableOpacity>
    </View>
  );
 
  // ── 3.5 Admin Quick Actions ────────────────────────────────
  const renderAdminActions = () => {
    if (user.role !== 'admin') return null;
    return (
      <View style={styles.adminSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Admin Quick Actions</Text>
            <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminScroll}>
          <TouchableOpacity 
            style={[styles.adminCard, { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]} 
            onPress={() => router.push('/admin-deposits' as any)}
          >
            <View style={[styles.adminIconBox, { backgroundColor: Colors.accent }]}>
              <Shield color="#fff" size={20} />
            </View>
            <Text style={[styles.adminCardTitle, { color: Colors.accent }]}>Verify Deposits</Text>
            <Text style={styles.adminCardDesc}>Manage wallet reloads</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.adminCard, { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]} 
            onPress={() => router.push('/admin-referrals' as any)}
          >
            <View style={[styles.adminIconBox, { backgroundColor: Colors.primary }]}>
              <Users color="#fff" size={20} />
            </View>
            <Text style={[styles.adminCardTitle, { color: Colors.primary }]}>Referral Management</Text>
            <Text style={styles.adminCardDesc}>Track connections</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.adminCard, { backgroundColor: Colors.secondarySoft || Colors.borderLight, borderColor: Colors.secondary }]} 
            onPress={() => router.push('/admin-settings' as any)}
          >
            <View style={[styles.adminIconBox, { backgroundColor: Colors.secondary }]}>
              <Settings color="#fff" size={20} />
            </View>
            <Text style={[styles.adminCardTitle, { color: Colors.textPrimary }]}>App Settings</Text>
            <Text style={styles.adminCardDesc}>Configure payouts</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // ── 4. Activation Alert (Writer only) ─────────────────────
  const renderActivationAlert = () => {
    if (user.isActive || !isWriter) return null;
    return (
      <TouchableOpacity style={styles.activationCard} activeOpacity={0.8} onPress={() => router.push('/activate' as any)}>
        <View style={styles.activationGlow} />
        <View style={styles.activationIconBox}>
          <Shield color={Colors.warning} size={26} strokeWidth={2.5} />
        </View>
        <View style={styles.activationContent}>
          <Text style={styles.activationTitle}>Activate Your Account</Text>
          <Text style={styles.activationDesc}>Upload showcase images to start receiving tasks and earning money.</Text>
        </View>
        <View style={styles.activationArrow}>
          <ArrowRight color={Colors.warning} size={18} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    );
  };

  // ── 5. Search Bar ─────────────────────────────────────────
  const renderSearchBar = () => (
    <View ref={actionsRef} onLayout={measureTour} style={styles.searchWrapper}>
      <View style={styles.searchBar}>
        <Search color={Colors.textTertiary} size={18} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder={isWriter ? 'Search tasks, subjects, locations...' : 'Search writers, skills, colleges...'}
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <View style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── 6. Subject Filter Chips (Writer only) ────────────────
  const renderCategoryChips = () => {
    if (!isWriter) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {SUBJECT_KEYS.map(key => {
          const isSelected = selectedCategory === key;
          const label = key === 'ALL' ? '✨ All' : (SubjectLabels[key] || key);
          const chipColor = key === 'ALL' ? Colors.primary : (SubjectColors[key] || Colors.primary);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, isSelected && { backgroundColor: chipColor + '22', borderColor: chipColor }]}
              activeOpacity={0.7}
              onPress={() => setSelectedCategory(key)}
            >
              <Text style={[styles.chipLabel, isSelected && { color: chipColor, fontWeight: '800' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ── 7. "How It Works" Onboarding ──────────────────────────
  const renderHowItWorks = () => {
    if (!isNewUser) return null;
    const steps = isWriter
      ? [
        { num: '1', title: 'Browse', desc: 'Find tasks near campus', icon: <Search color={Colors.primary} size={20} /> },
        { num: '2', title: 'Accept', desc: 'Claim & start working', icon: <CheckCircle2 color={Colors.accent} size={20} /> },
        { num: '3', title: 'Earn', desc: 'Get paid on completion', icon: <Wallet color={Colors.warning} size={20} /> },
      ]
      : [
        { num: '1', title: 'Post', desc: 'Describe your assignment', icon: <FileText color={Colors.primary} size={20} /> },
        { num: '2', title: 'Match', desc: 'Writers apply to help', icon: <Users color={Colors.accent} size={20} /> },
        { num: '3', title: 'Done', desc: 'Review & approve work', icon: <CheckCircle2 color={Colors.warning} size={20} /> },
      ];

    return (
      <View style={styles.howSection}>
        <Text style={styles.howTitle}>How it works</Text>
        <View style={styles.howRow}>
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <View style={styles.howStep}>
                <View style={styles.howNumCircle}>
                  <Text style={styles.howNum}>{step.num}</Text>
                </View>
                <View style={styles.howIconBox}>{step.icon}</View>
                <Text style={styles.howStepTitle}>{step.title}</Text>
                <Text style={styles.howStepDesc}>{step.desc}</Text>
              </View>
              {i < steps.length - 1 && <View style={styles.howConnector}><View style={styles.howConnectorLine} /></View>}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  // ── 8. Writer Home — Available Tasks ──────────────────────
  const renderWriterContent = () => (
    <>
      <View ref={feedAreaRef} onLayout={measureTour} style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Available Tasks</Text>
          {!loadingTasks && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{filteredTasks.length}</Text></View>}
        </View>
      </View>

      {/* Task List */}
      <View style={styles.contentPad}>
        {loadingTasks ? (
          <View style={styles.loaderBox}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : filteredTasks.length > 0 ? (
          <View>
            {filteredTasks.map((task, index) => (
              <AssignmentCard
                key={task.id}
                ref={index === 0 ? feedRef : undefined}
                onLayout={index === 0 ? measureTour : undefined}
                subject={task.subject}
                pages={task.pages}
                ratePerPage={task.ratePerPage}
                amount={task.writerEarns}
                amountLabel="You earn"
                deadline={task.deadline}
                instructions={task.instructions}
                posterName={task.posterName || 'Student'}
                posterAvatarUrl={task.posterAvatarUrl}
                posterRating={task.posterRating || 5.0}
                showStatus={false}
                onPress={() => router.push(`/task/${task.id}` as any)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <BookOpen color={Colors.textTertiary} size={32} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>{normalizedQuery || selectedCategory !== 'ALL' ? 'No matching tasks' : 'No tasks yet'}</Text>
            <Text style={styles.emptyDesc}>
              {normalizedQuery || selectedCategory !== 'ALL'
                ? 'Try adjusting your search or filter.'
                : 'New tasks from your campus will appear here.'}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  // ── 9. Poster Home — Writers ──────────────────────────────
  const renderPosterContent = () => (
    <>
      <View ref={feedAreaRef} onLayout={measureTour} style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Writers near you</Text>
          {!loadingWriters && (
            <View style={[styles.countBadge, { backgroundColor: Colors.accentSoft }]}>
              <Text style={[styles.countBadgeText, { color: Colors.accent }]}>{filteredWriters.length}</Text>
            </View>
          )}
        </View>
      </View>

      {loadingWriters ? (
        <View style={styles.loaderBox}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : filteredWriters.length > 0 ? (
        <View style={styles.contentPad}>
          {filteredWriters.map((writer, index) => {
            const rating = writer.avgRating || (writer.totalCompleted > 0 ? '5.0' : null);
            return (
              <TouchableOpacity
                key={writer.id}
                ref={index === 0 ? feedRef : undefined}
                onLayout={index === 0 ? measureTour : undefined}
                style={styles.writerCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/writer/${writer.clerkId}` as any)}
              >
                {writer.avatarUrl ? (
                  <Image source={{ uri: writer.avatarUrl }} style={styles.writerAvatar} />
                ) : (
                  <View style={[styles.writerAvatar, styles.writerAvatarFallback]}>
                    <Text style={styles.writerAvatarLetter}>{writer.name?.charAt(0)?.toUpperCase() || 'W'}</Text>
                  </View>
                )}
                <View style={styles.writerInfo}>
                  <View style={styles.writerNameRow}>
                    <Text style={styles.writerName} numberOfLines={1}>{writer.name}</Text>
                    {writer.isVerified && <CheckCircle2 color={Colors.textInverse} fill={Colors.accent} size={16} />}
                  </View>
                  <Text style={styles.writerDesc} numberOfLines={1}>
                    {writer.description || writer.college || 'Campus writer'}
                  </Text>
                  <View style={styles.writerPills}>
                    <View style={[styles.writerPill, { backgroundColor: Colors.warningSoft }]}>
                      <Star color={Colors.warning} fill={rating ? Colors.warning : 'transparent'} size={11} />
                      <Text style={[styles.writerPillText, { color: Colors.warning }]}>{rating || 'New'}</Text>
                    </View>
                    <View style={styles.writerPill}>
                      <Award color={Colors.primary} size={11} strokeWidth={2.5} />
                      <Text style={styles.writerPillText}>{writer.totalCompleted || 0} done</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Users color={Colors.textTertiary} size={32} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{normalizedQuery ? 'No matching writers' : 'No writers yet'}</Text>
          <Text style={styles.emptyDesc}>
            {normalizedQuery ? 'Try a different name or skill.' : 'Writers from your campus will appear here soon.'}
          </Text>
        </View>
      )}
    </>
  );

  // ══════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <StatusBar barStyle={Colors.background === '#0B1020' ? 'light-content' : 'dark-content'} />

      {error ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {renderHeader()}
          <ErrorState message={error} onRetry={onRefresh} />
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
        >
          {renderHeader()}
          {renderWalletCard()}
          {renderAdminActions()}
          {renderActivationAlert()}
          {renderHowItWorks()}
          {renderSearchBar()}
          {renderCategoryChips()}
          {isWriter ? renderWriterContent() : renderPosterContent()}
        </ScrollView>
      )}

      <CoachMark 
        isVisible={showTour}
        onClose={() => {
          setShowTour(false);
          addCompletedTour(`home_${user.role}`);
        }}
        steps={isWriter ? [
          {
            title: "Your Earnings",
            message: "Welcome! Your balance, rating and earnings live here. Tap Withdraw to cash out what you've earned.",
            layout: tourLayouts[0]
          },
          {
            title: "Find Work",
            message: "Search by subject or keyword, or tap a subject below to filter the tasks from your campus.",
            layout: tourLayouts[1]
          },
          {
            title: filteredTasks.length > 0 ? "Claim a Task" : "Available Tasks",
            message: filteredTasks.length > 0 
              ? "This is an available assignment! Review the details, claim it, and start working to get paid."
              : "This is where assignments appear. Currently there are no tasks in your campus, but check back often!",
            layout: tourLayouts[2] || tourLayouts[3]
          }
        ] : [
          {
            title: "Poster Dashboard",
            message: "Your wallet balance and posting stats live here. Tap Add money to top up before posting.",
            layout: tourLayouts[0]
          },
          {
            title: "Find Writers",
            message: "Search writers by name, skill or college. Use the + button below to post a new assignment.",
            layout: tourLayouts[1]
          },
          {
            title: "Top Writers",
            message: "Browse the most successful writers on your campus. You can check their specialties and past performance before hiring.",
            layout: tourLayouts[2] || tourLayouts[3]
          }
        ]}
      />
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

  // ── Header ──────────────────────────────────────────────
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 62 : 44,
    paddingBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  greetingText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  userName: {
    fontSize: FontSize['3xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    gap: 5,
  },
  locationText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: 4,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textInverse,
  },
  roleBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  roleBadgeText: {
    fontSize: 10,
  },

  // ── Wallet card ─────────────────────────────────────────
  walletCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: 24,
    backgroundColor: Colors.primaryDark,
    overflow: 'hidden',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  walletGlowA: {
    position: 'absolute',
    top: -110,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  walletGlowB: {
    position: 'absolute',
    bottom: -120,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  walletTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  walletLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  walletAmount: {
    marginTop: 2,
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  walletSub: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  walletAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
  },
  walletActionText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  walletStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  walletStat: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  walletStatValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  walletStatLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Quick Actions ───────────────────────────────────────
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    gap: 8,
    elevation: 2,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.textInverse,
    fontWeight: '800',
    fontSize: FontSize.sm,
    flex: 1,
  },
  secondaryActionText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },

  // ── Activation Alert ────────────────────────────────────
  activationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.warningSoft,
    borderWidth: 1.5,
    borderColor: Colors.warning + '50',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  activationGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: Colors.warning + '15',
  },
  activationIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activationContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  activationTitle: {
    color: Colors.warning,
    fontWeight: '800',
    fontSize: FontSize.md,
    marginBottom: 3,
  },
  activationDesc: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    opacity: 0.85,
    lineHeight: 17,
  },
  activationArrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminSection: {
    marginBottom: Spacing.lg,
  },
  adminScroll: {
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.md,
    gap: Spacing.md,
    paddingVertical: 5,
  },
  adminCard: {
    width: 160,
    padding: 16,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  adminIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  adminCardDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  adminBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Search Bar ──────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.sm,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: Colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Category Chips ──────────────────────────────────────
  chipScroll: {
    paddingHorizontal: Spacing.xl,
    gap: 8,
    paddingBottom: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 5,
  },
  chipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── Section Headers ─────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  seeAllText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  seeAllMuted: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  contentPad: {
    paddingHorizontal: Spacing.xl,
  },

  // ── Loading / Empty ─────────────────────────────────────
  loaderBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.xl,
  },
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
    maxWidth: 250,
  },

  // ── Writers near you (Poster Screen) ───────────────────
  writerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  writerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
  },
  writerAvatarFallback: {
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  writerAvatarLetter: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  writerInfo: {
    flex: 1,
    minWidth: 0,
  },
  writerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  writerName: {
    flexShrink: 1,
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  writerDesc: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  writerPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  writerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  writerPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── How It Works ────────────────────────────────────────
  howSection: {
    marginTop: Spacing['2xl'],
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  howTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.3,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  howStep: {
    flex: 1,
    alignItems: 'center',
  },
  howNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  howNum: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  howIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  howStepTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  howStepDesc: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  howConnector: {
    paddingTop: 36,
    width: 20,
    alignItems: 'center',
  },
  howConnectorLine: {
    width: 20,
    height: 2,
    backgroundColor: Colors.borderLight,
    borderRadius: 1,
  },
});