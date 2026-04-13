import { addMonths } from 'date-fns';
import { Dumbbell, Lightbulb, TrendingUp, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import Exercise from '@/database/models/Exercise';
import { type ExerciseGoalType } from '@/database/models/ExerciseGoal';
import { ExerciseService, UserMetricService, WorkoutAnalytics } from '@/database/services';
import { type ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  isProgressionRateRealistic,
  projectGoal,
  type ProjectionResult,
} from '@/utils/exerciseGoalProjection';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { ExercisesModal } from './ExercisesModal';
import { FullScreenModal } from './FullScreenModal';

type CreationStep = 'type' | 'exercise' | 'target' | 'summary';

interface ExerciseGoalCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function ExerciseGoalCreationModal({
  visible,
  onClose,
  onSave,
}: ExerciseGoalCreationModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { locale } = useFormatAppNumber();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const [step, setStep] = useState<CreationStep>('type');
  const [goalType, setGoalType] = useState<ExerciseGoalType>('1rm');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [targetWeightDisplay, setTargetWeightDisplay] = useState(
    units === 'imperial' ? '225' : '100'
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Live projection preview
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [exerciseDataPoints, setExerciseDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [current1RM, setCurrent1RM] = useState<number | null>(null);
  const [bodyWeight, setBodyWeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep('type');
      setGoalType('1rm');
      setSelectedExercise(null);
      setTargetWeightDisplay(units === 'imperial' ? '225' : '100');
      setSessionsPerWeek(3);
      setTargetDate(null);
      setNotes('');
      setExerciseDataPoints([]);
      setCurrent1RM(null);
      return;
    }
  }, [visible, units]);

  useEffect(() => {
    if (selectedExercise && goalType === '1rm') {
      setIsLoadingHistory(true);
      Promise.all([
        WorkoutAnalytics.getProgressiveOverloadData(selectedExercise.id),
        UserMetricService.getUserBodyWeightKgForVolume(),
      ])
        .then(([data, bw]) => {
          setExerciseDataPoints(data);
          setBodyWeight(bw);
          if (data.length > 0) {
            const latest1RM = data[data.length - 1].estimated1RM;
            setCurrent1RM(latest1RM);
            setTargetWeightDisplay(
              (Math.round(kgToDisplay(latest1RM * 1.1, units) * 2) / 2).toString()
            );
          } else {
            setCurrent1RM(null);
          }
        })
        .finally(() => setIsLoadingHistory(false));
    }
  }, [selectedExercise, goalType, units]);

  const projection = useMemo<ProjectionResult | null>(() => {
    if (!selectedExercise || goalType !== '1rm' || !targetWeightDisplay || current1RM === null) {
      return null;
    }

    const targetKg = displayToKg(parseFloat(targetWeightDisplay), units);
    return projectGoal({
      dataPoints: exerciseDataPoints,
      baseline1rm: current1RM,
      targetWeight: targetKg,
      bodyWeight,
      loadMultiplier: selectedExercise.loadMultiplier ?? 1.0,
    });
  }, [
    selectedExercise,
    goalType,
    targetWeightDisplay,
    current1RM,
    exerciseDataPoints,
    bodyWeight,
    units,
  ]);

  const isRealistic = useMemo(() => {
    return projection?.isRealistic ?? true;
  }, [projection]);

  const handleNext = () => {
    if (step === 'type') setStep('exercise');
    else if (step === 'exercise') setStep('target');
    else if (step === 'target') setStep('summary');
  };

  const handleBack = () => {
    if (step === 'exercise') setStep('type');
    else if (step === 'target') setStep('exercise');
    else if (step === 'summary') setStep('target');
    else onClose();
  };

  const handleSave = () => {
    const targetKg = displayToKg(parseFloat(targetWeightDisplay), units);
    onSave({
      goalType,
      exerciseId: selectedExercise?.id,
      exerciseNameSnapshot: selectedExercise?.name,
      targetWeight: targetKg,
      baseline1rm: current1RM,
      targetSessionsPerWeek: sessionsPerWeek,
      targetDate: targetDate?.toISOString(),
      notes,
    });
  };

  const renderTypeStep = () => (
    <View className="gap-4">
      <Pressable
        onPress={() => {
          setGoalType('1rm');
          handleNext();
        }}
        className={`rounded-2xl border p-4 ${
          goalType === '1rm' ? 'border-accent-primary bg-accent-primary10' : 'border-border bg-card'
        }`}
      >
        <View className="flex-row items-center gap-4">
          <View className="rounded-xl bg-accent-primary20 p-3">
            <TrendingUp size={24} color={theme.colors.accent.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">
              {t('exerciseGoals.goalTypes.1rm')}
            </Text>
            <Text className="text-sm text-text-secondary">
              Set a strength target for a specific exercise.
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={() => {
          setGoalType('consistency');
          handleNext();
        }}
        className={`rounded-2xl border p-4 ${
          goalType === 'consistency'
            ? 'border-accent-primary bg-accent-primary10'
            : 'border-border bg-card'
        }`}
      >
        <View className="flex-row items-center gap-4">
          <View className="rounded-xl bg-accent-primary20 p-3">
            <Dumbbell size={24} color={theme.colors.accent.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">
              {t('exerciseGoals.goalTypes.consistency')}
            </Text>
            <Text className="text-sm text-text-secondary">
              Target a certain number of workouts per week.
            </Text>
          </View>
        </View>
      </Pressable>

      {['steps_per_day', 'distance_per_session', 'pace', 'duration'].map((type) => (
        <View key={type} className="rounded-2xl border border-border bg-card p-4 opacity-50">
          <View className="flex-row items-center gap-4">
            <View className="rounded-xl bg-surface-variant p-3">
              <TrendingUp size={24} color={theme.colors.text.tertiary} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-text-tertiary">
                {t(`exerciseGoals.goalTypes.${type}`)}
              </Text>
              <Text className="text-xs font-bold text-accent-primary">
                {t('exerciseGoals.creation.comingSoon')}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderExerciseStep = () => (
    <View className="gap-4">
      <Pressable
        onPress={() => setExercisePickerVisible(true)}
        className="rounded-2xl border border-border bg-card p-4"
      >
        <Text className="text-sm text-text-secondary">
          {t('exerciseGoals.creation.chooseExercise')}
        </Text>
        <Text className="mt-1 text-lg font-bold text-text-primary">
          {selectedExercise?.name || t('exerciseGoals.creation.searchPlaceholder')}
        </Text>
      </Pressable>

      {isLoadingHistory && (
        <ActivityIndicator size="small" color={theme.colors.accent.primary} />
      )}

      {selectedExercise && !isLoadingHistory && (
        <View className="rounded-2xl bg-surface-variant p-4">
          {current1RM !== null ? (
            <Text className="text-sm text-text-primary">
              {t('exerciseGoals.creation.currentEstimated1RM', {
                value: formatRoundedDecimal(kgToDisplay(current1RM, units), 1),
                unit: t(weightUnitKey),
              })}
            </Text>
          ) : (
            <Text className="text-sm text-text-secondary">
              {t('exerciseGoals.creation.noHistoryForExercise')}
            </Text>
          )}
        </View>
      )}

      <ExercisesModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelectExercise={(exercise) => {
          setSelectedExercise(exercise);
          setExercisePickerVisible(false);
          handleNext();
        }}
      />
    </View>
  );

  const renderTargetStep = () => (
    <View className="gap-6">
      {goalType === '1rm' ? (
        <View>
          <StepperInlineInput
            label={t('exerciseGoals.creation.targetWeight', { unit: t(weightUnitKey) })}
            value={parseFloat(targetWeightDisplay)}
            onChangeValue={(v) => setTargetWeightDisplay(v.toString())}
            onIncrement={() => setTargetWeightDisplay((parseFloat(targetWeightDisplay) + 2.5).toString())}
            onDecrement={() => setTargetWeightDisplay((parseFloat(targetWeightDisplay) - 2.5).toString())}
            unit={t(weightUnitKey)}
            step={2.5}
          />

          {projection?.projectedWeeks && (
            <View className="mt-4 rounded-xl bg-accent-primary10 p-4">
              <Text className="text-sm font-bold text-accent-primary">
                {t('exerciseGoals.creation.projectionPreview', {
                  weeks: Math.ceil(projection.projectedWeeks),
                  date: projection.projectedDate?.toLocaleDateString(locale, {
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row items-start gap-3 rounded-xl bg-surface-variant p-4">
            <Lightbulb size={20} color={theme.colors.accent.primary} />
            <Text className="flex-1 text-sm text-text-secondary">
              {isRealistic
                ? t('exerciseGoals.creation.realisticNudge')
                : t('exerciseGoals.creation.ambitiousNudge')}
            </Text>
          </View>
        </View>
      ) : (
        <StepperInlineInput
          label={t('exerciseGoals.creation.sessionsPerWeek')}
          value={sessionsPerWeek}
          onChangeValue={setSessionsPerWeek}
          onIncrement={() => setSessionsPerWeek((v) => Math.min(7, v + 1))}
          onDecrement={() => setSessionsPerWeek((v) => Math.max(1, v - 1))}
          step={1}
          min={1}
          max={7}
        />
      )}

      <DatePickerInput
        label={t('exerciseGoals.creation.targetDate')}
        selectedDate={targetDate || addMonths(new Date(), 3)}
        onPress={() => setDatePickerVisible(true)}
        unset={!targetDate}
      />

      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        selectedDate={targetDate || addMonths(new Date(), 3)}
        onDateSelect={(date) => {
          setTargetDate(date);
          setDatePickerVisible(false);
        }}
      />
    </View>
  );

  const renderSummaryStep = () => (
    <View className="gap-4">
      <View className="rounded-2xl bg-card p-4 border border-border">
        <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-text-tertiary">
          {t('exerciseGoals.creation.summaryTitle')}
        </Text>
        <View className="gap-3">
          <View className="flex-row justify-between">
            <Text className="text-text-secondary">Type</Text>
            <Text className="font-bold text-text-primary">
              {t(`exerciseGoals.goalTypes.${goalType}`)}
            </Text>
          </View>
          {selectedExercise && (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Exercise</Text>
              <Text className="font-bold text-text-primary">{selectedExercise.name}</Text>
            </View>
          )}
          {goalType === '1rm' && (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Target</Text>
              <Text className="font-bold text-text-primary">
                {targetWeightDisplay} {t(weightUnitKey)}
              </Text>
            </View>
          )}
          {goalType === 'consistency' && (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Frequency</Text>
              <Text className="font-bold text-text-primary">{sessionsPerWeek}x / week</Text>
            </View>
          )}
          <View className="flex-row justify-between">
            <Text className="text-text-secondary">Target Date</Text>
            <Text className="font-bold text-text-primary">
              {targetDate
                ? targetDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Not set'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const footer = (
    <View className="flex-row gap-3">
      <Button
        label={step === 'type' ? t('common.cancel') : t('common.back')}
        variant="outline"
        className="flex-1"
        onPress={handleBack}
      />
      <Button
        label={step === 'summary' ? t('exerciseGoals.creation.save') : t('common.next')}
        variant="gradientCta"
        className="flex-2"
        disabled={step === 'exercise' && !selectedExercise}
        onPress={step === 'summary' ? handleSave : handleNext}
      />
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exerciseGoals.creation.title')}
      footer={footer}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {renderStepContent()}
      </ScrollView>
    </FullScreenModal>
  );

  function renderStepContent() {
    switch (step) {
      case 'type': return renderTypeStep();
      case 'exercise': return renderExerciseStep();
      case 'target': return renderTargetStep();
      case 'summary': return renderSummaryStep();
      default: return null;
    }
  }
}
