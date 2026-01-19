import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, PlusSquare, Dumbbell, User } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Button } from '../../components/theme/Button';
import { SegmentedControl } from '../../components/theme/SegmentedControl';
import { OptionsMultiSelector } from '../../components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { WeekdayPicker } from '../../components/theme/WeekdayPicker';
import { SelectorOption } from '../../components/theme/OptionsMultiSelector/utils';
import { AddExerciseModal } from '../../components/modals/AddExerciseModal';
import {
  WorkoutTemplateService,
  ExerciseInWorkout,
} from '../../database/services/WorkoutTemplateService';
import { database } from '../../database';
import Exercise from '../../database/models/Exercise';

// Day labels for WeekdayPicker (Monday through Sunday)
const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Day names mapping for database: WeekdayPicker index -> Day name
// WeekdayPicker uses: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Convert day name from database to WeekdayPicker index
const dayNameToIndex = (dayName: string): number => {
  return dayNames.indexOf(dayName);
};

export default function CreateWorkoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ templateId?: string }>();
  const templateId = params.templateId;
  const isEditMode = !!templateId;

  const [workoutTitle, setWorkoutTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeCalc, setVolumeCalc] = useState('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [exercises, setExercises] = useState<SelectorOption<string>[]>([]);

  // Load template if in edit mode
  const loadTemplate = useCallback(async () => {
    if (!isEditMode || !templateId) return;

    setIsLoading(true);
    try {
      const { template, sets, schedule } = await WorkoutTemplateService.getTemplateWithDetails(
        templateId
      );

      // Set basic template info
      setWorkoutTitle(template.name);
      setDescription(template.description || '');

      // Convert schedule days to indices
      const dayIndices = schedule
        .map((s) => dayNameToIndex(s.dayOfWeek))
        .filter((idx) => idx !== -1);
      setSelectedDays(dayIndices);

      // Convert template sets to exercises
      const exercisesInWorkout = await WorkoutTemplateService.convertSetsToExercises(sets);

      // Convert to SelectorOption format and populate metadata
      const exerciseOptions: SelectorOption<string>[] = exercisesInWorkout.map((ex) => ({
        id: ex.id,
        label: ex.label,
        description: ex.description,
        icon: ex.icon,
        iconBgColor: ex.iconBgColor,
        iconColor: ex.iconColor,
        groupId: ex.groupId,
      }));

      setExercises(exerciseOptions);

      // Populate metadata map
      const metadataMap = new Map<
        string,
        Omit<
          ExerciseInWorkout,
          'id' | 'label' | 'description' | 'icon' | 'iconBgColor' | 'iconColor'
        >
      >();
      exercisesInWorkout.forEach((ex) => {
        metadataMap.set(ex.id, {
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          isBodyweight: ex.isBodyweight,
          groupId: ex.groupId,
        });
      });
      setExerciseMetadata(metadataMap);
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('createWorkout.loadError', 'Failed to load workout template')
      );
    } finally {
      setIsLoading(false);
    }
  }, [dayNameToIndex, isEditMode, templateId, t]);

  // Load template on mount if in edit mode
  useEffect(() => {
    if (isEditMode) {
      loadTemplate();
    }
  }, [isEditMode, loadTemplate]);

  const toggleDay = (index: number) => {
    if (selectedDays.includes(index)) {
      setSelectedDays(selectedDays.filter((d) => d !== index));
    } else {
      setSelectedDays([...selectedDays, index].sort());
    }
  };

  // Store exercise metadata (sets, reps, weight, isBodyweight) separately
  // This is needed because SelectorOption doesn't include these fields
  const [exerciseMetadata, setExerciseMetadata] = useState<
    Map<
      string,
      Omit<ExerciseInWorkout, 'id' | 'label' | 'description' | 'icon' | 'iconBgColor' | 'iconColor'>
    >
  >(new Map());

  // Handle adding exercise from AddExerciseModal
  const handleAddExerciseWithMetadata = useCallback(
    async (exerciseData: {
      exerciseId: string;
      sets: number;
      reps: number;
      weight: number;
      isBodyweight: boolean;
    }) => {
      try {
        // Fetch exercise details from database
        const exercise = await database.get<Exercise>('exercises').find(exerciseData.exerciseId);

        // Determine icon and colors based on exercise type
        const equipmentType = exercise.equipmentType?.toLowerCase() || '';
        const isBodyweight =
          equipmentType.includes('bodyweight') || equipmentType.includes('body weight');
        const Icon = isBodyweight ? User : Dumbbell;

        // Get colors based on exercise type
        const iconBgColor = isBodyweight
          ? theme.colors.background.white5
          : theme.colors.accent.primary10;
        const iconColor = isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary;

        // Generate description
        const description = `${exerciseData.sets} sets × ${exerciseData.reps} reps`;

        // Create new exercise option
        const newExercise: SelectorOption<string> = {
          id: exerciseData.exerciseId,
          label: exercise.name,
          description,
          icon: Icon,
          iconBgColor,
          iconColor,
          groupId: undefined,
        };

        // Store metadata
        setExerciseMetadata((prev) => {
          const updated = new Map(prev);
          updated.set(exerciseData.exerciseId, {
            sets: exerciseData.sets,
            reps: exerciseData.reps,
            weight: exerciseData.weight,
            isBodyweight: exerciseData.isBodyweight,
            groupId: undefined,
          });
          return updated;
        });

        // Add to exercises array
        setExercises((prev) => [...prev, newExercise]);
      } catch (error) {
        console.error('Error adding exercise:', error);
        Alert.alert(
          t('common.error', 'Error'),
          t('createWorkout.addExerciseError', 'Failed to add exercise')
        );
      }
    },
    [t]
  );

  // Handle saving workout template
  const handleSave = useCallback(async () => {
    // Validate
    if (!workoutTitle.trim()) {
      Alert.alert(
        t('createWorkout.validation.titleRequired', 'Title Required'),
        t('createWorkout.validation.titleRequiredMessage', 'Please enter a workout title')
      );
      return;
    }

    // Allow saving with no exercises (empty workout template)
    // User can add exercises later or use it as a placeholder

    setIsSaving(true);
    try {
      // Convert exercises with metadata to ExerciseInWorkout format
      const exercisesInWorkout: ExerciseInWorkout[] = exercises.map((ex) => {
        const metadata = exerciseMetadata.get(ex.id) || {
          sets: 3,
          reps: 10,
          weight: 0,
          isBodyweight: false,
          groupId: undefined,
        };

        return {
          id: ex.id,
          label: ex.label,
          description: ex.description,
          icon: ex.icon,
          iconBgColor: ex.iconBgColor,
          iconColor: ex.iconColor,
          groupId: ex.groupId || metadata.groupId,
          sets: metadata.sets,
          reps: metadata.reps,
          weight: metadata.weight,
          isBodyweight: metadata.isBodyweight,
        };
      });

      // Save template (update if editing, create if new)
      await WorkoutTemplateService.saveTemplate({
        templateId: isEditMode ? templateId : undefined,
        name: workoutTitle.trim(),
        description: description.trim() || undefined,
        exercises: exercisesInWorkout,
        selectedDays,
      });

      // Navigate back
      router.back();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('createWorkout.saveError', 'Failed to save workout template')
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    workoutTitle,
    description,
    exercises,
    exerciseMetadata,
    selectedDays,
    isEditMode,
    templateId,
    router,
    t,
  ]);

  // Update metadata when exercises are reordered or grouped
  const handleExerciseOrderChange = useCallback((reorderedExercises: SelectorOption<string>[]) => {
    setExercises(reorderedExercises);
    // Update groupId in metadata
    setExerciseMetadata((prev) => {
      const updated = new Map(prev);
      reorderedExercises.forEach((ex) => {
        const existing = updated.get(ex.id);
        if (existing) {
          updated.set(ex.id, { ...existing, groupId: ex.groupId });
        } else {
          // If metadata doesn't exist yet, create it with the groupId
          updated.set(ex.id, {
            sets: 3,
            reps: 10,
            weight: 0,
            isBodyweight: false,
            groupId: ex.groupId,
          });
        }
      });
      return updated;
    });
  }, []);

  const volumeOptions = [
    { label: t('createWorkout.volumeCalculation.none'), value: 'none' },
    { label: t('createWorkout.volumeCalculation.algorithm'), value: 'algorithm' },
    {
      label: t('createWorkout.volumeCalculation.ai'),
      value: 'ai',
      icon: (
        <Sparkles
          size={theme.iconSize.xs}
          color={volumeCalc === 'ai' ? theme.colors.text.white : theme.colors.text.tertiary}
        />
      ),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      {/* Background Glows */}
      <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: -theme.size['100'],
            right: -theme.size['100'],
            width: theme.size['300'],
            height: theme.size['300'],
            borderRadius: theme.borderRadius['150'],
            backgroundColor: theme.colors.accent.primary20,
            opacity: theme.colors.opacity.subtle,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -theme.size['100'],
            left: -theme.size['100'],
            width: theme.size['250'],
            height: theme.size['250'],
            borderRadius: theme.borderRadius['125'],
            backgroundColor: theme.colors.status.indigo10,
            opacity: theme.colors.opacity.subtle,
          }}
        />
      </View>

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.padding.base,
          paddingVertical: theme.spacing.padding.sm,
          zIndex: theme.zIndex.dropdown,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
              width: theme.size['10'],
              height: theme.size['10'],
              borderRadius: theme.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? theme.colors.opacity.strong : theme.colors.opacity.full,
            },
          ]}
        >
          <ArrowLeft size={theme.iconSize.xl} color={theme.colors.text.secondary} />
        </Pressable>
        <Text
          style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
          }}
        >
          {isEditMode ? t('createWorkout.editTitle', 'Edit Workout') : t('createWorkout.title')}
        </Text>
        {isSaving ? (
          <ActivityIndicator size="small" color={theme.colors.accent.primary} />
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              {
                paddingHorizontal: theme.spacing.padding.sm,
                paddingVertical: theme.spacing.padding.xs,
                opacity:
                  pressed || isSaving ? theme.colors.opacity.strong : theme.colors.opacity.full,
              },
            ]}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
              }}
            >
              {t('createWorkout.save')}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.padding.base,
          paddingBottom: theme.size['120'],
        }}
      >
        {/* Essentials Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.md,
              marginLeft: theme.spacing.margin.xs,
            }}
          >
            {t('createWorkout.essentials')}
          </Text>

          <View style={{ gap: theme.spacing.gap.base }}>
            {/* Title Input */}
            <View
              style={{
                position: 'relative',
                borderRadius: theme.borderRadius.lg,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  padding: theme.spacing.padding.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor:
                    focusedField === 'title'
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                  ...(focusedField === 'title' ? theme.shadows.accentGlow : {}),
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.secondary,
                    marginBottom: theme.spacing.margin.xs,
                  }}
                >
                  {t('createWorkout.workoutTitle')}
                </Text>
                <TextInput
                  value={workoutTitle}
                  onChangeText={setWorkoutTitle}
                  onFocus={() => setFocusedField('title')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t('createWorkout.workoutTitlePlaceholder')}
                  placeholderTextColor={theme.colors.text.tertiary}
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                    padding: theme.spacing.padding.xs,
                  }}
                />
              </View>
            </View>

            {/* Description Input */}
            <View
              style={{
                position: 'relative',
                borderRadius: theme.borderRadius.lg,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  padding: theme.spacing.padding.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor:
                    focusedField === 'description'
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                  ...(focusedField === 'description' ? theme.shadows.accentGlow : {}),
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.secondary,
                    marginBottom: theme.spacing.padding.xs,
                  }}
                >
                  {t('createWorkout.description')}
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t('createWorkout.descriptionPlaceholder')}
                  placeholderTextColor={theme.colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                    padding: theme.spacing.padding.xs,
                    minHeight: theme.size['5xl'],
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Intelligence Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.md,
              marginLeft: theme.spacing.margin.xs,
            }}
          >
            {t('createWorkout.intelligence')}
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.base,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.padding.base,
              }}
            >
              {t('createWorkout.volumeCalculation.title')}
            </Text>

            <SegmentedControl
              options={volumeOptions}
              value={volumeCalc}
              onValueChange={setVolumeCalc}
            />

            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing.padding.md,
                lineHeight: theme.typography.fontSize.lg,
              }}
            >
              {t('createWorkout.volumeCalculation.description')}
            </Text>
          </View>
        </View>

        {/* Routine Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.md,
              marginLeft: theme.spacing.margin.xs,
            }}
          >
            {t('createWorkout.routine')}
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.base,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing.padding.base,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.primary,
                }}
              >
                {t('createWorkout.repeatOnDays')}
              </Text>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.accent.primary,
                }}
              >
                {t('createWorkout.weekly')}
              </Text>
            </View>

            <WeekdayPicker days={days} selectedDays={selectedDays} onToggleDay={toggleDay} />
          </View>
        </View>

        {/* Exercises Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.md,
              marginLeft: theme.spacing.margin.xs,
            }}
          >
            {t('createWorkout.exercises')}
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.base,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            {isLoading ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : exercises.length > 0 ? (
              <OptionsMultiSelector
                title={t('createWorkout.exercisesInWorkout')}
                options={exercises}
                selectedIds={selectedExercises}
                onChange={(ids) => setSelectedExercises(ids)}
                onOrderChange={handleExerciseOrderChange}
                isEditable={true}
              />
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="text-center text-text-secondary">
                  {t(
                    'createWorkout.noExercisesPlaceholder',
                    'No exercises added yet. Add exercises to get started.'
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Fixed Bottom Button */}
        <View
          style={{
            padding: theme.spacing.padding.base,
            paddingBottom: Math.max(insets.bottom, theme.spacing.padding.base),
            backgroundColor: 'transparent',
          }}
        >
          <View style={{ backgroundColor: theme.colors.background.primary }}>
            <Button
              label={t('workouts.addExercise.title')}
              variant="gradientCta"
              size="md"
              width="full"
              icon={PlusSquare}
              onPress={() => setAddExerciseVisible(true)}
            />
          </View>
        </View>
      </ScrollView>
      <AddExerciseModal
        visible={addExerciseVisible}
        onClose={() => setAddExerciseVisible(false)}
        onAddExercise={handleAddExerciseWithMetadata}
      />
    </SafeAreaView>
  );
}
