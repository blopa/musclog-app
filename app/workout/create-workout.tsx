import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, PlusSquare } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Button } from '../../components/theme/Button';
import { SegmentedControl } from '../../components/theme/SegmentedControl';
import { OptionsMultiSelector } from '../../components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { WeekdayPicker } from '../../components/theme/WeekdayPicker';
import { SelectorOption } from '../../components/theme/OptionsMultiSelector/utils';
import { AddExerciseModal } from '../../components/modals/AddExerciseModal';

export default function CreateWorkoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeCalc, setVolumeCalc] = useState('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([4]); // Friday selected by default in mockup
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // TODO: implement this
  const isLoadingExercises = false;

  // TODO: unhardcode the translations for days
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);

  const [exercises, setExercises] = useState<SelectorOption<string>[]>([
    {
      id: 'squat',
      label: 'Barbell Back Squat',
      description: '4 sets × 6–8 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
      groupId: 'compound-lifts', // Grouped with bench press
    },
    {
      id: 'bench',
      label: 'Barbell Bench Press',
      description: '4 sets × 6–8 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.indigo10,
      iconColor: theme.colors.status.indigo,
      groupId: 'compound-lifts', // Grouped with squat
    },
    {
      id: 'leg-extension',
      label: 'Leg Extension',
      description: '3 sets × 12–15 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.indigo10,
      iconColor: theme.colors.status.indigo,
      groupId: 'compound-lifts', // Grouped with squat
    },
    {
      id: 'deadlift',
      label: 'Romanian Deadlift',
      description: '3 sets × 8–10 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.purple + '11',
      iconColor: theme.colors.status.purple,
      // No groupId - standalone exercise
    },
    {
      id: 'leg-press',
      label: 'Leg Press',
      description: '3 sets × 10–12 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
      // No groupId - standalone exercise
    },
    {
      id: 'calf-raises',
      label: 'Standing Calf Raises',
      description: '4 sets × 12–15 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.indigo10,
      iconColor: theme.colors.status.indigo,
      // No groupId - standalone exercise
    },
    {
      id: 'hamstring-curls',
      label: 'Hamstring Curls',
      description: '3 sets × 12–15 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.purple + '11',
      iconColor: theme.colors.status.purple,
      groupId: 'hamstring-isolation', // Grouped with glute bridges
    },
    {
      id: 'glute-bridges',
      label: 'Glute Bridges',
      description: '3 sets × 10–12 reps',
      icon: PlusSquare,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
      groupId: 'hamstring-isolation', // Grouped with hamstring curls
    },
    {
      id: 'lunges',
      label: 'Walking Lunges',
      description: '3 sets × 20 steps',
      icon: PlusSquare,
      iconBgColor: theme.colors.status.purple + '11',
      iconColor: theme.colors.status.purple,
      // No groupId - standalone exercise
    },
  ]);

  const toggleDay = (index: number) => {
    if (selectedDays.includes(index)) {
      setSelectedDays(selectedDays.filter((d) => d !== index));
    } else {
      setSelectedDays([...selectedDays, index]);
    }
  };

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
          {t('createWorkout.title')}
        </Text>
        <Pressable
          onPress={() => {
            /* Save logic */
          }}
          style={({ pressed }) => [
            {
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.xs,
              opacity: pressed ? theme.colors.opacity.strong : theme.colors.opacity.full,
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
            {isLoadingExercises ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : exercises.length > 0 ? (
              <OptionsMultiSelector
                title={t('createWorkout.exercisesInWorkout')}
                options={exercises}
                selectedIds={selectedExercises}
                onChange={(ids) => setSelectedExercises(ids)}
                onOrderChange={(reorderedExercises) => setExercises(reorderedExercises)}
                isEditable={true}
              />
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="text-center text-text-secondary">
                  {/* text: No exercises available. Add exercises to get started. */}
                  {t('createWorkout.noExercisesPlaceholder')}
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
        onAddExercise={() => console.log('Add exercise')}
      />
    </SafeAreaView>
  );
}
