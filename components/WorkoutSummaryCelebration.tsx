import { Home } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { WorkoutSummaryStatsCard } from './cards/WorkoutSummaryStatsCard';
import { Button } from './theme/Button';
import { WorkoutSummaryHeader } from './WorkoutSummaryHeader';
import { WorkoutSummaryTrophy } from './WorkoutSummaryTrophy';

type WorkoutSummaryCelebrationProps = {
  onGoHome: () => void;
  onShareSummary?: () => void;
  totalTime?: string; // e.g., "45m"
  volume?: string; // e.g., "12,450 kg"
  personalRecords?: number; // e.g., 2
};

// TODO: UI issue here
export function WorkoutSummaryCelebration({
  onGoHome,
  onShareSummary,
  totalTime = '45m',
  volume = '12,450 kg',
  personalRecords = 2,
}: WorkoutSummaryCelebrationProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const glowAnim1 = useRef(new Animated.Value(0.6)).current;
  const glowAnim2 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
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
  }, [glowAnim1, glowAnim2]);

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
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View
        className="flex-1 bg-bg-primary"
        style={[
          webModalStyle,
          {
            // Ensure absolutely positioned background blobs are clipped
            position: 'relative',
            overflow: 'hidden',
            paddingTop: Platform.OS !== 'web' ? insets.top : 0,
            paddingBottom:
              Platform.OS !== 'web' ? Math.max(insets.bottom, theme.spacing.padding.base) : 0,
          },
        ]}
      >
        {/* Background layer (absolutely positioned, non-interactive) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <Animated.View
            className="absolute left-1/2 top-1/4 rounded-full blur-3xl"
            style={{
              height: theme.size['256'],
              width: theme.size['256'],
              backgroundColor: theme.colors.status.indigo10,
              borderRadius: theme.size['256'] / 2,
              transform: [{ translateX: -theme.size['32'] }, { translateY: -theme.size['32'] }],
              opacity: glowAnim1,
            }}
          />
          <Animated.View
            className="absolute left-1/2 top-1/3 rounded-full blur-3xl"
            style={{
              height: theme.size['48'],
              width: theme.size['48'],
              backgroundColor: theme.colors.status.emerald20,
              borderRadius: theme.size['48'] / 2,
              transform: [{ translateX: -theme.size['24'] }, { translateY: -theme.size['24'] }],
              opacity: glowAnim2,
            }}
          />
        </View>

        <View className="flex-1 items-center justify-center px-6 py-8" style={{ zIndex: 1 }}>
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
            style={{ marginBottom: theme.spacing.padding.base }}
          />

          {/* Share Summary Link */}
          <Pressable onPress={onShareSummary}>
            <Text className="text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
              {t('workoutSummary.shareSummary')}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
