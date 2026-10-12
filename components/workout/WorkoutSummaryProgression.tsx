import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import PastWorkoutDetailModal from '@/components/modals/PastWorkoutDetailModal';
import { Button } from '@/components/theme/Button';
import { type PersonalRecord, WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import {
  type TemplateRecommendation,
  WorkoutProgressionService,
} from '@/database/services/WorkoutProgressionService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';

import { WorkoutRecommendationList } from './WorkoutRecommendationList';

export function WorkoutSummaryProgression({ logId }: { logId: string }) {
  const { t, i18n } = useTranslation();
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
      {records.map((record, index) => (
        <Text key={`${record.exerciseId}-${index}`} className="font-semibold text-accent-primary">
          {record.exerciseName} · {t(`weeklyReview.prTypes.${record.type}`)} ·{' '}
          {record.newRecord.reps} ×{' '}
          {formatDisplayWeightKg(
            i18n.resolvedLanguage ?? i18n.language,
            unitsFor(record.exerciseId),
            record.newRecord.weight
          )}{' '}
          {unitsFor(record.exerciseId) === 'imperial' ? 'lb' : 'kg'}
        </Text>
      ))}
      <Button
        label={t('trainingFlow.editPerformed')}
        variant="outline"
        onPress={() => setEdit(true)}
      />
      {recommendations.length ? (
        <>
          <Text className="text-xl font-bold text-text-primary">{t('trainingFlow.nextTime')}</Text>
          <WorkoutRecommendationList recommendations={recommendations} />
        </>
      ) : null}
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
