import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ChevronLeft, IndianRupee, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react-native';
import { apiClient } from '../../utils/api';

export default function AdminRevenueDetailsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [revenueItems, setRevenueItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/revenue');
      if (res.data.success) {
        setRevenueItems(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch revenue details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRevenue();
  };

  const totalProfit = revenueItems.reduce((sum, item) => sum + (Number(item.platformFee) || 0), 0);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.revenueCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.profitBadge}>
          <Text style={styles.profitBadgeText}>+₹{item.platformFee}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Calendar size={12} color={Colors.textTertiary} />
          <Text style={styles.footerText}>
            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <IndianRupee size={12} color={Colors.textTertiary} />
          <Text style={styles.footerText}>Budget: ₹{item.budget}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={[styles.statusTag, { color: item.status === 'COMPLETED' ? '#34D399' : '#FBBF24' }]}>
            ● {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detailed Profit</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryLabel}>Total Platform Profit</Text>
          <Text style={styles.summaryValue}>₹{totalProfit.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRight}>
          <TrendingUp size={32} color="#fff" />
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Earnings History</Text>
        <Text style={styles.listHeaderCount}>{revenueItems.length} transactions</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      ) : (
        <FlatList
          data={revenueItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No revenue records found.</Text>
            </View>
          }
        />
      )}
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
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryCard: {
    margin: 20,
    backgroundColor: '#A78BFA',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
  },
  summaryRight: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  listHeaderCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  revenueCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  profitBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profitBadgeText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
});
