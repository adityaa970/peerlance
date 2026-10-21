import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, ScrollView, Image, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Search, X, Shield, ShieldOff, UserCheck, UserX, CreditCard, ChevronRight, Mail, School, Star } from 'lucide-react-native';
import { apiClient } from '../../utils/api';

export default function AdminUsersScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, poster, writer, admin, verified, banned
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/users', { params: { search, filter } });
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    const timeout = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  const handleAction = async (userId: string, action: string, value: any) => {
    try {
      setProcessing(true);
      const res = await apiClient.patch('/admin/users', { userId, action, value });
      if (res.data.success) {
        Alert.alert('Success', `User updated successfully.`);
        // Update local state
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, ...res.data.user } : u
        ));
        if (selectedUser?.id === userId) {
          setSelectedUser((prev: any) => ({ ...prev, ...res.data.user }));
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user');
    } finally {
      setProcessing(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'admin') return '#A78BFA';
    if (role === 'writer') return '#34D399';
    return '#22D3EE';
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => setSelectedUser(item)}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{item.name?.charAt(0)?.toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) + '22', borderColor: getRoleBadgeColor(item.role) + '44' }]}>
            <Text style={[styles.roleBadgeText, { color: getRoleBadgeColor(item.role) }]}>{item.role?.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
        <View style={styles.userMeta}>
          <Text style={[styles.statusDot, { color: item.isActive ? '#34D399' : '#FB7185' }]}>●</Text>
          <Text style={styles.userMetaText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
          <Text style={styles.userMetaSep}>•</Text>
          <Text style={styles.userMetaText}>₹{item.walletBalance?.toFixed(0) || 0}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerCount}>{users.length} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or college..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['all', 'poster', 'writer', 'admin', 'verified', 'banned'].map((f) => (
            <TouchableOpacity 
              key={f} 
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchUsers}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
        />
      )}

      {/* User Detail Modal */}
      <Modal visible={!!selectedUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Details</Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <X size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Profile Section */}
              <View style={styles.profileSection}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{selectedUser?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.profileName}>{selectedUser?.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(selectedUser?.role) + '22', borderColor: getRoleBadgeColor(selectedUser?.role) + '44', alignSelf: 'center' }]}>
                  <Text style={[styles.roleBadgeText, { color: getRoleBadgeColor(selectedUser?.role) }]}>{selectedUser?.role?.toUpperCase()}</Text>
                </View>
              </View>

              {/* Info Cards */}
              <View style={styles.infoRow}>
                <Mail size={16} color={Colors.textTertiary} />
                <Text style={styles.infoText}>{selectedUser?.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <School size={16} color={Colors.textTertiary} />
                <Text style={styles.infoText}>{selectedUser?.college || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <CreditCard size={16} color={Colors.textTertiary} />
                <Text style={styles.infoText}>Wallet: ₹{selectedUser?.walletBalance?.toFixed(2)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Star size={16} color={Colors.textTertiary} />
                <Text style={styles.infoText}>Trust Score: {selectedUser?.trustScore || 0} | Completed: {selectedUser?.totalCompleted || 0}</Text>
              </View>

              {/* Verification Status */}
              <View style={styles.statusSection}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Verified</Text>
                  <View style={[styles.statusChip, { backgroundColor: selectedUser?.isVerified ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)' }]}>
                    <Text style={{ color: selectedUser?.isVerified ? '#34D399' : '#FB7185', fontSize: 12, fontWeight: '700' }}>
                      {selectedUser?.isVerified ? 'YES' : 'NO'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Active</Text>
                  <View style={[styles.statusChip, { backgroundColor: selectedUser?.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)' }]}>
                    <Text style={{ color: selectedUser?.isActive ? '#34D399' : '#FB7185', fontSize: 12, fontWeight: '700' }}>
                      {selectedUser?.isActive ? 'YES' : 'NO'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ID Card */}
              {selectedUser?.idCardUrl && (
                <View style={styles.idCardSection}>
                  <Text style={styles.sectionLabel}>ID Card</Text>
                  <Image
                    source={{ uri: selectedUser.idCardUrl }}
                    style={styles.idCardImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: selectedUser?.isActive ? 'rgba(251,113,133,0.15)' : 'rgba(52,211,153,0.15)' }]}
                onPress={() => handleAction(selectedUser?.id, 'toggleActive', !selectedUser?.isActive)}
                disabled={processing}
              >
                {selectedUser?.isActive ?
                  <ShieldOff size={18} color="#FB7185" /> :
                  <Shield size={18} color="#34D399" />
                }
                <Text style={[styles.actionBtnText, { color: selectedUser?.isActive ? '#FB7185' : '#34D399' }]}>
                  {selectedUser?.isActive ? 'Ban' : 'Activate'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}
                onPress={() => {
                  Alert.alert(
                    'Reset Account?',
                    'This will set balance to 0 and permanently DELETE all transaction history for this user. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Yes, Reset', 
                        style: 'destructive',
                        onPress: () => handleAction(selectedUser?.id, 'resetAccount', true)
                      }
                    ]
                  );
                }}
                disabled={processing}
              >
                <X size={18} color="#A78BFA" />
                <Text style={[styles.actionBtnText, { color: '#A78BFA' }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-end',
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
    marginBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderColor: '#A78BFA',
  },
  filterText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#A78BFA',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A78BFA',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    fontSize: 8,
  },
  userMetaText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  userMetaSep: {
    color: Colors.textTertiary,
    fontSize: 10,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalBody: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#A78BFA',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  statusSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  statusItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 6,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  idCardSection: {
    marginBottom: 24,
  },
  idCardImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
