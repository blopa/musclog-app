import { PencilLine, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import PastWorkoutDetailModal from '@/components/modals/PastWorkoutDetailModal';
import { TextButton } from '@/components/theme/TextButton';
import { type PersonalRecord, WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import {
  type TemplateRecommendation,
  WorkoutProgressionService,
} from '@/database/services/WorkoutProgressionService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getWeightUnitI18nKey } from '@/utils/units';

import { WorkoutRecommendationList } from './WorkoutRecommendationList';

const PR_TYPE_KEYS = {
  weight: 'weeklyReview.prTypes.weight',
  reps: 'weeklyReview.prTypes.reps',
  volume: 'weeklyReview.prTypes.volume',
} as const;

/** The summary's progression half: records set today, and what the next session will ask for. */
export function WorkoutSummaryProgression({ logId }: { logId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const { unitsFor } = useExerciseUserSettings();
  const [error, setError] = useState(false);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [recommendations, setRecommendations] = useState<TemplateRecommendation[]>([]);
  const [edit, setEdit] = useState(false);
  const load = useCallback(async () => {
    const { workoutLog } = await WorkoutService.getWorkoutWithDetails(logId);
    const [prs, targets] = await Promise.all([
      WorkoutAnalytics.detectPersonalRecords(workoutLog),
      workoutLog.templateId
        ? WorkoutProgressionService.projectTemplate(workoutLog.templateId)
        : Promise.resolve([]),
    ]);
    setRecords(prs);
    setRecommendations(targets);
  }, [logId]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setError(true));
  }, [load]);
  return (
    <View className="w-full gap-4 py-4">
      {error ? (
        <Text accessibilityRole="alert" className="text-status-error">
          {t('errors.somethingWentWrong')}
        </Text>
      ) : null}
      {records.length ? (
        <View className="gap-2">
          {records.map((record, index) => {
            const units = unitsFor(record.exerciseId);
            return (
              <View
                key={`${record.exerciseId}-${index}`}
                className="flex-row items-center gap-3 rounded-card border border-accent-primary bg-accent-primary/10 p-3"
              >
                <Trophy size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View className="min-w-0 flex-1">
                  <Text className="text-xs font-semibold text-accent-primary">
                    {t('trainingFlow.newRecord', { type: t(PR_TYPE_KEYS[record.type]) })}
                  </Text>
                  <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                    {record.exerciseName}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {`${formatDisplayWeightKg(locale, units, record.newRecord.weight)} ${t(getWeightUnitI18nKey(units))} × ${formatInteger(record.newRecord.reps)}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {recommendations.length ? (
        <View className="gap-3">
          <Text className="text-xl font-bold text-text-primary">{t('trainingFlow.nextTime')}</Text>
          <WorkoutRecommendationList recommendations={recommendations} />
        </View>
      ) : null}
      <TextButton
        icon={PencilLine}
        align="center"
        label={t('trainingFlow.editPerformed')}
        onPress={() => setEdit(true)}
      />
      {edit ? (
        <PastWorkoutDetailModal
          visible
          workoutId={logId}
          onClose={() => {
            setEdit(false);
            void Promise.resolve()
              .then(load)
              .catch(() => setError(true));
          }}
        />
      ) : null}
    </View>
  );
}
