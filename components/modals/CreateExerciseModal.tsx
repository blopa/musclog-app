import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronDown, Dumbbell, Link } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { type MuscleGroup } from '@/database/models';
import { ExerciseService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';
import { saveExerciseImage } from '@/utils/file';
import { handleError } from '@/utils/handleError';

import { FullScreenModal } from './FullScreenModal';

// Muscle groups will be translated using useTranslation hook
// Using string arrays for translation keys, but values should match MuscleGroup where possible
const PRIMARY_MUSCLES_KEYS: (MuscleGroup | 'legs' | 'arms' | 'core')[] = [
  'chest',
  'shoulders',
  'back',
  'legs',
  'arms',
  'core',
];
const SECONDARY_MUSCLES_KEYS: (MuscleGroup | 'abs' | 'forearms' | 'traps' | 'glutes')[] = [
  'triceps',
  'biceps',
  'abs',
  'forearms',
  'traps',
  'glutes',
];

type CreateExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function CreateExerciseModal({ visible, onClose }: CreateExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [exerciseName, setExerciseName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [isBodyweightOnly, setIsBodyweightOnly] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);

  const PRIMARY_MUSCLES = PRIMARY_MUSCLES_KEYS.map((value) => ({
    value,
    label: t(`exercises.createExercise.muscleGroups.primary.${value}`),
  }));

  const SECONDARY_MUSCLES = SECONDARY_MUSCLES_KEYS.map((value) => ({
    value,
    label: t(`exercises.createExercise.muscleGroups.secondary.${value}`),
  }));

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setExerciseName('');
      setPrimaryMuscle(null);
      setSecondaryMuscles([]);
      setIsBodyweightOnly(false);
      setImageUri(undefined);
      setVideoUrl('');
      setShowVideoInput(false);
      setIsCreating(false);
    }
  }, [visible]);

  const handleCreateExercise = async () => {
    if (!exerciseName.trim()) {
      showSnackbar('error', t('exercises.createExercise.nameRequired'));
      return;
    }
    if (!primaryMuscle) {
      showSnackbar('error', t('exercises.createExercise.primaryMuscleRequired'));
      return;
    }

    setIsCreating(true);
    try {
      const equipmentType = isBodyweightOnly ? 'bodyweight' : 'other';
      await ExerciseService.createExercise(
        exerciseName.trim(),
        '',
        primaryMuscle as MuscleGroup,
        equipmentType,
        'compound',
        1.0,
        imageUri
      );
      showSnackbar('success', t('exercises.createExercise.createSuccess'));
      onClose();
    } catch (error) {
      handleError(error, 'CreateExerciseModal.handleSave', {
        snackbarMessage: t('exercises.createExercise.createError'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSnackbar('error', t('exercises.createExercise.imagePermissionDenied'));

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        // Copy the image from the picker's temporary cache to permanent storage
        const permanentUri = await saveExerciseImage(result.assets[0].uri, imageUri);
        setImageUri(permanentUri);
      } catch (err) {
        handleError(err, 'CreateExerciseModal.handleUploadImage', {
          snackbarMessage: t('exercises.createExercise.createError'),
        });
      }
    }
  };

  const handleVideoURL = () => {
    setShowVideoInput((prev) => !prev);
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
      title={t('exercises.createExercise.title')}
      footer={
        <Button
          label={t('exercises.createExercise.createButton')}
          onPress={handleCreateExercise}
          variant="gradientCta"
          size="md"
          width="full"
          loading={isCreating}
          disabled={isCreating}
        />
      }
    >
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
                  <View
                    className="h-14 w-full flex-row items-center justify-between rounded-lg border bg-bg-card px-4"
                    style={{ borderColor: theme.colors.background.white10 }}
                  >
                    <Text
                      className="font-medium"
                      style={{
                        color: primaryMuscle
                          ? theme.colors.text.primary
                          : theme.colors.text.tertiary,
                      }}
                    >
                      {primaryMuscleLabel}
                    </Text>
                    <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
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
                      }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary,
                          fontWeight: isSelected ? '600' : '500',
                        }}
                      >
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
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4"
                style={{
                  borderColor: imageUri
                    ? theme.colors.accent.primary
                    : theme.colors.background.white10,
                  backgroundColor: imageUri
                    ? theme.colors.accent.primary10
                    : theme.colors.background.cardElevated,
                  overflow: 'hidden',
                }}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: 48, height: 48, borderRadius: theme.borderRadius.sm }}
                  />
                ) : (
                  <Camera size={theme.iconSize.xl} color={theme.colors.text.tertiary} />
                )}
                <Text
                  className="text-xs font-medium"
                  style={{
                    color: imageUri ? theme.colors.accent.primary : theme.colors.text.secondary,
                  }}
                >
                  {imageUri
                    ? t('exercises.createExercise.imageSelected')
                    : t('exercises.createExercise.uploadImage')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleVideoURL}
                className="flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4"
                style={{
                  borderColor: videoUrl
                    ? theme.colors.accent.primary
                    : theme.colors.background.white10,
                  backgroundColor: videoUrl
                    ? theme.colors.accent.primary10
                    : theme.colors.background.cardElevated,
                }}
              >
                {videoUrl ? (
                  <Check size={theme.iconSize.xl} color={theme.colors.accent.primary} />
                ) : (
                  <Link size={theme.iconSize.xl} color={theme.colors.text.tertiary} />
                )}
                <Text
                  className="text-xs font-medium"
                  style={{
                    color: videoUrl ? theme.colors.accent.primary : theme.colors.text.secondary,
                  }}
                >
                  {videoUrl
                    ? t('exercises.createExercise.videoURLSet')
                    : t('exercises.createExercise.videoURL')}
                </Text>
              </Pressable>
            </View>
            {showVideoInput ? (
              <TextInput
                label={t('exercises.createExercise.videoURL')}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://youtube.com/..."
                icon={<Link size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

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
