import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, PlusSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import { WeekdayPicker } from '../theme/WeekdayPicker';
import { AddExerciseModal } from './AddExerciseModal';
import { WEEKDAY_LABELS } from '../../utils/workout';
import { useWorkoutForm } from '../../hooks/useWorkoutForm';
import { FullScreenModal } from './FullScreenModal';

type CreateWorkoutModalProps = {
  visible: boolean;
  onClose: () => void;
  templateId?: string;
};

export default function CreateWorkoutModal({
  visible,
  onClose,
  templateId,
}: CreateWorkoutModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [addExerciseVisible, setAddExerciseVisible] = useState(false);

  const {
    workoutTitle,
    description,
    volumeCalc,
    selectedDays,
    focusedField,
    isLoading,
    isSaving,
    selectedExercises,
    exercises,
    isEditMode,
    setWorkoutTitle,
    setDescription,
    setVolumeCalc,
    setFocusedField,
    setSelectedExercises,
    toggleDay,
    handleAddExerciseWithMetadata,
    handleSave,
    handleExerciseOrderChange,
  } = useWorkoutForm({ templateId });

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
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={isEditMode ? t('createWorkout.editTitle') : t('createWorkout.title')}
      scrollable={false}
      headerRight={
        <View>
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
      }
    >
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

            <WeekdayPicker
              days={WEEKDAY_LABELS}
              selectedDays={selectedDays}
              onToggleDay={toggleDay}
            />
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
    </FullScreenModal>
  );
}
