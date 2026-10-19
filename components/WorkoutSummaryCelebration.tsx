import { Home, MessageCircle, Trophy } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useAppSafeAreaInsets } from '@/hooks/useAppSafeAreaInsets';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './cards/GenericCard';
import { WorkoutSummaryStatsCard } from './cards/WorkoutSummaryStatsCard';
import { Button } from './theme/Button';
import { WorkoutSummaryHeader } from './WorkoutSummaryHeader';
import { WorkoutSummaryTrophy } from './WorkoutSummaryTrophy';

type WorkoutSummaryCelebrationProps = {
  children?: ReactNode;
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
  children,
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
  const insets = useAppSafeAreaInsets();

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
            paddingTop: Platform.OS !== 'web' ? insets.top : 0,
            paddingBottom:
              Platform.OS !== 'web' ? Math.max(insets.bottom, theme.spacing.padding.base) : 0,
          },
        ]}
      >
        <View className="flex-1 items-center justify-center px-6 py-8">
          <WorkoutSummaryTrophy />
          <WorkoutSummaryHeader />
          <WorkoutSummaryStatsCard
            totalTime={totalTime}
            volume={volume}
            personalRecords={personalRecords}
            caloriesBurned={caloriesBurned}
            containerStyle={{ marginBottom: theme.spacing.margin['2xl'] }}
          />

          {/* Goal Progress Nudge */}
          {goalProgress.length > 0 ? (
            <View className="mt-6 w-full gap-4">
              {goalProgress.map((item, index) => {
                const progress = Math.min(100, Math.round((item.current / item.target) * 100));
                return (
                  <GenericCard key={index} variant="flat">
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

          {children}
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
            <Text className="text-center text-xs font-medium text-text-tertiary">
              {t('workoutSummary.shareSummary')}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
