import { Activity, ChevronRight, Dumbbell, Footprints, Search } from 'lucide-react-native';
import { ComponentType, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Accordion } from '@/components/theme/Accordion';
import { Button } from '@/components/theme/Button';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { TextInput } from '@/components/theme/TextInput';
import { useExercises } from '@/hooks/useExercises';
import { useTheme } from '@/hooks/useTheme';
import { FALLBACK_EXERCISE_IMAGE } from '@/utils/exerciseImage';

import { FullScreenModal } from './FullScreenModal';
import ViewExerciseModal from './ViewExerciseModal';

// Type for exercise data used in the component
export type ExerciseData = {
  id: string;
  name: string;
  type: string;
  muscleGroup: string;
  imageUrl?: string;
  loadMultiplier?: number;
};

// Map equipment type from database to display type
const mapEquipmentTypeToType = (equipmentType: string): string => {
  switch (equipmentType) {
    case 'Bodyweight':
      return 'bodyweight';
    case 'Machine':
      return 'machine';
    default:
      return 'equipment';
  }
};

// Exercise list item component
function ExerciseListItem({
  name,
  type,
  imageUrl,
  onPress,
  getTypeTagLabel,
}: {
  name: string;
  type: string;
  imageUrl?: string;
  onPress: () => void;
  getTypeTagLabel: (type: string) => { label: string; variant: 'primary' | 'secondary' };
}) {
  const theme = useTheme();
  const tag = getTypeTagLabel(type);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 px-4 py-3 active:bg-bg-overlay"
    >
      <View
        className="h-14 w-14 overflow-hidden rounded-lg bg-bg-card"
        style={{ backgroundColor: theme.colors.background.exerciseCardBackground }}
      >
        <Image
          source={imageUrl?.trim() ? { uri: imageUrl } : FALLBACK_EXERCISE_IMAGE}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary">{name}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <View
            className={`rounded-full px-2 py-0.5 ${
              tag.variant === 'primary'
                ? 'border border-accent-primary/30 bg-accent-primary/20'
                : 'border border-border-dark bg-bg-card'
            }`}
          >
            <Text
              className="font-bold uppercase tracking-wider"
              style={{
                fontSize: theme.typography.fontSize.xs,
                color:
                  tag.variant === 'primary'
                    ? theme.colors.accent.primary
                    : theme.colors.status.brandPale,
              }}
            >
              {tag.label}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

type ExercisesModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectExercise?: (exercise: ExerciseData) => void;
};

export default function ExercisesModal({
  visible,
  onClose,
  onSelectExercise,
}: ExercisesModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewExerciseId, setViewExerciseId] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    chest: true, // Chest starts open
  });

  // Map muscle groups to display names and icons (using translations)
  const MUSCLE_GROUP_CONFIG: Record<
    string,
    { name: string; icon: ComponentType<{ size: number; color: string }> }
  > = {
    chest: { name: t('exercises.muscleGroups.chest'), icon: Activity },
    back: { name: t('exercises.muscleGroups.back'), icon: Dumbbell },
    legs: { name: t('exercises.muscleGroups.legs'), icon: Footprints },
    shoulders: { name: t('exercises.muscleGroups.shoulders'), icon: Activity },
    arms: { name: t('exercises.muscleGroups.arms'), icon: Dumbbell },
    core: { name: t('exercises.muscleGroups.core'), icon: Activity },
    abdomen: { name: t('exercises.muscleGroups.abdomen'), icon: Activity },
    glutes: { name: t('exercises.muscleGroups.glutes'), icon: Footprints },
    full_body: { name: t('exercises.muscleGroups.fullBody'), icon: Activity },
  };

  const {
    exercises: exerciseRecords,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  } = useExercises({
    mode: 'list',
    searchTerm: searchQuery,
    initialLimit: 40,
    batchSize: 40,
    visible,
  });

  const exercises = useMemo<ExerciseData[]>(
    () =>
      exerciseRecords.map((exercise) => ({
        id: exercise.id,
        name: exercise.name ?? '',
        type: mapEquipmentTypeToType(exercise.equipmentType ?? ''),
        muscleGroup: exercise.muscleGroup ?? '',
        imageUrl: exercise.imageUrl || undefined,
        loadMultiplier: exercise.loadMultiplier,
      })),
    [exerciseRecords]
  );

  // Map exercise types to tag display (using translations)
  const getExerciseTypeTag = (type: string) => {
    switch (type) {
      case 'bodyweight':
        return { label: t('exercises.typeTags.bodyweight'), variant: 'primary' as const };
      case 'machine':
      case 'equipment':
        return { label: t('exercises.typeTags.equipment'), variant: 'secondary' as const };
      default:
        return { label: t('exercises.typeTags.equipment'), variant: 'secondary' as const };
    }
  };

  // Group exercises by muscle group
  const exercisesByGroup = useMemo(() => {
    const grouped: Record<string, ExerciseData[]> = {};
    exercises.forEach((exercise) => {
      const group = exercise.muscleGroup;
      if (!grouped[group]) {
        grouped[group] = [];
      }

      grouped[group].push(exercise);
    });

    return grouped;
  }, [exercises]);

  const toggleAccordion = (group: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const handleExercisePress = (exercise: ExerciseData) => {
    if (onSelectExercise) {
      onSelectExercise(exercise);
      return;
    }

    setViewExerciseId(exercise.id);
  };

  const handleViewExerciseClose = () => {
    setViewExerciseId(null);
  };

  const handleExerciseDeletedOrUpdated = () => {
    void refresh();
  };

  const getExerciseImageUrl = (exercise: ExerciseData) => exercise.imageUrl ?? '';

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exercises.title')}
      scrollable={false}
    >
      <KeyboardAwareScrollView
        className="flex-1 px-4 pb-32"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <View className="py-3">
          {/* Search Input (themed) */}
          <View className="py-3">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('exercises.searchPlaceholder')}
              icon={<Search size={theme.iconSize.md} color={theme.colors.status.brandPale} />}
            />
          </View>
        </View>

        {isLoading ? (
          // Loading skeleton
          <>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                className="mb-4 overflow-hidden rounded-lg border border-border-dark bg-bg-card"
              >
                <View className="flex-row items-center justify-between px-4 py-4">
                  <View className="flex-row items-center gap-3">
                    <SkeletonLoader
                      width={theme.size.lg}
                      height={theme.size.lg}
                      borderRadius={theme.borderRadius.full}
                    />
                    <SkeletonLoader width={theme.size['120']} height={theme.size['5']} />
                  </View>
                  <SkeletonLoader
                    width={theme.size.lg}
                    height={theme.size.lg}
                    borderRadius={theme.borderRadius.full}
                  />
                </View>
              </View>
            ))}
          </>
        ) : (
          Object.keys(exercisesByGroup)
            .sort()
            .map((group) => {
              const config = MUSCLE_GROUP_CONFIG[group] || {
                name: group.charAt(0).toUpperCase() + group.slice(1),
                icon: Dumbbell,
              };
              const groupExercises = exercisesByGroup[group];

              return (
                <Accordion
                  key={group}
                  title={config.name}
                  count={groupExercises.length}
                  icon={config.icon}
                  isOpen={openAccordions[group] || false}
                  onToggle={() => toggleAccordion(group)}
                >
                  {groupExercises.length === 0 ? (
                    <View className="border-t border-border-dark px-4 py-2">
                      <Text className="text-sm" style={{ color: theme.colors.status.brandPale }}>
                        {t('exercises.emptyGroupMessage', {
                          muscleGroup: config.name.toLowerCase(),
                        })}
                      </Text>
                    </View>
                  ) : (
                    groupExercises.map((exercise) => (
                      <ExerciseListItem
                        key={exercise.id}
                        name={exercise.name}
                        type={exercise.type}
                        imageUrl={getExerciseImageUrl(exercise)}
                        onPress={() => handleExercisePress(exercise)}
                        getTypeTagLabel={getExerciseTypeTag}
                      />
                    ))
                  )}
                </Accordion>
              );
            })
        )}

        {hasMore && !isLoading ? (
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
      </KeyboardAwareScrollView>

      <ViewExerciseModal
        visible={viewExerciseId !== null}
        onClose={handleViewExerciseClose}
        exerciseId={viewExerciseId}
        onExerciseDeleted={handleExerciseDeletedOrUpdated}
        onExerciseUpdated={handleExerciseDeletedOrUpdated}
        onExerciseDuplicated={handleExerciseDeletedOrUpdated}
      />
    </FullScreenModal>
  );
}
