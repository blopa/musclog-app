import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Platform, Animated } from 'react-native';
import { Home } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Button } from './theme/Button';
import { WorkoutSummaryTrophy } from './WorkoutSummaryTrophy';
import { WorkoutSummaryHeader } from './WorkoutSummaryHeader';
import { WorkoutSummaryStatsCard } from './WorkoutSummaryStatsCard';

type WorkoutSummaryCelebrationProps = {
  visible: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onShareSummary?: () => void;
  totalTime?: string; // e.g., "45m"
  volume?: string; // e.g., "12,450 kg"
  personalRecords?: number; // e.g., 2
};

export function WorkoutSummaryCelebration({
  visible,
  onClose,
  onGoHome,
  onShareSummary,
  totalTime = '45m',
  volume = '12,450 kg',
  personalRecords = 2,
}: WorkoutSummaryCelebrationProps) {
  const { t } = useTranslation();
  const glowAnim1 = useRef(new Animated.Value(0.6)).current;
  const glowAnim2 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (visible) {
      // Glow pulse animations
      const createGlowPulse = (anim: Animated.Value, delay: number = 0) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 0.8,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.6,
              duration: 1500,
              useNativeDriver: false,
            }),
          ])
        );
      };

      createGlowPulse(glowAnim1).start();
      createGlowPulse(glowAnim2, 750).start();
    }
  }, [visible, glowAnim1, glowAnim2]);

  // Web-specific styles for proper viewport positioning
  const webModalStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}>
      <View className="flex-1 bg-bg-primary" style={webModalStyle}>
        <View className="flex-1 items-center justify-center px-6 py-8">
          {/* Background Glow Effects */}
          <Animated.View
            className="absolute left-1/2 top-1/4 h-64 w-64 rounded-full blur-3xl"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              transform: [{ translateX: -128 }, { translateY: -128 }],
              opacity: glowAnim1,
            }}
          />
          <Animated.View
            className="absolute left-1/2 top-1/3 h-48 w-48 rounded-full blur-3xl"
            style={{
              backgroundColor: 'rgba(41, 224, 142, 0.2)',
              transform: [{ translateX: -96 }, { translateY: -96 }],
              opacity: glowAnim2,
            }}
          />

          <WorkoutSummaryTrophy />
          <WorkoutSummaryHeader />
          <WorkoutSummaryStatsCard
            totalTime={totalTime}
            volume={volume}
            personalRecords={personalRecords}
          />

          {/* Spacer */}
          <View className="flex-1" />

          {/* Go Home Button */}
          <Button
            label={t('workoutSummary.goHome')}
            icon={Home}
            variant="accent"
            size="md"
            width="full"
            onPress={onGoHome}
            style={{ marginBottom: 16 }}
          />

          {/* Share Summary Link */}
          <Pressable onPress={onShareSummary}>
            <Text className="text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Share Summary
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
