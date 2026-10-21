import * as SecureStore from 'expo-secure-store';

export interface TokenCache {
  getToken: (key: string) => Promise<string | undefined | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      }
      return item;
    } catch (error: any) {
      // If the error is due to user interaction being blocked (device locked),
      // we return null and DON'T delete the token, so it's available once unlocked.
      if (error?.message?.includes('User interaction is not allowed')) {
        return null;
      }

      // For other errors, we log and try to clear the corrupted key.
      console.error('SecureStore get item error: ', error);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignore errors during deletion.
      }
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};
