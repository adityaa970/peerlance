import React, { useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, 
  Platform, ActivityIndicator, Dimensions, Linking
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { Download, AlertCircle, CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing, FontSize } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UpdateModalProps {
  isVisible: boolean;
  versionInfo: {
    versionCode: number;
    versionName: string;
    changelog: string[];
    updateUrl: string;
    isMandatory: boolean;
  } | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isVisible, versionInfo, onClose }) => {
  const { colors: Colors } = useTheme();
  const styles = createStyles(Colors);
  
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [status, setStatus] = useState<'IDLE' | 'DOWNLOADING' | 'READY' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!versionInfo) return null;

  const handleDownload = async () => {
    if (status === 'DOWNLOADING') return;
    
    try {
      setStatus('DOWNLOADING');
      setDownloadProgress(0);

      const filename = `peerlance_${versionInfo.versionName}.apk`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        versionInfo.updateUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        setStatus('READY');
        // Small delay before auto-install to prevent UI thread lock
        setTimeout(() => installApk(result.uri), 500);
      } else {
        throw new Error('Download failed');
      }
    } catch (e: any) {
      console.error('Download error:', e);
      setStatus('ERROR');
      setErrorMessage(e.message || 'Failed to download update');
    }
  };

  const installApk = async (uri: string) => {
    if (Platform.OS !== 'android') return;
    if (isInstalling) return;

    try {
      setIsInstalling(true);
      const isExpoGo = Constants.appOwnership === 'expo';
      
      // Get the content URI for the file
      const cURI = await FileSystem.getContentUriAsync(uri);
      
      if (!isExpoGo) {
        // Method A: Direct Intent (Best for Production/Standalone)
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: cURI,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: 'application/vnd.android.package-archive',
          });
          setIsInstalling(false);
          return;
        } catch (e) {
          console.warn('Direct intent failed, trying fallback...', e);
        }
      }

      // Check if sharing is still available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing/Package installer is not available on this device');
      }

      // Method B: Sharing Fallback (Works in Expo Go & as a reliable backup)
      // This will open a "Open with..." dialog where the user can pick "Package Installer"
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: 'Install Update',
        UTI: 'com.android.package-archive'
      });

    } catch (e: any) {
      console.error('Installation error:', e);
      // Don't set status to error if it's just a sharing conflict we can retry
      if (!e.message?.includes('processed')) {
        setStatus('ERROR');
        setErrorMessage('Failed to launch installer. Try manually installing the APK from your downloads folder.');
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Download color={Colors.primary} size={28} strokeWidth={2.5} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Update Available</Text>
              <Text style={styles.version}>v{versionInfo.versionName}</Text>
            </View>
            {!versionInfo.isMandatory && status === 'IDLE' && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X color={Colors.textTertiary} size={24} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {status === 'IDLE' && (
              <>
                <Text style={styles.sectionTitle}>What's new:</Text>
                {versionInfo.changelog.map((item, index) => (
                  <View key={index} style={styles.changelogItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.changelogText}>{item}</Text>
                  </View>
                ))}
              </>
            )}

            {status === 'DOWNLOADING' && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Downloading update... {Math.round(downloadProgress * 100)}%</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                </View>
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
              </View>
            )}

            {status === 'READY' && (
              <View style={styles.centerContent}>
                <CheckCircle2 color={Colors.success} size={48} />
                <Text style={styles.readyText}>Update is ready to install!</Text>
                <Text style={styles.hintText}>If the installer doesn't open, try the "Open in Browser" button below.</Text>
              </View>
            )}

            {status === 'ERROR' && (
              <View style={styles.centerContent}>
                <AlertCircle color={Colors.error} size={48} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {status === 'IDLE' && (
              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={handleDownload}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Update Now</Text>
              </TouchableOpacity>
            )}

            {status === 'READY' && (
              <>
                <TouchableOpacity 
                  style={styles.primaryBtn} 
                  onPress={() => installApk(`${FileSystem.cacheDirectory}peerlance_${versionInfo.versionName}.apk`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Install Now</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.secondaryBtn} 
                  onPress={() => Linking.openURL(versionInfo.updateUrl)}
                >
                  <Text style={styles.secondaryBtnText}>Open in Browser</Text>
                </TouchableOpacity>
              </>
            )}

            {status === 'ERROR' && (
              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={handleDownload}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Retry Download</Text>
              </TouchableOpacity>
            )}

            {!versionInfo.isMandatory && status === 'IDLE' && (
              <TouchableOpacity onPress={onClose} style={styles.laterBtn}>
                <Text style={styles.laterBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
            
            {versionInfo.isMandatory && status === 'IDLE' && (
              <Text style={styles.mandatoryHint}>This update is required to continue.</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (Colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  version: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 8,
    marginRight: 10,
  },
  changelogText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  progressLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: Colors.borderLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  readyText: {
    marginTop: 16,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.success,
  },
  errorText: {
    marginTop: 16,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.xl,
    paddingTop: 0,
    gap: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.xl,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  laterBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterBtnText: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: Spacing.xl,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    marginTop: Spacing.sm,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  mandatoryHint: {
    textAlign: 'center',
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 8,
    fontStyle: 'italic',
  }
});
