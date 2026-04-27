import { addMonths } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Lightbulb, Minus, Plus, Search, TrendingUp, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

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
import {
  estimateConservativeTargetDate,
  projectGoal,
  type ProjectionResult,
} from '@/utils/exerciseGoalProjection';
import { FALLBACK_EXERCISE_IMAGE } from '@/utils/exerciseImage';
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
  const [hasManuallySetTargetDate, setHasManuallySetTargetDate] = useState(false);
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
      setHasManuallySetTargetDate(false);
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
      setTargetDate(null);
      setHasManuallySetTargetDate(false);
      Promise.all([
        WorkoutAnalytics.getProgressiveOverloadData(selectedExercise.id),
        WorkoutAnalytics.getRecentFirstSetAverage1RM(selectedExercise.id),
        UserMetricService.getUserBodyWeightKgForVolume(),
        UserService.getCurrentUser(),
      ])
        .then(([data, recentAverage, bw, user]) => {
          setExerciseDataPoints(data);
          setBodyWeight(bw);
          setUserGender(user?.gender ?? 'male');

          const recent1RM = recentAverage?.average1RM;
          let nextTargetDisplay: string | undefined;

          if (recent1RM != null) {
            nextTargetDisplay = (
              Math.round(kgToDisplay(recent1RM * 1.1, units) * 2) / 2
            ).toString();
            setCurrent1RM(recent1RM);
            setTargetWeightDisplay(nextTargetDisplay);
          } else if (data.length > 0) {
            const latest1RM = data[data.length - 1].estimated1RM;

            nextTargetDisplay = (
              Math.round(kgToDisplay(latest1RM * 1.1, units) * 2) / 2
            ).toString();
            setCurrent1RM(latest1RM);
            setTargetWeightDisplay(nextTargetDisplay);
          } else {
            setCurrent1RM(null);
            // No history: suggest bodyWeight × loadMultiplier as a default target.
            // This equals the novice→intermediate threshold used in the goal projection.
            const defaultTargetKg =
              Math.round((bw * (selectedExercise.loadMultiplier ?? 1.0)) / 2.5) * 2.5;
            setTargetWeightDisplay(
              (Math.round(kgToDisplay(defaultTargetKg, units) * 2) / 2).toString()
            );
          }
        })
        .finally(() => setIsLoadingHistory(false));
    }
  }, [selectedExercise, goalType, units]);

  // Recalculate target date whenever the target weight changes,
  // as long as the user hasn't manually overridden it.
  useEffect(() => {
    if (
      goalType !== '1rm' ||
      !selectedExercise ||
      current1RM === null ||
      hasManuallySetTargetDate
    ) {
      return;
    }

    const targetKg = displayToKg(parseFloat(targetWeightDisplay), units);
    if (Number.isNaN(targetKg) || targetKg <= 0) {
      return;
    }

    const proj = projectGoal({
      dataPoints: exerciseDataPoints,
      baseline1rm: current1RM,
      targetWeight: targetKg,
      bodyWeight,
      loadMultiplier: selectedExercise.loadMultiplier ?? 1.0,
      userGender,
    });

    if (proj.projectedDate) {
      setTargetDate(proj.projectedDate);
    } else {
      setTargetDate(
        estimateConservativeTargetDate(
          current1RM,
          targetKg,
          bodyWeight,
          selectedExercise.loadMultiplier ?? 1.0,
          userGender
        )
      );
    }
  }, [
    targetWeightDisplay,
    selectedExercise,
    goalType,
    current1RM,
    exerciseDataPoints,
    bodyWeight,
    userGender,
    units,
    hasManuallySetTargetDate,
  ]);

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
      if (!group) {
        return;
      }

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
          exerciseType === 'bodyweight' ? theme.colors.text.secondary : theme.colors.accent.primary,
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
      if (!targetDate) {
        setTargetDate(addMonths(new Date(), 3));
      }

      setStep('summary');
    }
  }, [step, targetDate]);

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
                <Text className="text-text-primary text-sm">
                  {t('exerciseGoals.creation.currentEstimated1RM', {
                    value: formatRoundedDecimal(kgToDisplay(current1RM, units), 1),
                    unit: t(weightUnitKey),
                  })}
                </Text>
              ) : (
                <Text className="text-text-secondary text-sm">
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
              <Text className="text-accent-primary text-sm font-bold">
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
            <Text className="text-text-secondary flex-1 text-sm">
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
    </View>
  );

  const renderSummaryStep = () => (
    <View style={{ gap: 16 }}>
      {/* Hero */}
      <View
        style={{
          borderRadius: 24,
          overflow: 'hidden',
          height: 200,
          backgroundColor: theme.colors.background.card,
        }}
      >
        <Image
          source={
            selectedExercise?.imageUrl?.trim()
              ? { uri: selectedExercise.imageUrl }
              : FALLBACK_EXERCISE_IMAGE
          }
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 20,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.accent.primary20,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.colors.accent.primary,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t('exerciseGoals.creation.reviewSummary')}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
              marginTop: 8,
            }}
          >
            {t('exerciseGoals.creation.confirmTitle')}
          </Text>
        </View>
      </View>

      {/* Exercise Card */}
      <View
        style={{
          borderRadius: 20,
          backgroundColor: theme.colors.background.card,
          padding: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t('exerciseGoals.creation.exerciseLabel')}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xl,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
                marginTop: 4,
              }}
              numberOfLines={1}
            >
              {selectedExercise?.name || '-'}
            </Text>
          </View>
          <View
            style={{
              height: 48,
              width: 48,
              borderRadius: 12,
              backgroundColor: theme.colors.background.secondaryDark,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Dumbbell size={24} color={theme.colors.accent.primary} />
          </View>
        </View>
      </View>

      {/* Type + Target Row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 20,
            backgroundColor: theme.colors.background.card,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {t('exerciseGoals.creation.typeLabel')}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
              marginTop: 4,
            }}
          >
            {t(`exerciseGoals.goalTypes.${goalType}`)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            borderRadius: 20,
            backgroundColor: theme.colors.background.card,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {t('exerciseGoals.creation.targetLabel')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
              gap: 8,
            }}
          >
            <Pressable
              onPress={() => {
                if (goalType === '1rm') {
                  setTargetWeightDisplay((parseFloat(targetWeightDisplay) - 2.5).toString());
                } else {
                  setSessionsPerWeek((v) => Math.max(1, v - 1));
                }
              }}
              style={{
                height: 32,
                width: 32,
                borderRadius: 999,
                backgroundColor: theme.colors.accent.primary10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Minus size={16} color={theme.colors.accent.primary} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.primary,
                }}
              >
                {goalType === '1rm' ? targetWeightDisplay : sessionsPerWeek}
              </Text>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.accent.primary,
                }}
              >
                {goalType === '1rm' ? t(weightUnitKey) : t('exerciseGoals.creation.perWeek')}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (goalType === '1rm') {
                  setTargetWeightDisplay((parseFloat(targetWeightDisplay) + 2.5).toString());
                } else {
                  setSessionsPerWeek((v) => Math.min(7, v + 1));
                }
              }}
              style={{
                height: 32,
                width: 32,
                borderRadius: 999,
                backgroundColor: theme.colors.accent.primary10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={16} color={theme.colors.accent.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Target Date */}
      <DatePickerInput
        label={t('exerciseGoals.creation.targetDateShort')}
        selectedDate={targetDate || addMonths(new Date(), 3)}
        onPress={() => setDatePickerVisible(true)}
        unset={!targetDate}
        unsetPlaceholder={t('exerciseGoals.creation.notSet')}
        variant="default"
        showLeadingIcon={true}
        dateDisplay="stacked"
      />

      {/* Projection info (optional extra) */}
      {projection?.projectedWeeks ? (
        <View
          style={{
            borderRadius: 20,
            backgroundColor: theme.colors.accent.primary10,
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.accent.primary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
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
    </View>
  );

  const footer = (() => {
    if (step === 'type') {
      return null;
    }
    if (step === 'summary') {
      return (
        <View style={{ width: '100%', gap: 12 }}>
          <Button
            label={t('exerciseGoals.creation.save')}
            variant="gradientCta"
            size="md"
            width="full"
            onPress={handleSave}
          />
          <Button
            label={t('common.back')}
            variant="outline"
            size="md"
            width="full"
            onPress={handleBack}
          />
        </View>
      );
    }
    return (
      <View className="flex-row gap-3">
        <Button label={t('common.back')} variant="outline" width="flex-1" onPress={handleBack} />
        <Button
          label={t('common.next')}
          variant="gradientCta"
          width="flex-2"
          disabled={step === 'exercise' ? !selectedExercise : false}
          onPress={handleNext}
        />
      </View>
    );
  })();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exerciseGoals.creation.title')}
      footer={footer}
    >
      <View style={{ padding: 20 }}>{renderStepContent()}</View>
      <DatePickerModal
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        selectedDate={targetDate || addMonths(new Date(), 3)}
        onDateSelect={(date) => {
          setTargetDate(date);
          setHasManuallySetTargetDate(true);
          setDatePickerVisible(false);
        }}
      />
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
