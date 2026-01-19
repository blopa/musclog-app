import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, Switch, ActivityIndicator } from 'react-native';
import { Search, Dumbbell, User, PlusCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { OptionsSelector, SelectorOption } from '../OptionsSelector';
import { FilterTabs } from '../FilterTabs';
import { NumericInput } from '../theme/NumericInput';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import Exercise from '../../database/models/Exercise';

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
  const { t } = useTranslation();
  const [activeMuscle, setActiveMuscle] = useState<MuscleGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId | null>(null);
  const selectedExerciseIdRef = useRef<ExerciseId | null>(null);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('60');
  const [exercises, setExercises] = useState<Record<MuscleGroup, ExerciseOption[]>>({
    all: [],
    chest: [],
    back: [],
    legs: [],
    arms: [],
  });
  const [isLoading, setIsLoading] = useState(false);

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

  // Load exercises from database
  const loadExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all non-deleted exercises
      const allExercises = await database
        .get<Exercise>('exercises')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch();

      // Group exercises by muscle group
      const groupedExercises: Record<MuscleGroup, ExerciseOption[]> = {
        all: [],
        chest: [],
        back: [],
        legs: [],
        arms: [],
      };

      allExercises.forEach((exercise) => {
        const muscleGroup = normalizeMuscleGroup(exercise.muscleGroup);
        if (!muscleGroup) {
          return; // Skip exercises that don't match our categories
        }

        const exerciseType = getExerciseType(exercise.mechanicType, exercise.equipmentType);
        const Icon = getExerciseIcon(exerciseType);

        const exerciseOption: ExerciseOption = {
          id: exercise.id,
          label: exercise.name,
          description: `${exercise.muscleGroup} • ${exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1)}`,
          icon: Icon,
          iconBgColor:
            exerciseType === 'bodyweight'
              ? theme.colors.background.white5
              : theme.colors.accent.primary10,
          iconColor:
            exerciseType === 'bodyweight'
              ? theme.colors.text.secondary
              : theme.colors.accent.primary,
          category: exercise.muscleGroup,
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

      setExercises(groupedExercises);

      // Auto-select first exercise if available (only if nothing is selected or selection is invalid)
      const currentGroupExercises = groupedExercises[activeMuscle];
      if (currentGroupExercises.length > 0) {
        // Check if current selection exists in the loaded exercises (use ref to avoid stale closure)
        const allExerciseIds = new Set(groupedExercises.all.map((ex) => ex.id));
        const currentSelection = selectedExerciseIdRef.current;
        if (!currentSelection || !allExerciseIds.has(currentSelection)) {
          setSelectedExerciseId(currentGroupExercises[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading exercises:', error);
      setExercises({ all: [], chest: [], back: [], legs: [], arms: [] });
    } finally {
      setIsLoading(false);
    }
  }, [activeMuscle]);

  // Load exercises when modal opens or active muscle changes
  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible, loadExercises]);

  // Update selected exercise when active muscle changes (only muscle group change, not selection)
  useEffect(() => {
    const currentGroupExercises = exercises[activeMuscle];
    if (currentGroupExercises.length > 0) {
      // Keep selection if it exists in the new group, otherwise select first
      const exerciseExists = currentGroupExercises.some((ex) => ex.id === selectedExerciseId);
      if (!exerciseExists) {
        setSelectedExerciseId(currentGroupExercises[0].id);
      }
    } else {
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
    });
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.addExercise.title')}
      scrollable={true}>
      <View className="flex-1 px-4 py-6">
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
              }}>
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

        {/* Search Bar */}
        <View
          className="mb-6 flex-row items-center rounded-xl border bg-bg-card px-4 py-3"
          style={{
            height: theme.components.button.height.md,
            borderColor: theme.colors.background.white5,
          }}>
          <Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
          <TextInput
            className="ml-3 flex-1 text-base text-text-primary"
            placeholder={placeholderText}
            placeholderTextColor={theme.colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
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
              onSelect={handleSelectExercise}
            />
          ) : (
            <View className="items-center justify-center py-12">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  color: theme.colors.text.secondary,
                  textAlign: 'center',
                }}>
                {emptyStateMessage}
              </Text>
            </View>
          )}
        </View>

        {/* Create Set Card */}
        <View
          className="rounded-2xl border bg-bg-card p-5"
          style={{ borderColor: theme.colors.background.white5 }}>
          <View className="mb-6 flex-row items-center justify-between">
            <Text
              style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
              }}>
              {t('workouts.addExercise.createSet')}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.secondary,
                }}>
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
            <View className="flex-row gap-4">
              <NumericInput
                label={t('workouts.addExercise.sets')}
                value={sets}
                onChangeText={setSets}
                unit=""
                onIncrement={() => setSets((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setSets((prev) => Math.max(1, parseInt(prev) - 1).toString())}
              />
              <NumericInput
                label={t('workouts.addExercise.reps')}
                value={reps}
                onChangeText={setReps}
                unit=""
                onIncrement={() => setReps((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setReps((prev) => Math.max(1, parseInt(prev) - 1).toString())}
              />
            </View>

            {/* Weight */}
            <View className="flex-row">
              <NumericInput
                label={t('workouts.addExercise.weight')}
                value={weight}
                onChangeText={setWeight}
                unit={t('workoutSession.kg')}
                onIncrement={() => setWeight((prev) => (parseFloat(prev) + 2.5).toString())}
                onDecrement={() => setWeight((prev) => (parseFloat(prev) - 2.5).toString())}
              />
            </View>
          </View>
        </View>
        <View style={{ height: theme.spacing.padding.xl }} />

        <Button
          label={t('workouts.addExercise.addToWorkout')}
          variant="gradientCta"
          size="md"
          width="full"
          icon={PlusCircle}
          onPress={handleAdd}
          disabled={!selectedExerciseId || isLoading}
        />
      </View>
    </FullScreenModal>
  );
}
