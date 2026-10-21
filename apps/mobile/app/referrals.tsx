import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image, Platform } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Users, TrendingUp, Calendar, Award, ChevronRight, User } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';

export default function ReferralsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCount: 0, totalEarned: 0 });
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [refRes, settingsRes] = await Promise.all([
        apiClient.get('/users/referrals'),
        apiClient.get('/settings')
      ]);

      if (refRes.data.success) {
        setReferrals(refRes.data.referrals);
        setStats(refRes.data.stats);
      }
      if (settingsRes.data.success) {
        setSystemSettings(settingsRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
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

  const getStatusStyle = (status: string) => {
    if (status === 'Active') return { color: '#10B981', bg: '#DCFCE7' };
    return { color: '#6B7280', bg: '#F3F4F6' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Referrals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: Colors.primarySoft }]}>
              <Users color={Colors.primary} size={20} />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Referrals</Text>
              <Text style={styles.statValue}>{stats.totalCount}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: Colors.accentSoft }]}>
              <TrendingUp color={Colors.accent} size={20} />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Earned</Text>
              <Text style={styles.statValue}>₹{stats.totalEarned.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconBg}>
            <Award color="#fff" size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Keep Sharing!</Text>
            <Text style={styles.infoDesc}>
              {systemSettings 
                ? `You earn ₹${systemSettings.writerFirstTaskBonus} + ${Math.round(systemSettings.writerCommissionRate * 100)}% for writers, and ₹${systemSettings.posterMilestoneBonus} for every ${systemSettings.posterMilestoneCount} posters referred.`
                : "You earn ₹10 + 2% for writers, and ₹40 for every 2 posters referred."}
            </Text>
          </View>
        </View>

        {/* Referrals List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Referred Friends</Text>
          
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : referrals.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color={Colors.textTertiary} strokeWidth={1} />
              <Text style={styles.emptyText}>No referrals yet</Text>
              <Text style={styles.emptySubtext}>Share your code to start earning rewards.</Text>
            </View>
          ) : (
            referrals.map((item) => {
              const { color, bg } = getStatusStyle(item.status);
              return (
                <View key={item.id} style={styles.referralItem}>
                  <View style={styles.avatarContainer}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.primarySoft }]}>
                        <User size={20} color={Colors.primary} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.referralInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                        <Text style={[styles.statusText, { color }]}>{item.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Calendar size={12} color={Colors.textTertiary} />
                        <Text style={styles.metaText}>Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.metaDot} />
                      <Text style={styles.roleText}>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Text>
                    </View>
                  </View>

                  <View style={styles.contributionContainer}>
                    <Text style={styles.contributionLabel}>Earned</Text>
                    <Text style={styles.contributionValue}>₹{item.contribution || 0}</Text>
                  </View>
                </View>
              );
            })
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  infoCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  infoIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
  listSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    maxWidth: '65%',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 8,
  },
  roleText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  contributionContainer: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: Colors.borderLight,
    paddingLeft: 12,
  },
  contributionLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: 2,
  },
  contributionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accent,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
