import { addMonths } from 'date-fns';
import { Dumbbell, Lightbulb, Search, TrendingUp, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { SelectedExerciseCard } from '@/components/cards/SelectedExerciseCard';
import { FilterTabs } from '@/components/FilterTabs';
import { OptionsSelector, SelectorOption } from '@/components/OptionsSelector';
import { Button } from '@/components/theme/Button';
import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import { TextInput } from '@/components/theme/TextInput';
import { type ExerciseGoalType } from '@/database/models/ExerciseGoal';
import { UserMetricService, WorkoutAnalytics } from '@/database/services';
import { UserService } from '@/database/services/UserService';
import { type ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { useExercises } from '@/hooks/useExercises';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { projectGoal, type ProjectionResult } from '@/utils/exerciseGoalProjection';
import {
  getExerciseTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { GoalOptionItem } from './GoalOptionItem';

type MuscleGroupFilter = 'all' | 'chest' | 'back' | 'legs' | 'arms';

type ExerciseData = {
  id: string;
  name: string;
  muscleGroup: string;
  imageUrl?: string;
  loadMultiplier?: number;
};

type CreationStep = 'type' | 'exercise' | 'target' | 'summary';

interface ExerciseGoalCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

function normalizeMuscleGroup(muscleGroup: string): MuscleGroupFilter | null {
  const normalized = muscleGroup.toLowerCase();
  if (normalized.includes('chest')) {
    return 'chest';
  }
  if (normalized.includes('back') || normalized.includes('lat')) {
    return 'back';
  }
  if (
    normalized.includes('leg') ||
    normalized.includes('quad') ||
    normalized.includes('hamstring') ||
    normalized.includes('calf') ||
    normalized.includes('glute')
  ) {
    return 'legs';
  }
  if (
    normalized.includes('arm') ||
    normalized.includes('bicep') ||
    normalized.includes('tricep') ||
    normalized.includes('shoulder') ||
    normalized.includes('deltoid')
  ) {
    return 'arms';
  }
  return null;
}

function getExerciseType(mechanicType: string, equipmentType: string): string {
  const mechanic = mechanicType?.toLowerCase() || '';
  const equipment = equipmentType?.toLowerCase() || '';
  if (equipment.includes('bodyweight') || equipment.includes('body weight')) {
    return 'bodyweight';
  }
  if (mechanic.includes('compound')) {
    return 'compound';
  }
  if (equipment.includes('machine')) {
    return 'machine';
  }
  return 'isolation';
}

function getExerciseIcon(type: string) {
  if (type === 'bodyweight') {
    return User;
  }
  return Dumbbell;
}

export default function ExerciseGoalCreationModal({
  visible,
  onClose,
  onSave,
}: ExerciseGoalCreationModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { locale, formatRoundedDecimal } = useFormatAppNumber();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const [step, setStep] = useState<CreationStep>('type');
  const [goalType, setGoalType] = useState<ExerciseGoalType>('1rm');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseData | null>(null);
  const [targetWeightDisplay, setTargetWeightDisplay] = useState(
    units === 'imperial' ? '225' : '100'
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  const [activeMuscle, setActiveMuscle] = useState<MuscleGroupFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const {
    exercises: allExercises,
    isLoading: exercisesLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useExercises({
    visible: step === 'exercise',
    enableReactivity: true,
    sortBy: 'name',
    sortOrder: 'asc',
    searchTerm: searchQuery.trim() || undefined,
    initialLimit: 20,
    batchSize: 20,
  });

  // Live projection preview
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [exerciseDataPoints, setExerciseDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [current1RM, setCurrent1RM] = useState<number | null>(null);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>('male');

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
      setActiveMuscle('all');
      setSearchQuery('');
      return;
    }
  }, [visible, units]);

  useEffect(() => {
    if (selectedExercise && goalType === '1rm') {
      setIsLoadingHistory(true);
      Promise.all([
        WorkoutAnalytics.getProgressiveOverloadData(selectedExercise.id),
        UserMetricService.getUserBodyWeightKgForVolume(),
        UserService.getCurrentUser(),
      ])
        .then(([data, bw, user]) => {
          setExerciseDataPoints(data);
          setBodyWeight(bw);
          setUserGender(user?.gender ?? 'male');
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

  const muscleTabs = useMemo(
    () => [
      { id: 'all', label: t('workouts.addExercise.muscleGroups.all') },
      { id: 'chest', label: t('workouts.addExercise.muscleGroups.chest') },
      { id: 'back', label: t('workouts.addExercise.muscleGroups.back') },
      { id: 'legs', label: t('workouts.addExercise.muscleGroups.legs') },
      { id: 'arms', label: t('workouts.addExercise.muscleGroups.arms') },
    ],
    [t]
  );

  const exerciseOptions = useMemo(() => {
    const grouped: Record<MuscleGroupFilter, SelectorOption<string>[]> = {
      all: [],
      chest: [],
      back: [],
      legs: [],
      arms: [],
    };
    allExercises.forEach((exercise) => {
      const group = normalizeMuscleGroup(exercise.muscleGroup ?? '');
      if (!group) {return;}

      const exerciseType = getExerciseType(
        exercise.mechanicType ?? '',
        exercise.equipmentType ?? ''
      );
      const Icon = getExerciseIcon(exerciseType);
      const muscleGroupI18nKey = getMuscleGroupTranslationKey(exercise.muscleGroup ?? '');
      const exerciseTypeI18nKey = getExerciseTypeTranslationKey(exerciseType);

      const option: SelectorOption<string> = {
        id: exercise.id,
        label: exercise.name ?? '',
        description: `${t(muscleGroupI18nKey)} • ${t(exerciseTypeI18nKey)}`,
        icon: Icon,
        iconBgColor:
          exerciseType === 'bodyweight'
            ? theme.colors.background.white5
            : theme.colors.accent.primary10,
        iconColor:
          exerciseType === 'bodyweight'
            ? theme.colors.text.secondary
            : theme.colors.accent.primary,
        imageUrl: exercise.imageUrl,
      };

      grouped[group].push(option);
      grouped.all.push(option);
    });
    return grouped;
  }, [allExercises, theme, t]);

  const filteredExercises = useMemo(
    () => exerciseOptions[activeMuscle],
    [exerciseOptions, activeMuscle]
  );

  const handleNext = useCallback(() => {
    if (step === 'type') {
      setStep('exercise');
    } else if (step === 'exercise') {
      setStep('target');
    } else if (step === 'target') {
      setStep('summary');
    }
  }, [step]);

  const handleSelectExercise = useCallback(
    (id: string) => {
      const exercise = allExercises.find((e) => e.id === id);
      if (exercise) {
        setSelectedExercise({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup ?? '',
          imageUrl: exercise.imageUrl,
          loadMultiplier: exercise.loadMultiplier ?? 1.0,
        });
        handleNext();
      }
    },
    [allExercises, handleNext]
  );

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
      userGender,
    });
  }, [
    selectedExercise,
    goalType,
    targetWeightDisplay,
    current1RM,
    exerciseDataPoints,
    bodyWeight,
    userGender,
    units,
  ]);

  const isRealistic = useMemo(() => {
    return projection?.isRealistic ?? true;
  }, [projection]);

  const handleBack = () => {
    if (step === 'exercise') {
      setStep('type');
    } else if (step === 'target') {
      setStep('exercise');
    } else if (step === 'summary') {
      setStep('target');
    } else {
      onClose();
    }
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
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.secondary,
          marginBottom: 8,
        }}
      >
        {t('exerciseGoals.creation.chooseType')}
      </Text>

      <GoalOptionItem
        icon={<TrendingUp size={theme.iconSize.md} color={theme.colors.accent.primary} />}
        title={t('exerciseGoals.goalTypes.1rm')}
        description={t('exerciseGoals.goalTypes.1rmDescription')}
        onPress={() => {
          setGoalType('1rm');
          handleNext();
        }}
        isSelected={goalType === '1rm'}
      />

      <GoalOptionItem
        icon={<Dumbbell size={theme.iconSize.md} color={theme.colors.text.secondary} />}
        title={t('exerciseGoals.goalTypes.consistency')}
        description={t('exerciseGoals.goalTypes.consistencyDescription')}
        onPress={() => {
          setGoalType('consistency');
          handleNext();
        }}
        isSelected={goalType === 'consistency'}
      />

      {['steps_per_day', 'distance_per_session', 'pace', 'duration'].map((type) => (
        <GoalOptionItem
          key={type}
          icon={<TrendingUp size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
          title={t(`exerciseGoals.goalTypes.${type}`)}
          description={t('exerciseGoals.creation.comingSoon')}
          onPress={() => {}}
          disabled
        />
      ))}
    </View>
  );

  const renderExerciseStep = () => {
    if (selectedExercise) {
      const rawExercise = allExercises.find((e) => e.id === selectedExercise.id);
      return (
        <View style={{ gap: 16 }}>
          <SelectedExerciseCard
            exerciseName={selectedExercise.name}
            exerciseCategory={selectedExercise.muscleGroup}
            exerciseType={
              rawExercise
                ? getExerciseType(rawExercise.mechanicType ?? '', rawExercise.equipmentType ?? '')
                : 'isolation'
            }
            onChange={() => setSelectedExercise(null)}
          />
          {isLoadingHistory ? (
            <ActivityIndicator size="small" color={theme.colors.accent.primary} />
          ) : null}
          {!isLoadingHistory ? (
            <View className="bg-surface-variant rounded-2xl p-4">
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
          ) : null}
        </View>
      );
    }

    return (
      <View style={{ gap: 16 }}>
        <View>
          <FilterTabs
            tabs={muscleTabs}
            activeTab={activeMuscle}
            onTabChange={(id) => setActiveMuscle(id as MuscleGroupFilter)}
            showContainer={false}
            withCheckmark={true}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>
        <View>
          <TextInput
            label=""
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('workouts.addExercise.searchPlaceholderAll')}
            icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        </View>
        <View>
          {exercisesLoading && filteredExercises.length === 0 ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : filteredExercises.length > 0 ? (
            <>
              <OptionsSelector
                title=""
                options={filteredExercises}
                selectedId={undefined}
                onSelect={handleSelectExercise as any}
              />
              {hasMore ? (
                <View className="py-4">
                  <Button
                    label={isLoadingMore ? t('common.loading') : t('common.loadMore')}
                    variant="outline"
                    size="md"
                    width="full"
                    onPress={loadMore}
                    disabled={isLoadingMore}
                    loading={isLoadingMore}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.text.secondary,
                  textAlign: 'center',
                }}
              >
                {searchQuery
                  ? t('workouts.addExercise.noExercisesFound', { query: searchQuery })
                  : t('workouts.addExercise.noExercisesAvailable', {
                      muscle:
                        muscleTabs.find((tab) => tab.id === activeMuscle)?.label ?? activeMuscle,
                    })}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTargetStep = () => (
    <View className="gap-6">
      {goalType === '1rm' ? (
        <View>
          <StepperInlineInput
            label={t('exerciseGoals.creation.targetWeight', { unit: t(weightUnitKey) })}
            value={parseFloat(targetWeightDisplay)}
            onChangeValue={(v) => setTargetWeightDisplay(v.toString())}
            onIncrement={() =>
              setTargetWeightDisplay((parseFloat(targetWeightDisplay) + 2.5).toString())
            }
            onDecrement={() =>
              setTargetWeightDisplay((parseFloat(targetWeightDisplay) - 2.5).toString())
            }
            unit={t(weightUnitKey)}
            step={2.5}
          />

          {projection?.projectedWeeks ? (
            <View className="bg-accent-primary10 mt-4 rounded-xl p-4">
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
          ) : null}

          <View className="bg-surface-variant mt-4 flex-row items-start gap-3 rounded-xl p-4">
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
          maxFractionDigits={0}
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
      <View className="bg-card border-border rounded-2xl border p-4">
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
          {selectedExercise ? (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Exercise</Text>
              <Text className="font-bold text-text-primary">{selectedExercise.name}</Text>
            </View>
          ) : null}
          {goalType === '1rm' ? (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Target</Text>
              <Text className="font-bold text-text-primary">
                {targetWeightDisplay} {t(weightUnitKey)}
              </Text>
            </View>
          ) : null}
          {goalType === 'consistency' ? (
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Frequency</Text>
              <Text className="font-bold text-text-primary">{sessionsPerWeek}x / week</Text>
            </View>
          ) : null}
          <View className="flex-row justify-between">
            <Text className="text-text-secondary">Target Date</Text>
            <Text className="font-bold text-text-primary">
              {targetDate
                ? targetDate.toLocaleDateString(locale, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Not set'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const footer =
    step === 'type' ? null : (
      <View className="flex-row gap-3">
        <Button
          label={t('common.back')}
          variant="outline"
          width="flex-1"
          onPress={handleBack}
        />
        <Button
          label={step === 'summary' ? t('exerciseGoals.creation.save') : t('common.next')}
          variant="gradientCta"
          width="flex-2"
          disabled={step === 'exercise' ? !selectedExercise : false}
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
      <View style={{ padding: 20 }}>{renderStepContent()}</View>
    </FullScreenModal>
  );

  function renderStepContent() {
    switch (step) {
      case 'type':
        return renderTypeStep();
      case 'exercise':
        return renderExerciseStep();
      case 'target':
        return renderTargetStep();
      case 'summary':
        return renderSummaryStep();
      default:
        return null;
    }
  }
}
