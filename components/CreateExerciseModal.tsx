import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera, Link, ChevronDown, Dumbbell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { TextInput } from './theme/TextInput';
import { Button } from './theme/Button';
import { ToggleInput } from './theme/ToggleInput';
import { BottomPopUpMenu } from './BottomPopUpMenu';
import { FullScreenModal } from './modals/FullScreenModal';

// Muscle groups will be translated using useTranslation hook
const PRIMARY_MUSCLES_KEYS = ['chest', 'shoulders', 'back', 'legs', 'arms', 'core'];
const SECONDARY_MUSCLES_KEYS = ['triceps', 'biceps', 'abs', 'forearms', 'traps', 'glutes'];

type CreateExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function CreateExerciseModal({ visible, onClose }: CreateExerciseModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exerciseName, setExerciseName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>(['abs', 'traps']);
  const [isBodyweightOnly, setIsBodyweightOnly] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const PRIMARY_MUSCLES = PRIMARY_MUSCLES_KEYS.map((value) => ({
    value,
    label: t(`exercises.createExercise.muscleGroups.primary.${value}`),
  }));

  const SECONDARY_MUSCLES = SECONDARY_MUSCLES_KEYS.map((value) => ({
    value,
    label: t(`exercises.createExercise.muscleGroups.secondary.${value}`),
  }));

  const handleBack = () => {
    router.back();
  };

  const handleCreateExercise = () => {
    // TODO: Implement create exercise logic
    console.log('Create exercise', {
      exerciseName,
      primaryMuscle,
      secondaryMuscles,
      isBodyweightOnly,
    });
  };

  const handleUploadImage = () => {
    // TODO: Implement image upload
    console.log('Upload image');
  };

  const handleVideoURL = () => {
    // TODO: Implement video URL input
    console.log('Video URL');
  };

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    );
  };

  const handleSelectPrimaryMuscle = (muscle: string) => {
    setPrimaryMuscle(muscle);
    setIsPickerVisible(false);
  };

  const primaryMuscleLabel = primaryMuscle
    ? PRIMARY_MUSCLES.find((m) => m.value === primaryMuscle)?.label ||
      t('exercises.createExercise.selectPrimaryMuscle')
    : t('exercises.createExercise.selectPrimaryMuscle');

  const pickerMenuItems = PRIMARY_MUSCLES.map((muscle) => ({
    icon: Dumbbell,
    iconColor: theme.colors.text.primary,
    iconBgColor: theme.colors.text.primary20,
    title: muscle.label,
    description: '',
    onPress: () => handleSelectPrimaryMuscle(muscle.value),
  }));

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exercises.createExercise.title')}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-2" style={{ gap: theme.spacing.gap.xl }}>
          {/* Exercise Name */}
          <View>
            <TextInput
              label={t('exercises.createExercise.exerciseName')}
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder={t('exercises.createExercise.exerciseNamePlaceholder')}
            />
          </View>

          {/* Muscle Target Section */}
          <View style={{ gap: theme.spacing.gap.base }}>
            <Text className="text-lg font-bold tracking-tight text-text-primary">
              {t('exercises.createExercise.muscleTarget')}
            </Text>

            {/* Primary Muscle Group */}
            <View>
              <Pressable onPress={() => setIsPickerVisible(true)}>
                <View className="flex-col gap-2">
                  <Text className="ml-1 text-sm font-medium text-text-secondary">
                    {t('exercises.createExercise.primaryMuscleGroup')}
                  </Text>
                  <View className="h-14 w-full flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card px-4">
                    <Text
                      className="font-medium"
                      style={{
                        color: primaryMuscle
                          ? theme.colors.text.primary
                          : theme.colors.text.tertiary,
                      }}>
                      {primaryMuscleLabel}
                    </Text>
                    <ChevronDown size={20} color={theme.colors.text.tertiary} />
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Secondary Muscles */}
            <View style={{ gap: theme.spacing.gap.sm }}>
              <Text className="ml-1 text-sm font-medium text-text-secondary">
                {t('exercises.createExercise.secondaryMuscles')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SECONDARY_MUSCLES.map((muscle) => {
                  const isSelected = secondaryMuscles.includes(muscle.value);
                  return (
                    <Pressable
                      key={muscle.value}
                      onPress={() => toggleSecondaryMuscle(muscle.value)}
                      className="rounded-full border px-4 py-2"
                      style={{
                        backgroundColor: isSelected
                          ? theme.colors.accent.primary20
                          : theme.colors.background.overlay,
                        borderColor: isSelected
                          ? theme.colors.accent.primary + '80'
                          : 'transparent',
                      }}>
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary,
                          fontWeight: isSelected ? '600' : '500',
                        }}>
                        {muscle.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Settings Section */}
          <ToggleInput
            items={[
              {
                key: 'bodyweight',
                label: t('exercises.createExercise.bodyweightOnly'),
                subtitle: t('exercises.createExercise.bodyweightOnlySubtitle'),
                value: isBodyweightOnly,
                onValueChange: setIsBodyweightOnly,
              },
            ]}
          />

          {/* Add Visuals Section */}
          <View style={{ gap: theme.spacing.gap.md }}>
            <Text className="text-lg font-bold tracking-tight text-text-primary">
              {t('exercises.createExercise.addVisuals')}
            </Text>
            <View className="flex-row gap-4">
              <Pressable
                onPress={handleUploadImage}
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 bg-bg-card/30 p-4 active:border-accent-primary active:bg-accent-primary/5">
                <Camera size={24} color={theme.colors.text.tertiary} />
                <Text className="text-xs font-medium text-text-secondary">
                  {t('exercises.createExercise.uploadImage')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleVideoURL}
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 bg-bg-card/30 p-4 active:border-accent-primary active:bg-accent-primary/5">
                <Link size={24} color={theme.colors.text.tertiary} />
                <Text className="text-xs font-medium text-text-secondary">
                  {t('exercises.createExercise.videoURL')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom spacing for fixed button */}
          <View style={{ height: theme.size.spacer100 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        className="px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: 16,
          backgroundColor: theme.colors.background.primary,
        }}>
        <Button
          label={t('exercises.createExercise.createButton')}
          onPress={handleCreateExercise}
          variant="gradientCta"
          size="md"
          width="full"
        />
      </View>

      {/* Primary Muscle Picker */}
      <BottomPopUpMenu
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        title={t('exercises.createExercise.primaryMuscleGroup')}
        items={pickerMenuItems}
      />
    </FullScreenModal>
  );
}
