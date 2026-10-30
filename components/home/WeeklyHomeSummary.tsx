import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WeeklyStreakCard } from '@/components/cards/WeeklyStreakCard';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { ComebackProgressService } from '@/database/services/ComebackProgressService';
import { useComebackState } from '@/hooks/useComebackState';
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
  const { state: comebackState, phase: comebackPhase, today } = useComebackState();
  // While a comeback runs, "days in a row" is replaced by "active days this week"; a hard 0 is the
  // opposite of the message. Null until read, so the streak never flashes first.
  const comebackRunning = comebackState.status === 'active' && comebackPhase === 'ramp';
  const [activeDays, setActiveDays] = useState<number | null>(null);
  useEffect(() => {
    if (!comebackRunning) {
      return;
    }

    let cancelled = false;
    ComebackProgressService.activeDaysThisWeek(comebackState)
      .then((count) => {
        if (!cancelled) {
          setActiveDays(count);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // `today` re-reads at midnight; the state changes when a minimum day is logged.
  }, [comebackRunning, comebackState, today]);
  const showActiveDays = comebackRunning && activeDays !== null;
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
        streakDays={showActiveDays ? activeDays : macroStreak}
        bestStreakDays={bestMacroStreak}
        streakLabel={showActiveDays ? t('weeklyStreakCard.activeDays') : undefined}
        hideBestStreak={showActiveDays}
        bestStreakLabel={t('weeklyStreakCard.bestStreak')}
        onCreateWorkoutGoalPress={onCreateWorkoutGoalPress}
      />
    </AnimatedContent>
  );
}
