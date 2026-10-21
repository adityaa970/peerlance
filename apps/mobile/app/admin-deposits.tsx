import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, User, MessageSquare } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';

export default function AdminDepositsScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/deposits');
      if (res.data.success) {
        setRequests(res.data.requests);
      }
    } catch (e) {
      console.error('Failed to fetch admin requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (depositId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setProcessing(true);
      const res = await apiClient.patch('/admin/deposits', {
        depositId,
        status,
        adminNote
      });

      if (res.data.success) {
        Alert.alert('Success', `Deposit ${status.toLowerCase()}!`);
        setSelectedRequest(null);
        setAdminNote('');
        fetchRequests();
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
          <User size={16} color={Colors.textTertiary} />
          <Text style={styles.userName}>{item.User?.name || 'Unknown User'}</Text>
        </View>
        <Text style={styles.amount}>₹{item.amount}</Text>
      </View>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
      {item.transactionId && (
        <Text style={styles.transactionId}>UTR: {item.transactionId}</Text>
      )}
      <Image source={{ uri: item.screenshotUrl }} style={styles.thumbnail} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Deposits</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color={Colors.accent} />
          <Text style={styles.emptyText}>All caught up! No pending deposits.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchRequests}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Verification</Text>
              <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                <XCircle color={Colors.textTertiary} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>User Details</Text>
              <Text style={styles.value}>{selectedRequest?.User?.name} ({selectedRequest?.User?.email})</Text>
              
              <Text style={styles.label}>Requested Amount</Text>
              <Text style={styles.amountLarge}>₹{selectedRequest?.amount}</Text>

              {selectedRequest?.transactionId && (
                <>
                  <Text style={styles.label}>Transaction ID / UTR</Text>
                  <Text style={styles.value}>{selectedRequest?.transactionId}</Text>
                </>
              )}

              <Text style={styles.label}>Screenshot Evidence</Text>
              <Image 
                source={{ uri: selectedRequest?.screenshotUrl }} 
                style={styles.fullImage} 
                resizeMode="contain"
              />

              <Text style={styles.label}>Internal Note (Reason for rejection/approval)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Write a note..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                value={adminNote}
                onChangeText={setAdminNote}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleAction(selectedRequest.id, 'REJECTED')}
                disabled={processing}
              >
                <XCircle color="#fff" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleAction(selectedRequest.id, 'APPROVED')}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckCircle color="#fff" size={18} style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Approve</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.accent,
  },
  date: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 12,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 12,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalBody: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  amountLarge: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.accent,
  },
  fullImage: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginTop: 12,
    height: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 20,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.error,
  },
  approveBtn: {
    backgroundColor: Colors.accent,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  }
});
