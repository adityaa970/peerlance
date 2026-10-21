import React, { useState, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, Text, Dimensions,
  SafeAreaView, Animated, Platform, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useUserStore } from '../store/userStore';
import { OnboardingSlide } from '../components/OnboardingSlide';
import { Spacing, Radius } from '../constants/Colors';
import { 
  Zap, Send, Shield, CheckCircle2, 
  ArrowRight, Wallet 
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const user = useUserStore();
  const setHasSeenOnboarding = useUserStore(s => s.setHasSeenOnboarding);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const slides = [
    {
      id: '1',
      title: 'Welcome to Peerlance',
      description: 'The ultimate marketplace for campus tasks. Get help or earn money, right here and now.',
      icon: <Image 
        source={require('../assets/images/icon.png')} 
        style={{ width: 80, height: 80, borderRadius: 20 }} 
      />,
      accentColor: Colors.primary,
    },
    {
      id: '2',
      title: user.role === 'writer' ? 'Earn While You Learn' : 'Get Help Fast',
      description: user.role === 'writer' 
        ? 'Help fellow students with their assignments and earn money on your own schedule.' 
        : 'Post your assignments and get them written by expert student writers on campus.',
      icon: user.role === 'writer' ? <Wallet color="#000" size={48} /> : <Send color="#000" size={48} />,
      accentColor: user.role === 'writer' ? Colors.accent : Colors.primary,
    },
    {
      id: '3',
      title: 'Secure & Trusted',
      description: 'Payments are held securely in escrow until the work is approved. Safe and reliable.',
      icon: <Shield color="#000" size={48} />,
      accentColor: Colors.warning,
    },
    {
      id: '4',
      title: 'Start Exploring',
      description: 'Join the community and make your campus life easier and more productive.',
      icon: <CheckCircle2 color="#000" size={48} />,
      accentColor: Colors.success,
    },
  ];

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  const Paginator = () => {
    return (
      <View style={styles.paginator}>
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 20, 10],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View 
              key={i.toString()} 
              style={[styles.dot, { width: dotWidth, opacity, backgroundColor: slides[currentIndex].accentColor }]} 
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={slides}
        renderItem={({ item }) => <OnboardingSlide {...item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />

      <View style={styles.footer}>
        <Paginator />
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: slides[currentIndex].accentColor }]} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <ArrowRight color="#000" size={20} strokeWidth={3} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.skipButton} onPress={finishOnboarding}>
          <Text style={[styles.skipText, { color: Colors.textTertiary }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  footer: {
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: Radius.xl,
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
