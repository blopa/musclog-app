import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import {
  Search,
  SlidersHorizontal,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  Plus,
  Home,
  History,
  User,
  PlusSquare,
  Activity,
  Footprints,
  ClipboardList,
} from 'lucide-react-native';
import { theme } from '../theme';
import exercisesData from '../data/exercisesEnUS.json'; // TODO: get from database instead

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

// Accordion component
function Accordion({
  title,
  count,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ size: number; color: string }>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const rotation = useSharedValue(isOpen ? 180 : 0);
  const opacity = useSharedValue(isOpen ? 1 : 0);
  const maxHeight = useSharedValue(isOpen ? 2000 : 0); // Large enough max height

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
    maxHeight.value = withTiming(isOpen ? 2000 : 0, { duration: 300 });
  }, [isOpen, rotation, opacity, maxHeight]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    maxHeight: maxHeight.value,
    opacity: opacity.value,
    overflow: 'hidden',
  }));

  const handlePress = () => {
    onToggle();
  };

  return (
    <View className="mb-4 overflow-hidden rounded-lg border border-border-dark bg-bg-card">
      <Pressable onPress={handlePress} className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center gap-3">
          <Icon size={theme.iconSize.md} color={theme.colors.accent.primary} />
          <Text className="text-base font-semibold text-text-primary">
            {title}{' '}
            <Text className="text-sm font-normal" style={{ color: '#95c6b0' }}>
              ({count})
            </Text>
          </Text>
        </View>
        <Animated.View style={animatedChevronStyle}>
          <ChevronDown size={theme.iconSize.md} color={theme.colors.text.tertiary} />
        </Animated.View>
      </Pressable>
      <Animated.View style={animatedContentStyle} pointerEvents={isOpen ? 'auto' : 'none'}>
        <View className="border-t border-border-dark">{children}</View>
      </Animated.View>
    </View>
  );
}

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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    chest: true, // Chest starts open
  });

  // Group exercises by muscle group
  const exercisesByGroup = useMemo(() => {
    const grouped: Record<string, typeof exercisesData> = {};
    exercisesData.forEach((exercise) => {
      const group = exercise.muscleGroup;
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(exercise);
    });
    return grouped;
  }, []);

  // Filter exercises based on search
  const filteredExercisesByGroup = useMemo(() => {
    if (!searchQuery.trim()) {
      return exercisesByGroup;
    }

    const filtered: Record<string, typeof exercisesData> = {};
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

  const handleExercisePress = (exercise: (typeof exercisesData)[0]) => {
    // Navigate to exercise details
    console.log('Exercise pressed:', exercise.name);
  };

  // Default image URLs (using placeholder images from the HTML)
  const getExerciseImageUrl = (exerciseName: string) => {
    // You can implement a mapping here or use a service
    // For now, returning placeholder URLs
    if (exerciseName.toLowerCase().includes('bench press')) {
      return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXz6nQajFL_tgGhEPXNVZVozEK5Ya4QQjQF2hmg0PH89Caymd0AePmxB8mLOYSYA7aT8tpNZbG3RhTMAWgRkeiOGdUYTbNbpfyQ6W9Kn5OXb_3p9yk4E_WoPY0gqH_57q1Z3YTc2Y_c66b1NHz4V_nseICUczBPu4NcXLPtwGIIzBSCV33XGjJNjIGOFYwp_84pHRFttrWaCJHGSIgObG3BMIEnZuD90u-5tItaAJMbRbOmCS1FcQEDAMEytVYwcbgqcnBWXiavla3';
    }
    if (exerciseName.toLowerCase().includes('push')) {
      return 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqglhotlxCz_3guMeb-eE_A3oPVe5qXr479Ac_wnvSNKpPehqecvrGSqQFYsJVb8QmCB8kCjG0jHedr0J8ugplzlG3zSqSNTQoLA_7M30NHWjr2-hTWGGTtxrOy13SQ7MFY-X2A9EnIEYhKp-j77bL2UvjVuDHNLSucSz18V0GnX9UYQbRkQHRT6fwKWNGmrqKoMDlbWb5Gb1djQYoqCYZH0KXkOmp8VF8hl6doVx_uTgO9H3Ae5lE0QhD7O71M5tv8wgej1fMSz9f';
    }
    return undefined;
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <View className="flex-1">
        {/* Top App Bar with blur effect */}
        <View className="border-b border-border-dark">
          <BlurView intensity={80} className="bg-bg-primary/80">
            <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
              <View className="h-12 w-12 shrink-0 items-center justify-center">
                <Dumbbell size={24} color={theme.colors.accent.primary} />
              </View>
              <Text className="flex-1 text-center text-xl font-bold tracking-tight text-text-primary">
                Library
              </Text>
              <Pressable className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-card">
                <SlidersHorizontal size={theme.iconSize.md} color={theme.colors.text.primary} />
              </Pressable>
            </View>

            {/* Search Bar */}
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
          </BlurView>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1 px-4 pb-32" showsVerticalScrollIndicator={false}>
          {Object.keys(filteredExercisesByGroup)
            .sort()
            .map((group) => {
              const config = MUSCLE_GROUP_CONFIG[group] || {
                name: group.charAt(0).toUpperCase() + group.slice(1),
                icon: Dumbbell,
              };
              const exercises = filteredExercisesByGroup[group];

              return (
                <Accordion
                  key={group}
                  title={config.name}
                  count={exercises.length}
                  icon={config.icon}
                  isOpen={openAccordions[group] || false}
                  onToggle={() => toggleAccordion(group)}>
                  {exercises.length === 0 ? (
                    <View className="border-t border-border-dark px-4 py-2">
                      <Text className="text-sm" style={{ color: '#95c6b0' }}>
                        Tap to view {config.name.toLowerCase()} exercises.
                      </Text>
                    </View>
                  ) : (
                    exercises.map((exercise, index) => (
                      <ExerciseListItem
                        key={index}
                        name={exercise.name}
                        type={exercise.type}
                        imageUrl={getExerciseImageUrl(exercise.name)}
                        onPress={() => handleExercisePress(exercise)}
                      />
                    ))
                  )}
                </Accordion>
              );
            })}
        </ScrollView>

        {/* Floating Action Button */}
        <Pressable
          className="absolute bottom-24 right-6 z-30 h-14 w-14 items-center justify-center rounded-full active:scale-95"
          onPress={() => {
            // Handle FAB press - e.g., add new exercise
            console.log('FAB pressed');
          }}
          style={[
            theme.shadows.lg,
            {
              shadowColor: theme.colors.accent.primary,
              shadowOpacity: 0.3,
            },
          ]}>
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 9999,
            }}
          />
          <Plus size={28} color={theme.colors.text.primary} />
        </Pressable>

        {/* Bottom Navigation Bar */}
        <View className="absolute bottom-0 left-0 right-0 z-40 border-t border-white/10 pb-8 pt-3">
          <BlurView intensity={80} className="bg-bg-primary/90">
            <SafeAreaView edges={['bottom']}>
              <View className="flex-row items-center justify-around px-6">
                {/* Home */}
                <Pressable className="items-center gap-1" onPress={() => router.push('/')}>
                  <Home size={theme.iconSize.md} color={theme.colors.text.tertiary} />
                  <Text className="text-[10px] font-medium text-text-tertiary">Home</Text>
                </Pressable>

                {/* Library */}
                <Pressable className="items-center gap-1">
                  <View className="h-10 w-16 items-center justify-center rounded-lg bg-bg-navActive">
                    <ClipboardList
                      size={theme.iconSize.md}
                      color={theme.colors.accent.primary}
                      strokeWidth={2.5}
                    />
                  </View>
                  <Text
                    className="text-[10px] font-medium"
                    style={{ color: theme.colors.accent.primary }}>
                    Library
                  </Text>
                </Pressable>

                {/* Log */}
                <Pressable className="items-center gap-1">
                  <View className="-mt-8">
                    <View
                      className="rounded-full border-4"
                      style={{
                        borderColor: theme.colors.background.primary,
                      }}>
                      <LinearGradient
                        colors={theme.colors.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          borderRadius: 9999,
                          padding: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <PlusSquare size={20} color={theme.colors.text.primary} />
                      </LinearGradient>
                    </View>
                  </View>
                  <Text className="mt-[-4px] text-[10px] font-medium text-text-tertiary">Log</Text>
                </Pressable>

                {/* History */}
                <Pressable
                  className="items-center gap-1"
                  onPress={() => {
                    // Navigate to history screen when implemented
                    console.log('Navigate to history');
                  }}>
                  <History size={theme.iconSize.md} color={theme.colors.text.tertiary} />
                  <Text className="text-[10px] font-medium text-text-tertiary">History</Text>
                </Pressable>

                {/* Profile */}
                <Pressable className="items-center gap-1" onPress={() => router.push('/profile')}>
                  <User size={theme.iconSize.md} color={theme.colors.text.tertiary} />
                  <Text className="text-[10px] font-medium text-text-tertiary">Profile</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </BlurView>
        </View>
      </View>
    </SafeAreaView>
  );
}
