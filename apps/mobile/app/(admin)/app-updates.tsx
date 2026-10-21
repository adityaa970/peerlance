import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  Platform as RNPlatform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Smartphone, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react-native';
import { apiClient } from '../../utils/api';
import { Button } from '../../components/Button';
import { Radius, Spacing, FontSize } from '../../constants/Colors';

interface AppVersion {
  id: string;
  platform: 'android' | 'ios';
  version_code: number;
  version_name: string;
  changelog: string[];
  is_mandatory: boolean;
  update_url: string;
  is_active: boolean;
  created_at: string;
}

export default function AppUpdatesManagement() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();

  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: 'android' as 'android' | 'ios',
    version_name: '',
    version_code: '',
    changelog: '',
    update_url: '',
    is_mandatory: false,
    is_active: true,
  });

  const fetchVersions = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await apiClient.get('/admin/versions');
      if (res.data.success) {
        setVersions(res.data.versions);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
      Alert.alert('Error', 'Failed to load app versions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVersions();
  };

  const resetForm = () => {
    setForm({
      platform: 'android',
      version_name: '',
      version_code: '',
      changelog: '',
      update_url: '',
      is_mandatory: false,
      is_active: true,
    });
    setEditingId(null);
  };

  const handleEdit = (version: AppVersion) => {
    setForm({
      platform: version.platform,
      version_name: version.version_name,
      version_code: version.version_code.toString(),
      changelog: version.changelog.join(', '),
      update_url: version.update_url,
      is_mandatory: version.is_mandatory,
      is_active: version.is_active,
    });
    setEditingId(version.id);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!form.version_name || !form.version_code || !form.update_url) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        const res = await apiClient.patch('/admin/versions', {
          id: editingId,
          ...form,
          version_code: parseInt(form.version_code, 10),
        });
        if (res.data.success) {
          Alert.alert('Success', 'Version updated successfully');
        }
      } else {
        const res = await apiClient.post('/admin/versions', form);
        if (res.data.success) {
          Alert.alert('Success', 'Version created successfully');
        }
      }
      setModalVisible(false);
      resetForm();
      fetchVersions();
    } catch (error) {
      Alert.alert('Error', 'Failed to save version');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Version',
      'Are you sure you want to delete this version? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/admin/versions?id=${id}`);
              fetchVersions();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete version');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Updates</Text>
        <TouchableOpacity 
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }} 
          style={styles.addButton}
        >
          <Plus size={24} color="#A78BFA" />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
        contentContainerStyle={styles.scrollContent}
      >
        {loading && !refreshing && versions.length === 0 ? (
          <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} />
        ) : (
          versions.map((v) => (
            <View key={v.id} style={[styles.versionCard, !v.is_active && styles.inactiveCard]}>
              <View style={styles.cardHeader}>
                <View style={styles.platformBadge}>
                  <Smartphone size={14} color={v.platform === 'android' ? '#34D399' : '#A78BFA'} />
                  <Text style={[styles.platformText, { color: v.platform === 'android' ? '#34D399' : '#A78BFA' }]}>
                    {v.platform.toUpperCase()}
                  </Text>
                </View>
                {v.is_mandatory && (
                  <View style={styles.mandatoryBadge}>
                    <AlertTriangle size={12} color="#FB7185" />
                    <Text style={styles.mandatoryText}>MANDATORY</Text>
                  </View>
                )}
                {!v.is_active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveText}>INACTIVE</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.versionName}>v{v.version_name} ({v.version_code})</Text>
                <Text style={styles.dateText}>{new Date(v.created_at).toLocaleDateString()}</Text>
                <Text style={styles.changelogPreview} numberOfLines={2}>
                  {v.changelog.join(' • ')}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(v)}>
                  <Edit2 size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(v.id)}>
                  <Trash2 size={18} color="#FB7185" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        
        {!loading && versions.length === 0 && (
          <View style={styles.emptyState}>
            <Smartphone size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No app versions found</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Version' : 'Add New Version'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <CheckCircle2 size={24} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={styles.inputLabel}>Platform</Text>
              <View style={styles.platformSelector}>
                <TouchableOpacity 
                  onPress={() => setForm({ ...form, platform: 'android' })}
                  style={[styles.selectorBtn, form.platform === 'android' && styles.selectorBtnActive]}
                >
                  <Text style={[styles.selectorText, form.platform === 'android' && styles.selectorTextActive]}>Android</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                   onPress={() => setForm({ ...form, platform: 'ios' })}
                   style={[styles.selectorBtn, form.platform === 'ios' && styles.selectorBtnActive]}
                >
                  <Text style={[styles.selectorText, form.platform === 'ios' && styles.selectorTextActive]}>iOS</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputLabel}>Version Name</Text>
                  <TextInput 
                    style={styles.input}
                    value={form.version_name}
                    onChangeText={(t) => setForm({ ...form, version_name: t })}
                    placeholder="1.0.5"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Version Code</Text>
                  <TextInput 
                    style={styles.input}
                    value={form.version_code}
                    keyboardType="numeric"
                    onChangeText={(t) => setForm({ ...form, version_code: t })}
                    placeholder="5"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Download/Update URL</Text>
              <TextInput 
                style={styles.input}
                value={form.update_url}
                onChangeText={(t) => setForm({ ...form, update_url: t })}
                placeholder="https://..."
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.inputLabel}>Changelogs (comma separated)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]}
                value={form.changelog}
                multiline
                numberOfLines={3}
                onChangeText={(t) => setForm({ ...form, changelog: t })}
                placeholder="Bug fixes, New UI, Improvements"
                placeholderTextColor={Colors.textTertiary}
              />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Mandatory Update</Text>
                  <Text style={styles.switchSub}>Users must update to continue</Text>
                </View>
                <Switch 
                  value={form.is_mandatory}
                  onValueChange={(v) => setForm({ ...form, is_mandatory: v })}
                  trackColor={{ false: Colors.border, true: '#A78BFA' }}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Active Status</Text>
                  <Text style={styles.switchSub}>Controls visibility for users</Text>
                </View>
                <Switch 
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ false: Colors.border, true: '#A78BFA' }}
                />
              </View>

              <Button 
                title={editingId ? 'Update Version' : 'Create Version'}
                onPress={handleSubmit}
                isLoading={loading}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
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
    paddingTop: RNPlatform.OS === 'ios' ? 64 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollContent: {
    padding: 16,
  },
  versionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 113, 133, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mandatoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FB7185',
  },
  inactiveBadge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  cardBody: {
    marginBottom: 16,
  },
  versionName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  changelogPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  actionBtn: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: Colors.textTertiary,
    fontSize: 15,
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
    padding: 24,
    maxHeight: '90%',
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
  modalForm: {
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
  },
  platformSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectorBtnActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderColor: '#A78BFA',
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  selectorTextActive: {
    color: '#A78BFA',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  switchSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
