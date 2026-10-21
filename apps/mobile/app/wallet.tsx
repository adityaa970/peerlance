import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, History, Wallet as WalletIcon, Clock, CheckCircle, XCircle, ChevronRight, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react-native';
import { Spacing, Radius, FontSize, SubjectLabels } from '../constants/Colors';
import { formatINR } from '../utils/format';
import { useUserStore } from '../store/userStore';
import { apiClient } from '../utils/api';

export default function WalletScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const user = useUserStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch both transactions and deposit requests
      const [historyRes, depositsRes, withdrawRes] = await Promise.all([
        apiClient.get('/wallet/history'),
        apiClient.get('/wallet/deposit'),
        apiClient.get('/wallet/withdraw'),
      ]);

      let allActivities: any[] = [];

      // Add Deposit Requests (Pending, Rejected, etc.)
      if (depositsRes.data.success) {
        allActivities = [...allActivities, ...depositsRes.data.deposits.map((d: any) => ({
          ...d,
          activityType: 'DEPOSIT_REQUEST',
          title: d.status === 'PENDING' ? 'Deposit Verification' : 'Manual Deposit',
        }))];
      }

      // Add Withdrawal Requests
      if (withdrawRes.data.success) {
        allActivities = [...allActivities, ...withdrawRes.data.withdrawals.map((w: any) => ({
          ...w,
          activityType: 'WITHDRAW_REQUEST',
          title: w.status === 'PENDING' ? 'Withdrawal Pending' : 'Withdrawal Request',
          type: 'DEBIT' // Withdrawals are always debits from user perspective
        }))];
      }

      // Add Transactions (Credit, Debit)
      if (historyRes.data.success) {
        allActivities = [...allActivities, ...historyRes.data.transactions.map((t: any) => ({
          ...t,
          activityType: 'TRANSACTION',
          title: t.note || 'Wallet Transaction'
        }))];
      }

      // Remove overlapping "Approved" manual deposits to prevent duplicates
      const approvedDepositIds = new Set(
        allActivities
          .filter(a => a.activityType === 'TRANSACTION' && a.title.toLowerCase().includes('manual deposit'))
          .map(a => a.amount + '_' + new Date(a.createdAt).getTime())
      );

      // Simple deduplication logic: 
      const finalActivities = allActivities.filter(a => {
        // 1. Hide approved requests if we already have the finalized transaction for them
        if (a.activityType === 'DEPOSIT_REQUEST' && a.status === 'APPROVED') return false;
        
        // 2. For withdrawals:
        // - While PENDING or REJECTED: Hide the Transaction, show the WithdrawRequest (it has the status badge)
        // - When APPROVED: Hide the WithdrawRequest, show the Transaction (it's the official record)
        if (a.activityType === 'WITHDRAW_REQUEST' && a.status === 'APPROVED') return false; 
        
        if (a.activityType === 'TRANSACTION' && a.title.toLowerCase().includes('withdrawal request')) {
          // Find the corresponding request
          const requestId = a.title.split(': ').pop()?.trim();
          const request = allActivities.find(r => r.id === requestId && r.activityType === 'WITHDRAW_REQUEST');
          
          // If the request exists and is NOT approved yet, hide this transaction in favor of the request object
          if (request && request.status !== 'APPROVED') return false;
        }

        return true;
      });

      // Sort by date descending
      finalActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(finalActivities);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // "MATH" -> "Math"; "2 pages of MATH" -> "Math · 2 pages"
  const describeWork = (text: string) => {
    const label = (code: string) => {
      const key = code.trim().toUpperCase().replace(/\s+/g, '_');
      const known = SubjectLabels[key]?.replace(/^\S+\s/, '');
      const raw = code.trim().toLowerCase().replace(/_/g, ' ');
      return known || (raw.charAt(0).toUpperCase() + raw.slice(1));
    };
    const m = text.match(/(\d+)\s+pages?\s+of\s+([\w\s]+)/i);
    if (m) {
      const n = Number(m[1]);
      return `${label(m[2])} · ${n} ${n === 1 ? 'page' : 'pages'}`;
    }
    return text.trim() ? `${label(text)} assignment` : 'assignment';
  };

  const simplifyTitle = (item: any) => {
    const raw = String(item.title || item.note || 'Wallet transaction');
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const clean = raw.replace(uuidRegex, '').replace(/\(RefUserID:[^)]*\)/i, '').replace(/\s+:\s*$/, '').trim();
    const lower = clean.toLowerCase();
    const after = (marker: string) => clean.slice(lower.indexOf(marker) + marker.length).trim();

    if (lower.includes('escrow lock for task:')) return `Paid for ${describeWork(after('escrow lock for task:'))}`;
    if (lower.includes('payout for assignment:')) return `Earned · ${describeWork(after('payout for assignment:'))}`;
    if (lower.includes('payout for:')) return `Earned · ${describeWork(after('payout for:'))}`;
    if (lower.includes('earnings:')) return `Earned · ${describeWork(after('earnings:'))}`;
    if (lower.includes('referral')) return 'Referral reward';
    if (lower.includes('rollback') || lower.includes('refund for')) return `Refund · ${describeWork(clean.split(':').pop() || '')}`;
    if (lower.includes('withdrawal rejected')) return 'Withdrawal refunded';
    if (lower.includes('manual deposit') || lower.includes('funds added')) return 'Money added';
    if (lower.includes('withdrawal pending')) return 'Withdrawal (processing)';
    if (lower.includes('withdrawal request')) {
      if (item.activityType === 'WITHDRAW_REQUEST') {
        if (item.status === 'PENDING') return 'Withdrawal (processing)';
        if (item.status === 'REJECTED') return 'Withdrawal rejected';
        return 'Withdrawal completed';
      }
      return 'Withdrawal';
    }
    return clean.charAt(0).toUpperCase() + clean.slice(1) || 'Wallet transaction';
  };

  // Money in = green arrow in; money out = neutral arrow out; only real failures are red.
  const getActivityStyle = (item: any) => {
    if (item.status === 'PENDING') return { color: Colors.warning, bg: Colors.warningSoft, icon: <Clock size={18} color={Colors.warning} /> };
    if (item.status === 'REJECTED') return { color: Colors.error, bg: Colors.errorSoft, icon: <XCircle size={18} color={Colors.error} /> };
    const note = String(item.title || item.note || '').toLowerCase();
    if (item.type === 'CREDIT' && (note.includes('refund') || note.includes('rollback'))) {
      return { color: Colors.accent, bg: Colors.accentSoft, icon: <RotateCcw size={18} color={Colors.accent} /> };
    }
    if (item.type === 'DEBIT') return { color: Colors.textPrimary, bg: Colors.surfaceElevated, icon: <ArrowUpRight size={18} color={Colors.textSecondary} /> };
    return { color: Colors.accent, bg: Colors.accentSoft, icon: <ArrowDownLeft size={18} color={Colors.accent} /> };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <TouchableOpacity style={styles.backButton} onPress={onRefresh}>
          <History color={Colors.primary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>{formatINR(user.walletBalance)}</Text>
          </View>
          
          <View style={styles.balanceBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Added Money</Text>
              <Text style={styles.breakdownValue}>{formatINR(user.promoBalance)}</Text>
            </View>
            <View style={styles.breakdownSeparator} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Withdrawable</Text>
              <Text style={styles.breakdownValue}>{formatINR(user.earnedBalance)}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/add-funds')}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconCircle}>
                <Plus color={Colors.primary} size={20} strokeWidth={3} />
              </View>
              <Text style={styles.actionButtonText}>Add Funds</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/withdraw')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <ArrowUpRight color="#fff" size={20} strokeWidth={2.5} />
              </View>
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Feed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          {loading && !refreshing ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <History size={32} color={Colors.textTertiary} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyText}>No activity found</Text>
              <Text style={styles.emptySubtext}>Your transactions will appear here.</Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {history.map((item) => {
                const { color, bg, icon } = getActivityStyle(item);
                const isPending = item.status === 'PENDING';
                const isDebit = item.type === 'DEBIT' || item.status === 'REJECTED';
                const isCredit = item.type === 'CREDIT' || item.status === 'APPROVED';

                return (
                  <View key={item.id} style={styles.activityItem}>
                    <View style={[styles.activityIconBox, { backgroundColor: bg }]}>
                      {icon}
                    </View>
                    <View style={styles.activityContent}>
                      <View style={styles.activityMainRow}>
                        <Text style={styles.activityTitle} numberOfLines={1}>{simplifyTitle(item)}</Text>
                        <Text style={[styles.activityAmount, { color: color }]}>
                          {isPending ? '' : isDebit ? '−' : '+'}{formatINR(item.amount)}
                        </Text>
                      </View>
                      <View style={styles.activitySubRow}>
                        <Text style={styles.activityDate}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isPending && (
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>
                              {item.activityType === 'WITHDRAW_REQUEST' ? 'PENDING APPROVAL' : 'PENDING VERIFICATION'}
                            </Text>
                          </View>
                        )}
                        {item.status === 'REJECTED' && (
                          <View style={[styles.pendingBadge, { backgroundColor: Colors.errorSoft }]}>
                            <Text style={[styles.pendingBadgeText, { color: Colors.error }]}>REJECTED</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
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
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: Colors.primaryDark || '#0891B2',
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  balanceInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  breakdownValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  breakdownSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  loaderBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  activitySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.warning,
    letterSpacing: 0.5,
  },
});
