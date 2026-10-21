// Peerlance Design System — dark, modern, and intentionally contrasty.

export const DarkColors = {
  // Brand
  primary: '#22D3EE',
  primaryLight: '#67E8F9',
  primaryDark: '#0891B2',
  primarySoft: 'rgba(34, 211, 238, 0.12)',
  primaryGlow: 'rgba(34, 211, 238, 0.18)',

  // Accent
  accent: '#34D399',
  accentLight: '#6EE7B7',
  accentSoft: 'rgba(52, 211, 153, 0.14)',

  // Secondary accent
  warm: '#FBBF24',
  warmSoft: 'rgba(251, 191, 36, 0.14)',
  secondary: '#A78BFA',
  secondarySoft: 'rgba(167, 139, 250, 0.14)',

  // Backgrounds
  background: '#0B1020',
  surface: '#121A2E',
  surfaceElevated: '#18213A',
  card: '#121A2E',
  cardHover: '#18213A',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  textInverse: '#081018',
  textLink: '#67E8F9',

  // Borders
  border: '#24324D',
  borderLight: '#1B2740',
  borderFocus: '#22D3EE',

  // Status
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  error: '#FB7185',
  errorSoft: 'rgba(251, 113, 133, 0.14)',
  info: '#60A5FA',
  infoSoft: 'rgba(96, 165, 250, 0.14)',

  // Subject / category colors
  subjectMath: '#FB7185',
  subjectPhysics: '#60A5FA',
  subjectChemistry: '#34D399',
  subjectEnglish: '#A78BFA',
  subjectCS: '#22D3EE',
  subjectEconomics: '#FBBF24',
  subjectHistory: '#FB923C',
  subjectBiology: '#4ADE80',
  subjectHindi: '#F472B6',
  subjectOther: '#94A3B8',

  // Tab bar
  tabBarBackground: '#0E1628',
  tabBarActive: '#22D3EE',
  tabBarInactive: '#64748B',
  tabBarBorder: '#1B2740',

  // Overlay
  overlay: 'rgba(2, 6, 23, 0.72)',
  overlayLight: 'rgba(255, 255, 255, 0.05)',

  // Shadows
  shadowColor: '#020617',
};

export const LightColors = {
  // Brand
  primary: '#0891B2',
  primaryLight: '#22D3EE',
  primaryDark: '#0E7490',
  primarySoft: 'rgba(8, 145, 178, 0.12)',
  primaryGlow: 'rgba(8, 145, 178, 0.18)',

  // Accent
  accent: '#10B981',
  accentLight: '#34D399',
  accentSoft: 'rgba(16, 185, 129, 0.14)',

  // Secondary accent
  warm: '#D97706',
  warmSoft: 'rgba(217, 119, 6, 0.14)',
  secondary: '#7C3AED',
  secondarySoft: 'rgba(124, 58, 237, 0.12)',

  // Backgrounds
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  card: '#FFFFFF',
  cardHover: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textInverse: '#F8FAFC',
  textLink: '#0284C7',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#0891B2',

  // Status
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  error: '#E11D48',
  errorSoft: 'rgba(225, 29, 72, 0.14)',
  info: '#3B82F6',
  infoSoft: 'rgba(59, 130, 246, 0.14)',

  // Subject / category colors
  subjectMath: '#E11D48',
  subjectPhysics: '#3B82F6',
  subjectChemistry: '#10B981',
  subjectEnglish: '#8B5CF6',
  subjectCS: '#0891B2',
  subjectEconomics: '#D97706',
  subjectHistory: '#EA580C',
  subjectBiology: '#22C55E',
  subjectHindi: '#DB2777',
  subjectOther: '#64748B',

  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#0891B2',
  tabBarInactive: '#94A3B8',
  tabBarBorder: '#E2E8F0',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.72)',
  overlayLight: 'rgba(0, 0, 0, 0.05)',

  // Shadows
  shadowColor: '#CBD5E1',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const CategoryColors: Record<string, string> = {
  FOOD: '#FBBF24',
  PRINTOUT: '#22D3EE',
  ERRAND: '#34D399',
  EVENT_HELP: '#A78BFA',
  DELIVERY: '#60A5FA',
  LAB_ASSISTANCE: '#F472B6',
  OTHER: '#94A3B8',
  ALL: '#22D3EE',
};

export const CategoryLabels: Record<string, string> = {
  FOOD: '🍜 Food',
  PRINTOUT: '🖨 Printout',
  ERRAND: '📍 Errand',
  EVENT_HELP: '🎪 Event Help',
  DELIVERY: '📦 Delivery',
  LAB_ASSISTANCE: '🧪 Lab',
  OTHER: '📋 Other',
  ALL: 'All',
};

export const CategoryEmojis: Record<string, string> = {
  FOOD: '🍜',
  PRINTOUT: '🖨',
  ERRAND: '📍',
  EVENT_HELP: '🎪',
  DELIVERY: '📦',
  LAB_ASSISTANCE: '🧪',
  OTHER: '📋',
  ALL: '✨',
};

export const SubjectColors: Record<string, string> = {
  ...CategoryColors,
  MATH: '#FB7185',
  PHYSICS: '#60A5FA',
  CHEMISTRY: '#34D399',
  ENGLISH: '#A78BFA',
  COMPUTER_SCIENCE: '#22D3EE',
  ECONOMICS: '#FBBF24',
  HISTORY: '#FB923C',
  BIOLOGY: '#4ADE80',
  HINDI: '#F472B6',
};

export const SubjectLabels: Record<string, string> = {
  ...CategoryLabels,
  MATH: '📐 Math',
  PHYSICS: '⚛️ Physics',
  CHEMISTRY: '🧪 Chemistry',
  ENGLISH: '📖 English',
  COMPUTER_SCIENCE: '💻 CS',
  ECONOMICS: '📊 Economics',
  HISTORY: '📜 History',
  BIOLOGY: '🧬 Biology',
  HINDI: '🔤 Hindi',
};

export const SubjectEmojis: Record<string, string> = {
  ...CategoryEmojis,
  MATH: '📐',
  PHYSICS: '⚛️',
  CHEMISTRY: '🧪',
  ENGLISH: '📖',
  COMPUTER_SCIENCE: '💻',
  ECONOMICS: '📊',
  HISTORY: '📜',
  BIOLOGY: '🧬',
  HINDI: '🔤',
};

export type UserRole = 'poster' | 'writer' | 'admin';


