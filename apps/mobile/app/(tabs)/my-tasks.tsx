import { useTheme } from '../../hooks/useTheme';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, StatusBar, RefreshControl, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SendHorizonal, PenTool, Inbox, CheckCircle2, Clock, FileText } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../../constants/Colors';
import { AssignmentCard } from '../../components/AssignmentCard';
import { ErrorState } from '../../components/ErrorState';
import { apiClient } from '../../utils/api';
import { useAuth } from '@clerk/expo';
import { useUserStore } from '../../store/userStore';
import { CoachMark } from '../../components/CoachMark';
import { useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MyAssignmentsScreen() {
  const { colors: Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(Colors, insets.top), [Colors, insets.top]);
  const router = useRouter();
  const {
    getToken
  } = useAuth();
  const role = useUserStore(s => s.role);
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const college = useUserStore(s => s.college);
  const isWriter = role === 'writer';
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'REVIEW' | 'COMPLETED'>('ALL');

  // Tour State
  const tabsRef = useRef<View>(null);
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
    measureOne(tabsRef, 0);
    measureOne(feedRef, 1);
    measureOne(feedAreaRef, 2);
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    const tourId = `tasks_${role}`;
    // Only trigger if logged in, profile is synced, and FOCUSED
    if (isFocused && isLoggedIn && college !== 'Not specified' && 
        !completedTours.includes(tourId) && 
        tourLayouts[0]) {
      const timer = setTimeout(() => setShowTour(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [completedTours, tourLayouts, role, isLoggedIn, college, isFocused]);

  const fetchTasks = async () => {
    try {
      setError(null);
      const token = await getToken();
      const response = await apiClient.get(`/tasks/my?role=${role}`, {
        headers: {
          ...(token ? {
            Authorization: `Bearer ${token}`
          } : {})
        }
      });
      const data = response.data;
      setTasks(data.tasks || []);
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Could not load your assignments';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(useCallback(() => {
    fetchTasks();
  }, [role]));
  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };
  const activeStatuses = isWriter ? ['ACCEPTED', 'IN_PROGRESS', 'WRITING', 'CLAIMED'] : ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'CLAIMED'];
  const stats = {
    total: tasks.length,
    active: tasks.filter(t => activeStatuses.includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length
  };

  const matchesFilter = (t: any, f: typeof filter) => {
    if (f === 'ALL') return true;
    if (f === 'ACTIVE') return activeStatuses.includes(t.status);
    if (f === 'REVIEW') return t.status === 'UNDER_REVIEW' || t.status === 'UNDER REVIEW' || t.status === 'NEEDS APPROVAL';
    if (f === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  };
  const filteredTasks = tasks.filter(t => matchesFilter(t, filter));
  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'REVIEW', label: isWriter ? 'Under review' : 'Needs approval' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  // Things that need you first, then work in progress, then open posts, then history.
  const rank = (status: string) => {
    if (status === 'NEEDS APPROVAL') return 0;
    if (activeStatuses.includes(status) && status !== 'OPEN') return 1;
    if (status === 'UNDER REVIEW' || status === 'UNDER_REVIEW') return 2;
    if (status === 'OPEN') return 3;
    if (status === 'COMPLETED') return 4;
    return 5;
  };
  const sortedTasks = [...filteredTasks].sort((a, b) => rank(a.status) - rank(b.status));

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Work</Text>
        </View>
        <ErrorState message={error} onRetry={onRefresh} />
      </View>
    );
  }

  return <View style={styles.container}>
      {/* Header */}
      <View ref={feedAreaRef} onLayout={measureTour} style={styles.header}>
        <Text style={styles.headerTitle}>My Work</Text>
        <Text style={styles.headerSubtitle}>
          {isWriter
            ? `${stats.active} active · ${stats.completed} completed`
            : `${stats.total} posted · ${stats.active} in progress`}
        </Text>
      </View>

      {/* Tabs */}
      <View ref={tabsRef} onLayout={measureTour} style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          {filterTabs.map(tab => {
            const active = filter === tab.key;
            const count = tasks.filter(t => matchesFilter(t, tab.key)).length;
            const highlight = tab.key === 'REVIEW' && !isWriter && count > 0 && !active;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive, highlight && styles.tabAttention]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive, highlight && { color: Colors.warning }]}>{tab.label}</Text>
                <View style={[styles.tabCount, active && styles.tabCountOnActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextOnActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Assignment List */}
      <FlatList data={sortedTasks} keyExtractor={item => item.id} contentContainerStyle={styles.assignmentList} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />} renderItem={({
      item, index
    }) => {
      return <AssignmentCard
        key={item.id}
        ref={index === 0 ? feedRef : undefined}
        onLayout={index === 0 ? measureTour : undefined}
        subject={item.subject}
        pages={item.pages}
        ratePerPage={item.ratePerPage}
        deadline={item.deadline}
        instructions={item.instructions}
        posterName={item.posterName}
        posterRating={item.posterRating}
        posterAvatarUrl={item.posterAvatarUrl}
        status={item.status}
        amount={isWriter ? item.writerEarns : item.totalCost}
        amountLabel={isWriter ? 'You earn' : 'Total'} 
        onPress={() => router.push({
          pathname: `/task/[id]`,
          params: {
            id: item.id,
            status: item.status
          }
        })} 
      />;
    }} ListEmptyComponent={<View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <FileText color={Colors.textTertiary} size={48} strokeWidth={1.2} />
            </View>
            <Text style={styles.emptyTitle}>
              {tasks.length > 0
                ? `Nothing ${filterTabs.find(f => f.key === filter)?.label.toLowerCase()} right now`
                : (!isWriter ? 'No posted assignments' : 'No writing assignments')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tasks.length > 0
                ? 'Try another tab to see the rest of your assignments.'
                : (!isWriter ? 'Post your first assignment and get it written!' : 'Browse the feed and accept assignments to start earning!')}
            </Text>
            {tasks.length === 0 && <TouchableOpacity
              style={styles.emptyCta}
              activeOpacity={0.85}
              onPress={() => router.push((isWriter ? '/(tabs)' : '/(tabs)/post') as any)}
            >
              <Text style={styles.emptyCtaText}>{isWriter ? 'Browse tasks' : 'Post an assignment'}</Text>
            </TouchableOpacity>}
          </View>} />

      <CoachMark 
        isVisible={showTour}
        onClose={() => {
          setShowTour(false);
          addCompletedTour(`tasks_${role}`);
        }}
        steps={[
          {
            title: "Filter Progress",
            message: "Easily switch between your active tasks, those under review, and your complete history using these tabs.",
            layout: tourLayouts[0]
          },
          {
            title: tasks.length > 0 ? "Assignment Details" : "Your Assignments",
            message: tasks.length > 0
              ? "Click on any assignment to see details, download files, or chat with your partner."
              : "This area tracks your progress. Once you have active assignments, they will appear here for you to manage.",
            layout: tourLayouts[1] || tourLayouts[2]
          }
        ]}
      />
    </View>;
}
const createStyles = (Colors: any, topInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    paddingTop: topInset + Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs
  },
  headerTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm
  },
  tab: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabAttention: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningSoft
  },
  tabCountOnActive: {
    backgroundColor: 'rgba(0,0,0,0.15)'
  },
  tabCountTextOnActive: {
    color: Colors.textInverse
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary
  },
  tabTextActive: {
    color: Colors.textInverse,
    fontWeight: '800'
  },
  tabTextActiveGreen: {
    color: Colors.accent
  },
  tabCount: {
    minWidth: 22,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full
  },
  tabCountActive: {
    backgroundColor: Colors.primaryGlow
  },
  tabCountActiveGreen: {
    backgroundColor: Colors.accent + '20'
  },
  tabCountText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary
  },
  tabCountTextActive: {
    color: Colors.primary
  },
  tabCountTextActiveGreen: {
    color: Colors.accent
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm
  },
  quickStatItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  quickStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickStatValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary
  },
  quickStatLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textTertiary
  },
  assignmentList: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 120
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22
  },
  emptyCta: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary
  },
  emptyCtaText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textInverse
  }
});