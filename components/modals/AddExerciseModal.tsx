import { Dumbbell, PlusCircle, Search, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { useExercises } from '../../hooks/useExercises';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { getWeightUnitI18nKey } from '../../utils/units';
import { SelectedExerciseCard } from '../cards/SelectedExerciseCard';
import { FilterTabs } from '../FilterTabs';
import { OptionsSelector, SelectorOption } from '../OptionsSelector';
import { Button } from '../theme/Button';
import { StepperInlineInput } from '../theme/StepperInlineInput';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';

type MuscleGroup = 'all' | 'chest' | 'back' | 'legs' | 'arms';

type ExerciseId = string;

type ExerciseOption = SelectorOption<ExerciseId> & {
  category: string;
  type: 'compound' | 'isolation' | 'bodyweight' | 'machine';
};

type AddExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddExercise?: (data: any) => void;
};

// Helper function to normalize muscle group names from database to UI categories
const normalizeMuscleGroup = (muscleGroup: string): MuscleGroup | null => {
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
};

// Helper function to determine exercise type from mechanic/equipment
const getExerciseType = (
  mechanicType: string,
  equipmentType: string
): 'compound' | 'isolation' | 'bodyweight' | 'machine' => {
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
};

// Helper function to get icon for exercise type
const getExerciseIcon = (type: string) => {
  if (type === 'bodyweight') {
    return User;
  }
  return Dumbbell;
};

export function AddExerciseModal({ visible, onClose, onAddExercise }: AddExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const [activeMuscle, setActiveMuscle] = useState<MuscleGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId | null>(null);
  const selectedExerciseIdRef = useRef<ExerciseId | null>(null);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('60');
  const [restTime, setRestTime] = useState('60'); // Rest time in seconds

  // Use the useExercises hook
  const { exercises: allExercises, isLoading } = useExercises({
    visible,
    enableReactivity: true,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // Group exercises by muscle group
  const exercises = useMemo(() => {
    const groupedExercises: Record<MuscleGroup, ExerciseOption[]> = {
      all: [],
      chest: [],
      back: [],
      legs: [],
      arms: [],
    };

    allExercises.forEach((exercise) => {
      const muscleGroup = normalizeMuscleGroup(exercise.muscleGroup ?? '');
      if (!muscleGroup) {
        return; // Skip exercises that don't match our categories
      }

      const exerciseType = getExerciseType(
        exercise.mechanicType ?? '',
        exercise.equipmentType ?? ''
      );
      const Icon = getExerciseIcon(exerciseType);

      const exerciseOption: ExerciseOption = {
        id: exercise.id,
        label: exercise.name ?? '',
        description: `${exercise.muscleGroup ?? ''} • ${exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1)}`,
        icon: Icon,
        iconBgColor:
          exerciseType === 'bodyweight'
            ? theme.colors.background.white5
            : theme.colors.accent.primary10,
        iconColor:
          exerciseType === 'bodyweight' ? theme.colors.text.secondary : theme.colors.accent.primary,
        category: exercise.muscleGroup ?? '',
        type: exerciseType,
      };

      // Add to specific muscle group
      groupedExercises[muscleGroup].push(exerciseOption);
      // Also add to 'all' group
      groupedExercises.all.push(exerciseOption);
    });

    // Sort exercises within each group by name
    Object.keys(groupedExercises).forEach((key) => {
      const group = key as MuscleGroup;
      groupedExercises[group].sort((a, b) => a.label.localeCompare(b.label));
    });

    return groupedExercises;
  }, [
    allExercises,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    theme.colors.background.white5,
    theme.colors.text.secondary,
  ]);

  // Memoize muscleTabs to avoid recreating array and translation calls on every render
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

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedExerciseId(null);
      selectedExerciseIdRef.current = null;
    }
  }, [visible]);

  // Update selected exercise when active muscle changes - clear selection if it doesn't exist in new group
  useEffect(() => {
    const currentGroupExercises = exercises[activeMuscle];
    if (currentGroupExercises.length > 0 && selectedExerciseId) {
      // Clear selection if it doesn't exist in the new group
      const exerciseExists = currentGroupExercises.some((ex) => ex.id === selectedExerciseId);
      if (!exerciseExists) {
        setSelectedExerciseId(null);
      }
    } else if (currentGroupExercises.length === 0) {
      setSelectedExerciseId(null);
    }
    // Only run when activeMuscle or exercises change, not when selectedExerciseId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMuscle, exercises]);

  // Memoize filteredExercises to avoid recomputing on every render
  const filteredExercises = useMemo(
    () =>
      exercises[activeMuscle].filter((ex) =>
        ex.label.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [exercises, activeMuscle, searchQuery]
  );

  // Memoize placeholder text to avoid translation calls and find() on every render
  const placeholderText = useMemo(
    () =>
      activeMuscle === 'all'
        ? t('workouts.addExercise.searchPlaceholderAll')
        : t('workouts.addExercise.searchPlaceholder', {
            muscle: muscleTabs.find((tab) => tab.id === activeMuscle)?.label || activeMuscle,
          }),
    [activeMuscle, muscleTabs, t]
  );

  // Memoize empty state message to avoid translation calls and find() on every render
  const emptyStateMessage = useMemo(
    () =>
      searchQuery
        ? t('workouts.addExercise.noExercisesFound', { query: searchQuery })
        : t('workouts.addExercise.noExercisesAvailable', {
            muscle: muscleTabs.find((tab) => tab.id === activeMuscle)?.label || activeMuscle,
          }),
    [searchQuery, activeMuscle, muscleTabs, t]
  );

  // Update ref whenever selectedExerciseId changes
  useEffect(() => {
    selectedExerciseIdRef.current = selectedExerciseId;
  }, [selectedExerciseId]);

  // Stabilize onSelect callback to prevent OptionsSelector from re-rendering
  const handleSelectExercise = useCallback((id: ExerciseId) => {
    setSelectedExerciseId(id);
  }, []);

  // Handle change button - clears selection to show the exercise list again
  const handleChangeExercise = useCallback(() => {
    setSelectedExerciseId(null);
  }, []);

  // Get the selected exercise data for display
  const selectedExercise = useMemo(() => {
    if (!selectedExerciseId) return null;
    const allExercises = Object.values(exercises).flat();
    return allExercises.find((ex) => ex.id === selectedExerciseId) || null;
  }, [selectedExerciseId, exercises]);

  const handleAdd = () => {
    if (!selectedExerciseId) {
      return; // Don't add if no exercise selected
    }
    onAddExercise?.({
      exerciseId: selectedExerciseId,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      isBodyweight,
      restTimeAfter: parseInt(restTime) || 60, // Default to 60 if invalid
    });
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.addExercise.title')}
      scrollable={true}
      footer={
        <Button
          label={t('workouts.addExercise.addToWorkout')}
          variant="gradientCta"
          size="md"
          width="full"
          icon={PlusCircle}
          onPress={handleAdd}
          disabled={!selectedExerciseId || isLoading}
        />
      }
    >
      <View className="flex-1 px-4 py-6">
        {selectedExercise ? (
          <View className="mb-6">
            <SelectedExerciseCard
              exerciseName={selectedExercise.label}
              exerciseCategory={selectedExercise.category}
              exerciseType={
                selectedExercise.type.charAt(0).toUpperCase() + selectedExercise.type.slice(1)
              }
              onChange={handleChangeExercise}
            />
          </View>
        ) : (
          <>
            {/* Target Muscle Section */}
            <View className="mb-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: theme.typography.letterSpacing.extraWide,
                  }}
                >
                  {t('workouts.addExercise.targetMuscle')}
                </Text>
              </View>
              <FilterTabs
                tabs={muscleTabs}
                activeTab={activeMuscle}
                onTabChange={(id) => setActiveMuscle(id as MuscleGroup)}
                showContainer={false}
                withCheckmark={true}
                scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
              />
            </View>

            {/* Search Input (themed) */}
            <View className="mb-6">
              <TextInput
                label=""
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={placeholderText}
                icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
              />
            </View>

            {/* Exercise List */}
            <View className="mb-8">
              {isLoading ? (
                <View className="items-center justify-center py-12">
                  <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                </View>
              ) : filteredExercises.length > 0 ? (
                <OptionsSelector
                  title=""
                  options={filteredExercises}
                  selectedId={selectedExerciseId || undefined}
                  onSelect={handleSelectExercise as any}
                />
              ) : (
                <View className="items-center justify-center py-12">
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      color: theme.colors.text.secondary,
                      textAlign: 'center',
                    }}
                  >
                    {emptyStateMessage}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Create Set Card */}
        <View
          className="rounded-2xl border bg-bg-card p-5"
          style={{ borderColor: theme.colors.background.white5 }}
        >
          <View className="mb-6 flex-row items-center justify-between">
            <Text
              style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
              }}
            >
              {t('workouts.addExercise.createSet')}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.secondary,
                }}
              >
                {t('workouts.addExercise.bodyweight')}
              </Text>
              <Switch
                value={isBodyweight}
                onValueChange={setIsBodyweight}
                trackColor={{
                  false: theme.colors.background.overlay,
                  true: theme.colors.accent.primary,
                }}
                thumbColor={theme.colors.text.white}
              />
            </View>
          </View>

          <View className="gap-6">
            {/* Sets & Reps */}
            <View className="mb-4">
              <StepperInlineInput
                label={t('workouts.addExercise.sets')}
                value={parseInt(sets) || 0}
                unit=""
                onIncrement={() => setSets((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setSets((prev) => Math.max(1, parseInt(prev) - 1).toString())}
                onChangeValue={(num) => setSets(Math.max(1, Math.round(num)).toString())}
              />
            </View>
            <View className="mb-4">
              <StepperInlineInput
                label={t('workouts.addExercise.reps')}
                value={parseInt(reps) || 0}
                unit=""
                onIncrement={() => setReps((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setReps((prev) => Math.max(1, parseInt(prev) - 1).toString())}
                onChangeValue={(num) => setReps(Math.max(1, Math.round(num)).toString())}
              />
            </View>

            {/* Weight & Rest Time */}
            <View className="mb-4">
              <StepperInlineInput
                label={t('workouts.addExercise.weight')}
                value={parseFloat(weight) || 0}
                unit={t(weightUnitKey)}
                onIncrement={() => setWeight((prev) => (parseFloat(prev) + 2.5).toString())}
                onDecrement={() => setWeight((prev) => (parseFloat(prev) - 2.5).toString())}
                onChangeValue={(num) => setWeight((Math.round(num * 10) / 10).toString())}
              />
            </View>
            <View
              style={{
                height: theme.spacing.gap['1'],
                backgroundColor: theme.colors.background.white5,
                marginVertical: theme.spacing.gap.sm,
              }}
            />
            <View className="mb-4">
              <StepperInlineInput
                label={t('workouts.addExercise.restTime')}
                value={parseInt(restTime) || 0}
                unit={t('workouts.addExercise.seconds')}
                onIncrement={() => setRestTime((prev) => (parseInt(prev) + 5).toString())}
                onDecrement={() =>
                  setRestTime((prev) => Math.max(0, parseInt(prev) - 5).toString())
                }
                onChangeValue={(num) => setRestTime(Math.max(0, Math.round(num)).toString())}
              />
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
