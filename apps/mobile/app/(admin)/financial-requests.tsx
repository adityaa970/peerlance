import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, User, Clock, Smartphone, Landmark, Info, ArrowLeft, Search } from 'lucide-react-native';
import { apiClient } from '../../utils/api';

type TabType = 'deposits' | 'withdrawals';

export default function AdminFinancialRequestsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const params = useLocalSearchParams<{ tab?: TabType }>();

  const [activeTab, setActiveTab] = useState<TabType>(params.tab || 'deposits');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async (tab: TabType) => {
    try {
      setLoading(true);
      const endpoint = tab === 'deposits' ? '/admin/deposits' : '/admin/withdrawals';
      const res = await apiClient.get(endpoint);
      if (res.data.success) {
        // Only show pending by default
        setRequests(res.data.requests.filter((r: any) => r.status === 'PENDING'));
      }
    } catch (e) {
      console.error(`Failed to fetch ${tab}:`, e);
      Alert.alert('Error', `Failed to load ${tab} requests`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(activeTab);
  }, [activeTab, fetchRequests]);

  const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setProcessing(true);
      const endpoint = activeTab === 'deposits' ? '/admin/deposits' : '/admin/withdrawals';
      const payload = activeTab === 'deposits' 
        ? { depositId: id, status, adminNote } 
        : { requestId: id, status, adminNote };

      const res = await apiClient.patch(endpoint, payload);

      if (res.data.success) {
        Alert.alert('Success', `${activeTab === 'deposits' ? 'Deposit' : 'Withdrawal'} ${status.toLowerCase()}!`);
        setSelectedRequest(null);
        setAdminNote('');
        fetchRequests(activeTab);
      } else {
        throw new Error(res.data.error || 'Action failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedRequest(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <User size={16} color="#A78BFA" />
          </View>
          <Text style={styles.userName}>{item.User?.name || 'Unknown User'}</Text>
        </View>
        <Text style={[styles.amount, { color: activeTab === 'deposits' ? Colors.accent : '#A78BFA' }]}>
          ₹{item.amount}
        </Text>
      </View>
      
      <View style={styles.cardFooter}>
        <View style={styles.detailBadge}>
          {activeTab === 'deposits' ? (
             <Search size={12} color={Colors.textTertiary} />
          ) : (
            item.method === 'UPI' ? <Smartphone size={12} color="#A78BFA" /> : <Landmark size={12} color="#A78BFA" />
          )}
          <Text style={styles.detailBadgeText}>
            {activeTab === 'deposits' ? (item.transactionId ? `UTR: ${item.transactionId}` : 'No UTR') : item.method}
          </Text>
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      
      {activeTab === 'deposits' && item.screenshotUrl && (
        <Image source={{ uri: item.screenshotUrl }} style={styles.thumbnail} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header & Tabs */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Requests</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'deposits' && styles.activeTab]} 
            onPress={() => setActiveTab('deposits')}
          >
            <Text style={[styles.tabText, activeTab === 'deposits' && styles.activeTabText]}>Deposits</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'withdrawals' && styles.activeTab]} 
            onPress={() => setActiveTab('withdrawals')}
          >
            <Text style={[styles.tabText, activeTab === 'withdrawals' && styles.activeTabText]}>Withdrawals</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color={activeTab === 'deposits' ? Colors.accent : '#A78BFA'} />
          <Text style={styles.emptyText}>All caught up! No pending {activeTab}.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => fetchRequests(activeTab)}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === 'deposits' ? 'Verify Deposit' : 'Process Payout'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                <XCircle color={Colors.textTertiary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.detailStatCard}>
                <Text style={styles.statLabel}>Amount to {activeTab === 'deposits' ? 'Verify' : 'Pay'}</Text>
                <Text style={[styles.statValue, { color: activeTab === 'deposits' ? Colors.accent : '#A78BFA' }]}>
                  ₹{selectedRequest?.amount}
                </Text>
              </View>

              <Text style={styles.label}>User Info</Text>
              <View style={styles.infoRow}>
                <User size={16} color={Colors.textTertiary} />
                <Text style={styles.valueText}>{selectedRequest?.User?.name} ({selectedRequest?.User?.email})</Text>
              </View>

              {activeTab === 'deposits' ? (
                <>
                  <Text style={styles.label}>Transaction Reference</Text>
                  <Text style={styles.valueText}>{selectedRequest?.transactionId || 'Not provided'}</Text>
                  
                  <Text style={styles.label}>Evidence (Screenshot)</Text>
                  {selectedRequest?.screenshotUrl ? (
                    <Image source={{ uri: selectedRequest.screenshotUrl }} style={styles.fullImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.noImage}><Text style={{color: Colors.textTertiary}}>No screenshot uploaded</Text></View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.label}>Payout Method: {selectedRequest?.method}</Text>
                  <View style={styles.methodInfoBox}>
                    {selectedRequest?.method === 'UPI' ? (
                      <>
                        <Text style={styles.subLabel}>UPI ID</Text>
                        <Text style={styles.methodValue}>{selectedRequest?.details?.upiId}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.subLabel}>Account Name</Text>
                        <Text style={styles.methodValue}>{selectedRequest?.details?.accountName}</Text>
                        <Text style={styles.subLabel}>Account / IFSC</Text>
                        <Text style={styles.methodValue}>{selectedRequest?.details?.accountNumber} / {selectedRequest?.details?.ifsc}</Text>
                        {selectedRequest?.details?.bankName && <Text style={styles.methodValue}>{selectedRequest.details.bankName}</Text>}
                      </>
                    )}
                  </View>
                </>
              )}

              <View style={styles.actionNoteContainer}>
                <Text style={styles.label}>Admin Note</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Optional note..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  value={adminNote}
                  onChangeText={setAdminNote}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.btnReject]}
                onPress={() => handleAction(selectedRequest.id, 'REJECTED')}
                disabled={processing}
              >
                <XCircle color="#fff" size={18} />
                <Text style={styles.footerBtnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.footerBtn, styles.btnApprove]}
                onPress={() => handleAction(selectedRequest.id, 'APPROVED')}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckCircle color="#fff" size={18} />
                    <Text style={styles.footerBtnText}>Approve</Text>
                  </>
                )}
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
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  activeTab: {
    backgroundColor: Colors.surfaceElevated || '#1B2740',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  activeTabText: {
    color: '#A78BFA',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  date: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: Colors.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    color: Colors.textTertiary,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '92%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  modalBody: {
    flex: 1,
  },
  detailStatCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '900',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  valueText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  fullImage: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  noImage: {
    height: 100,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfoBox: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
  },
  subLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '700',
    marginBottom: 4,
  },
  methodValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionNoteContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  footerBtn: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  btnReject: {
    backgroundColor: Colors.error,
  },
  btnApprove: {
    backgroundColor: Colors.success,
  },
  footerBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
