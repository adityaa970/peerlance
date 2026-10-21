import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { supabase } from '../lib/supabase';

export interface AppVersion {
  id: string;
  platform: 'android' | 'ios';
  versionCode: number;
  versionName: string;
  changelog: string[];
  isMandatory: boolean;
  updateUrl: string;
  isActive: boolean;
  createdAt: string;
}

export const getCurrentVersionCode = (): number => {
  if (Platform.OS === 'android') {
    return Constants.expoConfig?.android?.versionCode ?? 1;
  } else {
    return parseInt(Constants.expoConfig?.ios?.buildNumber ?? '1', 10);
  }
};

export const getCurrentVersionName = (): string => {
  return Constants.expoConfig?.version ?? '1.0.0';
};

export const checkForUpdates = async (): Promise<AppVersion | null> => {
  try {
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    const currentCode = getCurrentVersionCode();

    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .gt('version_code', currentCode)
      .order('version_code', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No new version found
      console.error('[UpdateService] Error checking for updates:', error);
      return null;
    }

    // Convert changelog from JSON array to actual string array if needed
    const changelog = Array.isArray(data.changelog) 
      ? data.changelog 
      : (typeof data.changelog === 'string' ? JSON.parse(data.changelog) : []);

    return {
      id: data.id,
      platform: data.platform,
      versionCode: data.version_code,
      versionName: data.version_name,
      changelog: changelog,
      isMandatory: data.is_mandatory,
      updateUrl: data.update_url,
      isActive: data.is_active,
      createdAt: data.created_at
    } as AppVersion;
  } catch (err) {
    console.error('[UpdateService] Unexpected error:', err);
    return null;
  }
};

export const performUpdate = async (updateUrl: string) => {
  try {
    // Check if it's an Expo OTA update or a direct link
    // If it's a URL ending in .apk or a store link, we use Linking
    if (updateUrl.startsWith('http')) {
      const supported = await Linking.canOpenURL(updateUrl);
      if (supported) {
        await Linking.openURL(updateUrl);
      } else {
        console.error('[UpdateService] Cannot open URL:', updateUrl);
      }
    } else {
      // If no URL is provided but we have expo-updates, we could try OTA
      // For now, focus on the user's request for "direct download"
      console.warn('[UpdateService] No valid update URL provided');
    }
  } catch (err) {
    console.error('[UpdateService] Error performing update:', err);
  }
};

export const fetchOtaUpdate = async () => {
    try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
        }
    } catch (e) {
        console.error('[UpdateService] OTA Update failed', e);
    }
}
