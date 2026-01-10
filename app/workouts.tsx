import { useState, useEffect } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Search, SlidersHorizontal, Dumbbell, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { WorkoutCard } from '../components/WorkoutCard';
import { FilterTabs } from '../components/FilterTabs';
import { CreateTemplateButton } from '../components/CreateTemplateButton';
import { GradientText } from '../components/GradientText';
import { WorkoutDetailsMenu } from '../components/WorkoutDetailsMenu';
import { EmptyStateCard } from '../components/theme/EmptyStateCard';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { ErrorStateCard } from '../components/theme/ErrorStateCard';

const WORKOUTS_DATA = {
  featured: {
    name: 'Push Day A',
    lastCompleted: '2 Days Ago',
    exerciseCount: 5,
    duration: '45 mins',
    image: require('../assets/icon.png'),
  },
  workouts: [
    {
      id: '1',
      name: 'Leg Hypertrophy',
      lastCompleted: '5 days ago',
      exerciseCount: 7,
      duration: '60 mins',
      image: require('../assets/icon.png'),
    },
    {
      id: '2',
      name: 'Full Body Cardio',
      lastCompleted: 'Yesterday',
      exerciseCount: 3,
      duration: '30 mins',
      image: require('../assets/icon.png'),
    },
    {
      id: '3',
      name: 'Pull Day B',
      lastCompleted: '2 weeks ago',
      exerciseCount: 6,
      duration: '50 mins',
      image: require('../assets/icon.png'),
    },
  ],
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'flexibility', label: 'Flexibility' },
];

export default function WorkoutsScreen() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedWorkoutName, setSelectedWorkoutName] = useState<string>('');

  // State management for workouts data
  const [workouts, setWorkouts] = useState(WORKOUTS_DATA.workouts);
  const [featuredWorkout, setFeaturedWorkout] = useState(WORKOUTS_DATA.featured);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate loading workouts - replace with actual API call
  const loadWorkouts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In real app, replace with: const data = await fetchWorkouts();
      setWorkouts(WORKOUTS_DATA.workouts);
      setFeaturedWorkout(WORKOUTS_DATA.featured);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workouts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Uncomment to simulate initial load
    // loadWorkouts();
  }, []);

  // Filter workouts based on active filter
  const filteredWorkouts = workouts.filter((workout) => {
    if (activeFilter === 'all') return true;
    // Add filter logic based on workout type
    return true;
  });

  return (
    <MasterLayout>
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 py-6">
            <View className="flex-row items-center justify-between">
              <GradientText
                colors={theme.colors.gradients.workoutsTitle}
                style={{
                  fontSize: theme.typography.fontSize['4xl'],
                  fontWeight: theme.typography.fontWeight.bold,
                }}>
                My Workouts
              </GradientText>
              <View className="ml-4 flex-row gap-4">
                <Pressable className="rounded-lg p-2">
                  <Search size={theme.iconSize.md} color={theme.colors.text.primary} />
                </Pressable>
                <Pressable className="rounded-lg p-2">
                  <SlidersHorizontal size={theme.iconSize.md} color={theme.colors.text.primary} />
                </Pressable>
              </View>
            </View>
            {/* Add spacing below header */}
            <View style={{ height: theme.spacing.gap.lg }} />
            {/* Filter Tabs */}
            <FilterTabs tabs={FILTER_TABS} activeTab={activeFilter} onTabChange={setActiveFilter} />
          </View>

          {/* Workouts List */}
          <View className="mx-6 mb-8 gap-4">
            {/* Error State */}
            {error && (
              <ErrorStateCard
                icon={WifiOff}
                title={t('errors.connectionTimeout.title')}
                description={t('errors.connectionTimeout.description')}
                buttonLabel={t('errors.connectionTimeout.tryAgain')}
                onButtonPress={loadWorkouts}
              />
            )}

            {/* Loading State */}
            {isLoading && !error && (
              <>
                {/* Featured Workout Skeleton */}
                <View className="rounded-lg border border-white/5 bg-bg-card p-5">
                  <View className="mb-4 flex-row items-start justify-between">
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="40%" height={20} />
                      <SkeletonLoader width="60%" height={24} />
                      <SkeletonLoader width="50%" height={16} />
                    </View>
                    <SkeletonLoader width={64} height={64} borderRadius={12} />
                  </View>
                  <View className="flex-row gap-3">
                    <SkeletonLoader width={120} height={44} borderRadius={12} />
                    <SkeletonLoader width={48} height={44} borderRadius={12} />
                  </View>
                </View>

                {/* Workout Cards Skeletons */}
                {[1, 2, 3].map((i) => (
                  <View key={i} className="rounded-lg border border-white/5 bg-bg-card p-4">
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader width={48} height={48} borderRadius={12} />
                      <View className="flex-1 gap-2">
                        <SkeletonLoader width="75%" height={16} />
                        <SkeletonLoader width="50%" height={12} />
                      </View>
                    </View>
                    <View className="mt-4 flex-row gap-2">
                      <SkeletonLoader width={80} height={32} borderRadius={16} />
                      <SkeletonLoader width={80} height={32} borderRadius={16} />
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredWorkouts.length === 0 && (
              <EmptyStateCard
                icon={Dumbbell}
                title={t('emptyStates.workouts.title')}
                description={t('emptyStates.workouts.description')}
                buttonLabel={t('emptyStates.workouts.buttonLabel')}
                iconGradient={true}
                buttonVariant="gradientCta"
                onButtonPress={() => {
                  // Navigate to create workout or open create template
                  console.log('Create workout pressed');
                }}
              />
            )}

            {/* Normal State - Featured Workout */}
            {!isLoading && !error && featuredWorkout && filteredWorkouts.length > 0 && (
              <WorkoutCard
                name={featuredWorkout.name}
                lastCompleted={featuredWorkout.lastCompleted}
                exerciseCount={featuredWorkout.exerciseCount}
                duration={featuredWorkout.duration}
                image={featuredWorkout.image}
                onMore={() => {
                  setSelectedWorkoutName(featuredWorkout.name);
                  setIsMenuVisible(true);
                }}
              />
            )}

            {/* Normal State - Regular Workouts */}
            {!isLoading && !error && filteredWorkouts.length > 0 && (
              <>
                {filteredWorkouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    name={workout.name}
                    lastCompleted={workout.lastCompleted}
                    exerciseCount={workout.exerciseCount}
                    duration={workout.duration}
                    variant="standard"
                    image={workout.image}
                    onStart={() => {
                      console.log('Start workout:', workout.name);
                    }}
                    onArchive={() => {
                      console.log('Archive workout:', workout.name);
                    }}
                    onMore={() => {
                      setSelectedWorkoutName(workout.name);
                      setIsMenuVisible(true);
                    }}
                  />
                ))}

                {/* Create Template Button */}
                <CreateTemplateButton />
              </>
            )}
          </View>

          {/* Bottom spacing for navigation and FAB */}
          <View className="h-32" />
        </ScrollView>
      </View>

      {/* Workout Details Menu */}
      <WorkoutDetailsMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        workoutName={selectedWorkoutName}
        onEdit={() => {
          console.log('Edit workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
        onDuplicate={() => {
          console.log('Duplicate workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
        onShare={() => {
          console.log('Share workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
        onDelete={() => {
          console.log('Delete workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
      />
    </MasterLayout>
  );
}
