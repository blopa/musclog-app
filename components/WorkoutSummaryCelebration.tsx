import { Home, MessageCircle, Trophy } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './cards/GenericCard';
import { WorkoutSummaryStatsCard } from './cards/WorkoutSummaryStatsCard';
import { Button } from './theme/Button';
import { WorkoutSummaryHeader } from './WorkoutSummaryHeader';
import { WorkoutSummaryTrophy } from './WorkoutSummaryTrophy';

type WorkoutSummaryCelebrationProps = {
  onGoHome: () => void;
  onShareSummary?: () => void;
  onGetFeedback?: () => void;
  isGetFeedbackLoading?: boolean;
  totalTime?: string; // e.g., "45m"
  volume?: string; // e.g., "12,450 kg"
  personalRecords?: number; // e.g., 2
  caloriesBurned?: number; // e.g., 350
  goalProgress?: { exerciseName: string; current: number; target: number; unit: string }[];
};

// TODO: UI issue here
export function WorkoutSummaryCelebration({
  onGoHome,
  onShareSummary,
  onGetFeedback,
  isGetFeedbackLoading = false,
  totalTime = '45m',
  volume = '12,450 kg',
  personalRecords = 2,
  caloriesBurned,
  goalProgress = [],
}: WorkoutSummaryCelebrationProps) {
  const theme = useTheme();
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
          height: '100dvh',
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
            caloriesBurned={caloriesBurned}
          />

          {/* Goal Progress Nudge */}
          {goalProgress.length > 0 ? (
            <View className="mt-6 w-full gap-4">
              {goalProgress.map((item, index) => {
                const progress = Math.min(100, Math.round((item.current / item.target) * 100));
                return (
                  <GenericCard key={index} variant="card">
                    <View className="p-4">
                      <View className="mb-3 flex-row items-center gap-3">
                        <View
                          className="rounded-lg p-2"
                          style={{ backgroundColor: theme.colors.accent.primary10 }}
                        >
                          <Trophy size={20} color={theme.colors.accent.primary} />
                        </View>
                        <View>
                          <Text className="font-bold text-text-primary">
                            {item.exerciseName} Goal
                          </Text>
                          <Text className="text-xs text-text-secondary">
                            {item.current} / {item.target} {item.unit}
                          </Text>
                        </View>
                      </View>
                      <View className="bg-surface-variant h-2 w-full overflow-hidden rounded-full">
                        <View
                          className="h-full bg-accent-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </View>
                      <Text className="mt-2 text-center text-xs font-bold text-accent-primary">
                        {progress === 100
                          ? t('exerciseGoals.card.congratulations')
                          : `${progress}% to Goal`}
                      </Text>
                    </View>
                  </GenericCard>
                );
              })}
            </View>
          ) : null}

          {/* Spacer */}
          <View className="flex-1" />

          {/* Get Feedback Button */}
          {onGetFeedback ? (
            <Button
              label={
                isGetFeedbackLoading
                  ? t('workoutSummary.gettingFeedback')
                  : t('workoutSummary.getFeedback')
              }
              icon={MessageCircle}
              variant="secondary"
              size="md"
              width="full"
              onPress={onGetFeedback}
              disabled={isGetFeedbackLoading}
              loading={isGetFeedbackLoading}
              style={{ marginBottom: theme.spacing.padding.base }}
            />
          ) : null}

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
