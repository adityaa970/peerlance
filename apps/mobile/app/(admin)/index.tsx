import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useRouter } from 'expo-router';
import { Users, FileText, IndianRupee, Clock, TrendingUp, ArrowRight, RotateCcw, Landmark, Smartphone } from 'lucide-react-native';
import { apiClient } from '../../utils/api';

export default function AdminDashboard() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/stats');
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleResetRevenue = () => {
    Alert.alert(
      'Reset Revenue?',
      'This will set the current revenue counter to 0 by clearing fees on all existing tasks. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Now', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const res = await apiClient.post('/admin/stats/reset-revenue');
              if (res.data.success) {
                Alert.alert('Success', 'Revenue stats reset!');
                fetchStats();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reset revenue');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={22} color="#A78BFA" />, bg: 'rgba(167, 139, 250, 0.12)', color: '#A78BFA' },
    { label: 'Active Tasks', value: stats.activeTasks, icon: <FileText size={22} color="#34D399" />, bg: 'rgba(52, 211, 153, 0.12)', color: '#34D399' },
    { 
      label: 'Total Profit', 
      value: `₹${stats.totalRevenue.toLocaleString()}`, 
      icon: <IndianRupee size={22} color="#FBBF24" />, 
      bg: 'rgba(251, 191, 36, 0.12)', 
      color: '#FBBF24',
      onPress: () => router.push('/(admin)/revenue-details')
    },
    { label: 'Pending Deposits', value: stats.pendingDeposits, icon: <Clock size={22} color="#FB7185" />, bg: 'rgba(251, 113, 133, 0.12)', color: '#FB7185' },
  ] : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Admin Panel</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>SUPER USER</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#A78BFA" />
          </View>
        ) : (
          <>
            {/* Stat Cards */}
            <View style={styles.statsGrid}>
              {statCards.map((card, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={styles.statCard} 
                  disabled={!card.onPress} 
                  onPress={card.onPress}
                >
                  <View style={[styles.statIconBox, { backgroundColor: card.bg }]}>
                    {card.icon}
                  </View>
                  <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                  {card.onPress && (
                    <ArrowRight size={14} color={Colors.textTertiary} style={{ position: 'absolute', top: 12, right: 12 }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Total Tasks */}
            <View style={styles.totalCard}>
              <View style={styles.totalCardLeft}>
                <TrendingUp size={24} color="#A78BFA" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.totalLabel}>Total Tasks Created</Text>
                  <Text style={styles.totalValue}>{stats?.totalTasks || 0}</Text>
                </View>
              </View>
            </View>

            {/* Task Breakdown */}
            <Text style={styles.sectionTitle}>Assignment Breakdown</Text>
            <View style={styles.breakdownGrid}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{stats?.pendingTasks || 0}</Text>
                <Text style={styles.breakdownLabel}>Pending</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{stats?.writingTasks || 0}</Text>
                <Text style={styles.breakdownLabel}>Writing</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{stats?.submittedTasks || 0}</Text>
                <Text style={styles.breakdownLabel}>Submitted</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownValue, { color: '#34D399' }]}>{stats?.completedTasks || 0}</Text>
                <Text style={styles.breakdownLabel}>Finished</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(admin)/users')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(167, 139, 250, 0.12)' }]}>
                  <Users size={20} color="#A78BFA" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Manage Users</Text>
                  <Text style={styles.actionSub}>View, ban, or activate users</Text>
                </View>
              </View>
              <ArrowRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => router.push({ pathname: '/(admin)/financial-requests', params: { tab: 'withdrawals' } })}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(52, 211, 153, 0.12)' }]}>
                  <Landmark size={20} color="#34D399" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Verify Withdrawals</Text>
                  <Text style={styles.actionSub}>{stats?.pendingWithdrawals || 0} pending payout requests</Text>
                </View>
              </View>
              <ArrowRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => router.push('/(admin)/app-updates')}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(167, 139, 250, 0.12)' }]}>
                  <Smartphone size={20} color="#A78BFA" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Manage App Updates</Text>
                  <Text style={styles.actionSub}>Control versions and update flags</Text>
                </View>
              </View>
              <ArrowRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => router.push({ pathname: '/(admin)/financial-requests', params: { tab: 'deposits' } })}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(251, 113, 133, 0.12)' }]}>
                  <Clock size={20} color="#FB7185" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Verify Deposits</Text>
                  <Text style={styles.actionSub}>{stats?.pendingDeposits || 0} pending requests</Text>
                </View>
              </View>
              <ArrowRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleResetRevenue}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(251, 191, 36, 0.12)' }]}>
                  <RotateCcw size={20} color="#FBBF24" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Reset Revenue</Text>
                  <Text style={styles.actionSub}>Zero out platform earnings (₹0)</Text>
                </View>
              </View>
              <ArrowRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  headerGreeting: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A78BFA',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  adminBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loaderBox: {
    padding: 60,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  totalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 28,
  },
  totalCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  breakdownGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  breakdownItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
