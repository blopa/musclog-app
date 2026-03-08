import { Q } from '@nozbe/watermelondb';
import { Activity, ChevronRight, Dumbbell, Footprints, Search } from 'lucide-react-native';
import { ComponentType, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { database } from '../../database';
import Exercise from '../../database/models/Exercise';
import { useTheme } from '../../hooks/useTheme';
import { FALLBACK_EXERCISE_IMAGE } from '../../utils/exerciseImage';
import { Accordion } from '../theme/Accordion';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';
import ViewExerciseModal from './ViewExerciseModal';

// Type for exercise data used in the component
type ExerciseData = {
  id: string;
  name: string;
  type: string;
  muscleGroup: string;
  imageUrl?: string;
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
                    : theme.colors.status.customGreen,
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
};

export default function ExercisesModal({ visible, onClose }: ExercisesModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Load exercises from database
  useEffect(() => {
    loadExercises();
  }, []);

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

  // Filter exercises based on search
  const filteredExercisesByGroup = useMemo(() => {
    if (!searchQuery.trim()) {
      return exercisesByGroup;
    }

    const filtered: Record<string, ExerciseData[]> = {};
    Object.keys(exercisesByGroup).forEach((group) => {
      const filteredInGroup = exercisesByGroup[group].filter((exercise) =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filteredInGroup.length > 0) {
        filtered[group] = filteredInGroup;
      }
    });
    return filtered;
  }, [exercisesByGroup, searchQuery]);

  const toggleAccordion = (group: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const handleExercisePress = (exercise: ExerciseData) => {
    setViewExerciseId(exercise.id);
  };

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      const exercisesCollection = database.get<Exercise>('exercises');
      let fetchedExercises = await exercisesCollection
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('name', Q.asc))
        .fetch();
      if (fetchedExercises.length === 0) {
        const allExercises = await exercisesCollection.query().fetch();
        fetchedExercises = allExercises
          .filter((e) => !e.deletedAt)
          .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      }
      const exercisesData: ExerciseData[] = fetchedExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name ?? '',
        type: mapEquipmentTypeToType(exercise.equipmentType ?? ''),
        muscleGroup: exercise.muscleGroup ?? '',
        imageUrl: exercise.imageUrl || undefined,
      }));
      setExercises(exercisesData);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewExerciseClose = () => {
    setViewExerciseId(null);
  };

  const handleExerciseDeletedOrUpdated = () => {
    loadExercises();
  };

  const getExerciseImageUrl = (exercise: ExerciseData) => exercise.imageUrl ?? '';

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exercises.title')}
      scrollable={false}
    >
      <ScrollView className="flex-1 px-4 pb-32" showsVerticalScrollIndicator={false}>
        <View className="py-3">
          {/* Search Input (themed) */}
          <View className="py-3">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('exercises.searchPlaceholder')}
              icon={<Search size={theme.iconSize.md} color={theme.colors.status.customGreen} />}
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
          Object.keys(filteredExercisesByGroup)
            .sort()
            .map((group) => {
              const config = MUSCLE_GROUP_CONFIG[group] || {
                name: group.charAt(0).toUpperCase() + group.slice(1),
                icon: Dumbbell,
              };
              const groupExercises = filteredExercisesByGroup[group];

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
                      <Text className="text-sm" style={{ color: theme.colors.status.customGreen }}>
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
      </ScrollView>

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
