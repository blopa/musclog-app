import { useTranslation } from 'react-i18next';

import { WeeklyStreakCard } from '@/components/cards/WeeklyStreakCard';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useMacroStreak } from '@/hooks/useMacroStreak';
import { useWeeklyWorkoutProgress } from '@/hooks/useWeeklyWorkoutProgress';

type WeeklyHomeSummaryProps = {
  date: Date;
  onCreateWorkoutGoalPress: () => void;
};

export function WeeklyHomeSummary({ date, onCreateWorkoutGoalPress }: WeeklyHomeSummaryProps) {
  const { t } = useTranslation();
  const {
    currentStreak: macroStreak,
    bestStreak: bestMacroStreak,
    isLoading: isLoadingStreak,
  } = useMacroStreak({ date });
  const {
    workoutsThisWeek,
    weeklyGoal,
    isLoading: isLoadingWeeklyWorkoutProgress,
  } = useWeeklyWorkoutProgress({
    date,
    visible: true,
  });

  if (isLoadingStreak || isLoadingWeeklyWorkoutProgress) {
    return <SkeletonLoader width="100%" height={180} borderRadius={16} />;
  }

  return (
    <AnimatedContent>
      <WeeklyStreakCard
        workoutsThisWeek={workoutsThisWeek}
        weeklyGoal={weeklyGoal}
        streakDays={macroStreak}
        bestStreakDays={bestMacroStreak}
        bestStreakLabel={t('weeklyStreakCard.bestStreak')}
        onCreateWorkoutGoalPress={onCreateWorkoutGoalPress}
      />
    </AnimatedContent>
  );
}
