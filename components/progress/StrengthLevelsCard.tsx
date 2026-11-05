import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import {
  StrengthLevelSummary,
  StrengthSourceNote,
} from '@/components/strength/StrengthLevelSummary';
import { useAppLock } from '@/context/AppLockContext';
import type { ExerciseStrengthGrade } from '@/database/repositories/StrengthLevelRepository';
import { useStrengthLevels } from '@/hooks/useStrengthLevels';
import { STRENGTH_GRADED_EXERCISE_IDS } from '@/utils/strengthGradedLifts';
import { STRENGTH_LEVELS } from '@/utils/strengthLevel';

const GRADED_IDS = [...STRENGTH_GRADED_EXERCISE_IDS];

/** Strongest level first; within a level, the higher relative strength first. */
function strongestFirst(a: ExerciseStrengthGrade, b: ExerciseStrengthGrade): number {
  const byLevel = STRENGTH_LEVELS.indexOf(b.grade.level) - STRENGTH_LEVELS.indexOf(a.grade.level);
  return byLevel !== 0 ? byLevel : b.grade.normalizedStrength - a.grade.normalizedStrength;
}

/**
 * Strength levels for the graded lifts the user has trained. Renders nothing when there is no
 * grade and nothing trained, and reads nothing while the workout area is locked.
 */
export function StrengthLevelsCard() {
  const { t } = useTranslation();
  const { isLocked } = useAppLock();
  const locked = isLocked('workout');
  const { grades, performedWithoutWeighIn } = useStrengthLevels(GRADED_IDS, { enabled: !locked });

  if (locked) {
    return null;
  }

  const rows = [...grades.values()].sort(strongestFirst);
  if (rows.length === 0 && !performedWithoutWeighIn) {
    return null;
  }

  return (
    <GenericCard variant="flat">
      <View className="gap-4 p-4">
        <Text className="text-lg font-semibold text-text-primary">{t('strengthLevels.title')}</Text>
        {rows.length === 0 ? (
          <Text className="text-sm text-text-secondary">{t('strengthLevels.addWeighIn')}</Text>
        ) : (
          rows.map((row) => (
            <View key={row.exerciseId} className="gap-2">
              <Text className="text-sm font-medium text-text-primary">{row.exerciseName}</Text>
              <StrengthLevelSummary exerciseId={row.exerciseId} grade={row.grade} />
            </View>
          ))
        )}
        {rows.length > 0 ? <StrengthSourceNote /> : null}
      </View>
    </GenericCard>
  );
}
