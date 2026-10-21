import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  Dimensions, Platform
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/Colors';
import { CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  title: string;
  message: string;
  layout: { x: number, y: number, width: number, height: number } | null;
}

interface CoachMarkProps {
  isVisible: boolean;
  onClose: () => void;
  steps: TourStep[];
  onStepChange?: (index: number) => void;
}

export function CoachMark({ isVisible, onClose, steps, onStepChange }: CoachMarkProps) {
  const { colors: Colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0.8)).current;
  const highlightPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const highlightSize = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const currentFileData = steps[currentStep];

  useEffect(() => {
    if (isVisible && currentFileData) {
      // Animate entry or step change
      const layout = currentFileData.layout;
      const x = layout ? layout.x : SCREEN_WIDTH / 2 - 4;
      const y = layout ? layout.y : SCREEN_HEIGHT / 2 - 4;
      const width = layout ? layout.width : 8;
      const height = layout ? layout.height : 8;
      
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.spring(bounce, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: false,
        }),
        Animated.spring(highlightPos, {
          toValue: { x: x - 4, y: y - 4 },
          useNativeDriver: false,
        }),
        Animated.spring(highlightSize, {
          toValue: { x: width + 8, y: height + 8 },
          useNativeDriver: false,
        }),
      ]).start();
    } else if (!isVisible) {
      opacity.setValue(0);
      bounce.setValue(0.8);
      setCurrentStep(0);
    }
  }, [isVisible, currentStep, currentFileData]);

  if (!isVisible || !currentFileData) return null;

  const layout = currentFileData.layout;

  // Calculate box position - try to place it below the target, or above if no space
  // If no layout, place in center
  const boxTop = layout ? layout.y + layout.height + 15 : SCREEN_HEIGHT / 2 - 100;
  const isBelow = layout ? (boxTop + 200 < SCREEN_HEIGHT) : true;
  const finalTop = isBelow ? boxTop : Math.max(Spacing.xl, layout!.y - 210);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      onStepChange?.(next);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      onStepChange?.(prev);
    }
  };

  return (
    <Modal transparent visible={isVisible} animationType="none">
      <View style={styles.overlay}>
        {/* Animated Blackout pieces */}
        {/* Top */}
        <Animated.View style={[styles.blackout, { top: 0, left: 0, width: SCREEN_WIDTH, height: highlightPos.y }]} />
        {/* Left */}
        <Animated.View style={[styles.blackout, { top: highlightPos.y, left: 0, width: highlightPos.x, height: highlightSize.y }]} />
        {/* Right */}
        <Animated.View style={[
          styles.blackout, 
          { 
            top: highlightPos.y, 
            left: Animated.add(highlightPos.x, highlightSize.x), 
            width: SCREEN_WIDTH, 
            height: highlightSize.y 
          }
        ]} />
        {/* Bottom */}
        <Animated.View style={[
          styles.blackout, 
          { 
            top: Animated.add(highlightPos.y, highlightSize.y), 
            left: 0, 
            width: SCREEN_WIDTH, 
            height: SCREEN_HEIGHT 
          }
        ]} />

        {/* Animated Highlight Border - Only show if layout exists */}
        {layout && (
          <Animated.View style={[styles.highlight, { 
            top: highlightPos.y, 
            left: highlightPos.x, 
            width: highlightSize.x, 
            height: highlightSize.y,
            borderColor: Colors.primary
          }]} />
        )}

        {/* Content Box */}
        <Animated.View style={[
          styles.contentBox, 
          { 
            top: finalTop,
            opacity,
            transform: [{ scale: bounce }],
            backgroundColor: Colors.surfaceElevated,
            borderColor: Colors.border,
          }
        ]}>
          <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
            <X color={Colors.textTertiary} size={18} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primarySoft }]}>
              <CheckCircle2 color={Colors.primary} size={18} />
            </View>
            <View>
              <Text style={[styles.title, { color: Colors.textPrimary }]}>{currentFileData.title}</Text>
              <Text style={styles.stepIndicator}>{currentStep + 1} of {steps.length}</Text>
            </View>
          </View>
          
          <Text style={[styles.message, { color: Colors.textSecondary }]}>{currentFileData.message}</Text>
          
          <View style={styles.footer}>
            {currentStep > 0 ? (
              <TouchableOpacity style={[styles.backBtn, { borderColor: Colors.border }]} onPress={handleBack}>
                <ChevronLeft color={Colors.textSecondary} size={20} />
                <Text style={[styles.backText, { color: Colors.textSecondary }]}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: Colors.primary }]} onPress={handleNext} activeOpacity={0.8}>
              <Text style={styles.nextText}>
                {currentStep === steps.length - 1 ? 'Got it!' : 'Next'}
              </Text>
              {currentStep < steps.length - 1 && <ChevronRight color="#000" size={18} strokeWidth={2.5} />}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  blackout: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  highlight: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: Radius.lg,
    backgroundColor: 'transparent',
  },
  contentBox: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  skipBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stepIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.xl,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    gap: 6,
  },
  nextText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
});
