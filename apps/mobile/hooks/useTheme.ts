import { useMemo } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import { useUserStore } from '../store/userStore';
import { LightColors, DarkColors } from '../constants/Colors';

export function useTheme() {
  const storeTheme = useUserStore(state => state.theme); // 'light' | 'dark' | 'system'
  const setTheme = useUserStore(state => state.setTheme);
  const systemTheme = useNativeColorScheme() || 'dark';

  const activeTheme = storeTheme === 'system' ? systemTheme : storeTheme;
  const colors = activeTheme === 'light' ? LightColors : DarkColors;

  return useMemo(() => ({
    theme: activeTheme,
    colors,
    toggleTheme: () => setTheme(activeTheme === 'dark' ? 'light' : 'dark'),
  }), [activeTheme, colors, setTheme]);
}