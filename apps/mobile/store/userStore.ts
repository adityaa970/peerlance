import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '../constants/Colors';

interface UserState {
  // Auth
  isLoggedIn: boolean;
  id: string;

  // Profile
  name: string;
  email: string;
  avatarUrl: string | null;
  avatarInitial: string;
  role: UserRole;
  college: string;
  district: string | null;
  taskScope: 'college' | 'district';
  
  // Stats (writer)
  assignmentsCompleted: number;
  totalPagesWritten: number;
  totalEarnings: number;
  walletBalance: number;
  promoBalance: number;
  earnedBalance: number;
  referralCode: string | null;
  referredById: string | null;
  
  // Stats (poster)
  assignmentsPosted: number;
  totalSpent: number;
  
  // Common
  avgRating: number;
  trustScore: number;
  
  // ID verification
  isVerified: boolean;
  isActive: boolean;
  isPublicProfile: boolean;
  idCardUri: string | null;
  idCardUrl: string | null;
  theme: 'light' | 'dark' | 'system';
  
  // Notification preferences
  pushNotificationsEnabled: boolean;
  assignmentAlertsEnabled: boolean;
  hasSeenOnboarding: boolean;
  completedTours: string[];
  
  // Actions
  setHasSeenOnboarding: (value: boolean) => void;
  addCompletedTour: (tourId: string) => void;
  setRole: (role: UserRole) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setIdCard: (uri: string) => void;
  login: (data: Partial<UserState>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Default state
      isLoggedIn: false,
      id: '',
      name: 'User',
      email: '',
      college: 'Not specified',
      district: null,
      taskScope: 'college',
      avatarInitial: 'U',
      avatarUrl: null,
      role: 'poster',
      
      assignmentsCompleted: 0,
      totalPagesWritten: 0,
      totalEarnings: 0,
      walletBalance: 0,
      promoBalance: 0,
      earnedBalance: 0,
      referralCode: null,
      referredById: null,
      
      assignmentsPosted: 0,
      totalSpent: 0,
      
      avgRating: 0.0,
      trustScore: 100,

      isVerified: false,
      isActive: false,
      isPublicProfile: true,
      idCardUri: null,
      idCardUrl: null,
      theme: 'system',
      pushNotificationsEnabled: true,
      assignmentAlertsEnabled: true,
      hasSeenOnboarding: false,
      completedTours: [],
      
      // Actions
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      addCompletedTour: (tourId) => set((state) => ({ 
        completedTours: state.completedTours.includes(tourId) 
          ? state.completedTours 
          : [...state.completedTours, tourId] 
      })),
      setTheme: (theme) => set({ theme }),
      setRole: (role) => set({ role }),
      
      setIdCard: (uri) => set({ idCardUri: uri, isVerified: true }),
      
      login: (data) => set({ isLoggedIn: true, ...data }),
      
      logout: () => set({ 
        isLoggedIn: false, 
        id: '',
        name: 'User',
        email: '',
        college: 'Not specified',
        avatarInitial: 'U',
        avatarUrl: null,
        role: 'poster'
      }),
    }),
    {
      name: 'peerlance-user-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => AsyncStorage), 
    }
  )
);
