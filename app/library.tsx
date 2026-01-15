import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Q } from '@nozbe/watermelondb';
import {
  Search,
  SlidersHorizontal,
  Dumbbell,
  ChevronRight,
  Activity,
  Footprints,
} from 'lucide-react-native';
import { theme } from '../theme';
import { database } from '../database';
import Exercise from '../database/models/Exercise';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { Accordion } from '../components/theme/Accordion';
import { MasterLayout } from '../components/MasterLayout';

// Type for exercise data used in the component
type ExerciseData = {
  id: string;
  name: string;
  type: string;
  muscleGroup: string;
  imageUrl?: string;
};

// Map muscle groups to display names and icons
const MUSCLE_GROUP_CONFIG: Record<
  string,
  { name: string; icon: React.ComponentType<{ size: number; color: string }> }
> = {
  chest: { name: 'Chest', icon: Activity },
  back: { name: 'Back', icon: Dumbbell },
  legs: { name: 'Legs', icon: Footprints },
  shoulders: { name: 'Shoulders', icon: Activity },
  arms: { name: 'Arms', icon: Dumbbell },
  core: { name: 'Core', icon: Activity },
  abdomen: { name: 'Abdomen', icon: Activity },
  glutes: { name: 'Glutes', icon: Footprints },
  full_body: { name: 'Full Body', icon: Activity },
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

// Map exercise types to tag display
const getExerciseTypeTag = (type: string) => {
  switch (type) {
    case 'bodyweight':
      return { label: 'BODYWEIGHT', variant: 'primary' as const };
    case 'machine':
    case 'equipment':
      return { label: 'EQUIPMENT', variant: 'secondary' as const };
    default:
      return { label: 'EQUIPMENT', variant: 'secondary' as const };
  }
};

// Exercise list item component
function ExerciseListItem({
  name,
  type,
  imageUrl,
  onPress,
}: {
  name: string;
  type: string;
  imageUrl?: string;
  onPress: () => void;
}) {
  const tag = getExerciseTypeTag(type);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 px-4 py-3 active:bg-bg-overlay">
      <View className="h-14 w-14 rounded-lg bg-bg-card" style={{ backgroundColor: '#254637' }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="h-full w-full rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Dumbbell size={24} color={theme.colors.text.tertiary} />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary">{name}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <View
            className={`rounded-full px-2 py-0.5 ${
              tag.variant === 'primary'
                ? 'border border-accent-primary/30 bg-accent-primary/20'
                : 'border border-border-dark bg-bg-card'
            }`}>
            <Text
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: tag.variant === 'primary' ? theme.colors.accent.primary : '#95c6b0',
              }}>
              {tag.label}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

export default function LibraryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    chest: true, // Chest starts open
  });

  // Load exercises from database
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setIsLoading(true);
        const exercisesCollection = database.get<Exercise>('exercises');

        // Try query with deleted_at filter first
        let fetchedExercises = await exercisesCollection
          .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('name', Q.asc))
          .fetch();

        // Fallback: if filtered query returns 0, fetch all and filter manually
        // This handles cases where deletedAt might be undefined instead of null
        if (fetchedExercises.length === 0) {
          const allExercises = await exercisesCollection.query().fetch();
          fetchedExercises = allExercises
            .filter((e) => !e.deletedAt)
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        const exercisesData: ExerciseData[] = fetchedExercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          type: mapEquipmentTypeToType(exercise.equipmentType),
          muscleGroup: exercise.muscleGroup,
          imageUrl: exercise.imageUrl || undefined,
        }));

        setExercises(exercisesData);
      } catch (error) {
        console.error('Error loading exercises:', error);
      } finally {
        setIsLoading(false);
      }
    };

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
    // Navigate to exercise details
    console.log('Exercise pressed:', exercise.name);
  };

  // Get image URL from exercise data or fallback to placeholder
  const getExerciseImageUrl = (exercise: ExerciseData) => {
    // Use imageUrl from database if available
    if (exercise.imageUrl) {
      return exercise.imageUrl;
    }
    // Fallback to placeholder URLs for specific exercises
    const exerciseName = exercise.name.toLowerCase();
    if (exerciseName.includes('bench press')) {
      return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXz6nQajFL_tgGhEPXNVZVozEK5Ya4QQjQF2hmg0PH89Caymd0AePmxB8mLOYSYA7aT8tpNZbG3RhTMAWgRkeiOGdUYTbNbpfyQ6W9Kn5OXb_3p9yk4E_WoPY0gqH_57q1Z3YTc2Y_c66b1NHz4V_nseICUczBPu4NcXLPtwGIIzBSCV33XGjJNjIGOFYwp_84pHRFttrWaCJHGSIgObG3BMIEnZuD90u-5tItaAJMbRbOmCS1FcQEDAMEytVYwcbgqcnBWXiavla3';
    }
    if (exerciseName.includes('push')) {
      return 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqglhotlxCz_3guMeb-eE_A3oPVe5qXr479Ac_wnvSNKpPehqecvrGSqQFYsJVb8QmCB8kCjG0jHedr0J8ugplzlG3zSqSNTQoLA_7M30NHWjr2-hTWGGTtxrOy13SQ7MFY-X2A9EnIEYhKp-j77bL2UvjVuDHNLSucSz18V0GnX9UYQbRkQHRT6fwKWNGmrqKoMDlbWb5Gb1djQYoqCYZH0KXkOmp8VF8hl6doVx_uTgO9H3Ae5lE0QhD7O71M5tv8wgej1fMSz9f';
    }
    return undefined;
  };

  return (
    <MasterLayout>
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
        <ScrollView className="flex-1 px-4 pb-32" showsVerticalScrollIndicator={false}>
          <View className="px-4 py-3">
            <View className="flex-row items-stretch overflow-hidden rounded-lg bg-bg-card">
              <View className="items-center justify-center border-none bg-bg-card pl-4">
                <Search size={theme.iconSize.md} color="#95c6b0" />
              </View>
              <TextInput
                className="flex-1 border-none bg-bg-card px-3 py-3 text-base font-normal text-text-primary"
                placeholder="Search exercises..."
                placeholderTextColor="#95c6b0"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {isLoading ? (
            // Loading skeleton
            <>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  className="mb-4 overflow-hidden rounded-lg border border-border-dark bg-bg-card">
                  <View className="flex-row items-center justify-between px-4 py-4">
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader width={18} height={18} borderRadius={999} />
                      <SkeletonLoader width={120} height={20} />
                    </View>
                    <SkeletonLoader width={18} height={18} borderRadius={999} />
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
                    onToggle={() => toggleAccordion(group)}>
                    {groupExercises.length === 0 ? (
                      <View className="border-t border-border-dark px-4 py-2">
                        <Text className="text-sm" style={{ color: '#95c6b0' }}>
                          Tap to view {config.name.toLowerCase()} exercises.
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
                        />
                      ))
                    )}
                  </Accordion>
                );
              })
          )}
        </ScrollView>
      </SafeAreaView>
    </MasterLayout>
  );
}
