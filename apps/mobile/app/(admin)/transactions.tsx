import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { IndianRupee, ArrowDownCircle, ArrowUpCircle, User, Calendar } from 'lucide-react-native';
import { apiClient } from '../../utils/api';

export default function AdminTransactionsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/transactions');
      if (res.data.success) {
        setTransactions(res.data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.type === 'CREDIT';
    return (
      <View style={styles.transactionCard}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: isCredit ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 113, 133, 0.12)' }]}>
            {isCredit ? (
              <ArrowDownCircle size={20} color="#34D399" />
            ) : (
              <ArrowUpCircle size={20} color="#FB7185" />
            )}
          </View>
          <View style={styles.details}>
            <Text style={styles.userName}>{item.User?.name || 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{item.User?.email}</Text>
          </View>
          <Text style={[styles.amount, { color: isCredit ? '#34D399' : '#FB7185' }]}>
            {isCredit ? '+' : '-'} ₹{item.amount}
          </Text>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.note} numberOfLines={2}>{item.note}</Text>
          <View style={styles.dateBox}>
            <Calendar size={12} color={Colors.textTertiary} />
            <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <Text style={styles.headerCount}>{transactions.length} total activity</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions found.</Text>
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
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  list: {
    padding: 16,
  },
  transactionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
    gap: 8,
  },
  note: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '500',
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
