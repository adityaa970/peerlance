import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, TrendingUp, Calendar, User, Search, MapPin, Award } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';

export default function AdminReferralsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/referrals');
      if (res.data.success) {
        setReferrals(res.data.referrals);
      }
    } catch (e) {
      console.error('Failed to fetch admin referrals:', e);
      Alert.alert('Error', 'Failed to fetch referral data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const filteredReferrals = referrals.filter(ref => 
    ref.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.referredBy?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.primarySoft }]}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
              {item.college && (
                <View style={styles.collegeRow}>
                   <MapPin size={10} color={Colors.textTertiary} />
                   <Text style={styles.collegeText}>{item.college}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.statusBox}>
           <View style={[styles.statusBadge, item.status === 'Active' ? styles.activeBadge : styles.joinedBadge]}>
             <Text style={[styles.statusText, item.status === 'Active' ? styles.activeText : styles.joinedText]}>{item.status}</Text>
           </View>
           <Text style={styles.completedText}>{item.totalCompleted} tasks</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.referrerInfo}>
           <TrendingUp size={14} color={Colors.textTertiary} />
           <Text style={styles.footerLabel}>Referrer:</Text>
           <Text style={styles.referrerName}>{item.referredBy?.name || 'Deleted User'}</Text>
        </View>
        <View style={styles.bonusBox}>
           <Text style={styles.bonusLabel}>Bonus Paid:</Text>
           <Text style={styles.bonusValue}>₹{item.bonusPaid || 0}</Text>
        </View>
      </View>
      
      <View style={styles.dateRow}>
         <Calendar size={12} color={Colors.textTertiary} />
         <Text style={styles.dateText}>Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            placeholder="Search by name or email..."
            placeholderTextColor={Colors.textTertiary}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.statsOverview}>
         <View style={styles.overviewCard}>
            <Users size={20} color={Colors.primary} />
            <Text style={styles.overviewValue}>{referrals.length}</Text>
            <Text style={styles.overviewLabel}>Total Linked</Text>
         </View>
         <View style={styles.overviewCard}>
            <TrendingUp size={20} color={Colors.accent} />
            <Text style={styles.overviewValue}>₹{referrals.reduce((s,r) => s + (r.bonusPaid || 0), 0)}</Text>
            <Text style={styles.overviewLabel}>Total Paid</Text>
         </View>
         <View style={styles.overviewCard}>
            <Award size={20} color={Colors.warning} />
            <Text style={styles.overviewValue}>{referrals.filter(r => r.status === 'Active').length}</Text>
            <Text style={styles.overviewLabel}>Active Reps</Text>
         </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredReferrals}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchReferrals();
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Users size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No referral matches found.</Text>
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
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
  searchBarWrapper: {
    padding: 20,
    backgroundColor: Colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  statsOverview: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    backgroundColor: Colors.surface,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  overviewLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  collegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collegeText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  statusBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  joinedBadge: {
    backgroundColor: Colors.borderLight,
  },
  activeBadge: {
    backgroundColor: Colors.accentSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  joinedText: {
    color: Colors.textTertiary,
  },
  activeText: {
    color: Colors.accent,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referrerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  referrerName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  bonusBox: {
    alignItems: 'flex-end',
  },
  bonusLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  bonusValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  dateText: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textTertiary,
  }
});
