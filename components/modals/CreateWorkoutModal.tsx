import { PlusSquare, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type { WorkoutType } from '../../constants/workoutTypes';
import { WORKOUT_TYPES } from '../../constants/workoutTypes';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { useWorkoutForm } from '../../hooks/useWorkoutForm';
import { WEEKDAY_LABELS } from '../../utils/workout';
import { getWorkoutIcon, WORKOUT_ICON_OPTIONS } from '../../utils/workoutIconUtils';
import { Button } from '../theme/Button';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import { SegmentedControl } from '../theme/SegmentedControl';
import { TextInput } from '../theme/TextInput';
import { WeekdayPicker } from '../theme/WeekdayPicker';
import { AddExerciseModal } from './AddExerciseModal';
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
  const theme = useTheme();
  const { t } = useTranslation();
  const { isAiConfigured } = useSettings();

  const [addExerciseVisible, setAddExerciseVisible] = useState(false);

  const {
    workoutTitle,
    description,
    volumeCalc,
    workoutType,
    icon,
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
    setWorkoutType,
    setIcon,
    setFocusedField,
    setSelectedExercises,
    toggleDay,
    handleAddExerciseWithMetadata,
    handleSave,
    handleExerciseOrderChange,
    handleDeleteExercises,
  } = useWorkoutForm({ templateId, onSaveSuccess: onClose });

  const volumeOptions = [
    { label: t('createWorkout.volumeCalculation.none'), value: 'none' },
    { label: t('createWorkout.volumeCalculation.algorithm'), value: 'algorithm' },
    ...(isAiConfigured
      ? [
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
        ]
      : []),
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={isEditMode ? t('createWorkout.editTitle') : t('createWorkout.title')}
      scrollable={false}
      footer={
        <Button
          label={t('createWorkout.save')}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleSave}
          disabled={isSaving}
          loading={isSaving}
        />
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
      <View style={{ height: theme.size.md }} />
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
            <TextInput
              label={t('createWorkout.workoutTitle')}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              placeholder={t('createWorkout.workoutTitlePlaceholder')}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField(null)}
            />

            {/* Description Input */}
            <TextInput
              label={t('createWorkout.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('createWorkout.descriptionPlaceholder')}
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Workout Type */}
          <View
            style={{
              marginTop: theme.spacing.gap.base,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.md,
              borderWidth: theme.borderWidth.thin,
              borderColor:
                focusedField === 'workoutType'
                  ? theme.colors.accent.primary
                  : theme.colors.border.light,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
                marginBottom: theme.spacing.padding.sm,
              }}
            >
              {t('createWorkout.workoutType')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.gap.sm }}>
              {WORKOUT_TYPES.filter((t) => t !== 'free').map((type) => {
                const isSelected = workoutType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setWorkoutType(type as WorkoutType)}
                    style={{
                      paddingVertical: theme.spacing.padding.sm,
                      paddingHorizontal: theme.spacing.padding.md,
                      borderRadius: theme.borderRadius.lg,
                      backgroundColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.background.white5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.medium,
                        color: isSelected ? theme.colors.text.white : theme.colors.text.secondary,
                      }}
                    >
                      {t(`createWorkout.types.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Workout Icon */}
          <View
            style={{
              marginTop: theme.spacing.gap.base,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
                marginBottom: theme.spacing.padding.sm,
              }}
            >
              {t('createWorkout.workoutIcon')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.gap.sm }}
            >
              <Pressable
                onPress={() => setIcon(undefined)}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.borderRadius.lg,
                  backgroundColor:
                    icon === undefined
                      ? theme.colors.accent.primary
                      : theme.colors.background.white5,
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color:
                      icon === undefined ? theme.colors.text.white : theme.colors.text.tertiary,
                  }}
                >
                  {t('common.none')}
                </Text>
              </Pressable>
              {WORKOUT_ICON_OPTIONS.map((option) => {
                const IconComponent = getWorkoutIcon(option.value);
                const isSelected = icon === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setIcon(option.value)}
                    style={{
                      width: 48,
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.borderRadius.lg,
                      backgroundColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.background.white5,
                    }}
                  >
                    <IconComponent
                      size={theme.iconSize.md}
                      color={isSelected ? theme.colors.text.white : theme.colors.text.secondary}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
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
              <>
                <OptionsMultiSelector
                  title={t('createWorkout.exercisesInWorkout')}
                  options={exercises}
                  selectedIds={selectedExercises}
                  onChange={((ids: any) => setSelectedExercises(ids)) as any}
                  onOrderChange={handleExerciseOrderChange as any}
                  onDelete={handleDeleteExercises as any}
                  isEditable={true}
                />
                <View style={{ marginTop: theme.spacing.margin.md }}>
                  <Button
                    label={t('workouts.addExercise.title')}
                    variant="secondary"
                    size="sm"
                    width="full"
                    icon={PlusSquare}
                    onPress={() => setAddExerciseVisible(true)}
                  />
                </View>
              </>
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="mb-4 text-center text-text-secondary">
                  {t('createWorkout.noExercisesPlaceholder')}
                </Text>
                <Button
                  label={t('workouts.addExercise.title')}
                  variant="secondary"
                  size="sm"
                  width="full"
                  icon={PlusSquare}
                  onPress={() => setAddExerciseVisible(true)}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {addExerciseVisible ? (
        <AddExerciseModal
          visible={addExerciseVisible}
          onClose={() => setAddExerciseVisible(false)}
          onAddExercise={handleAddExerciseWithMetadata}
        />
      ) : null}
    </FullScreenModal>
  );
}
