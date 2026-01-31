import { useState, useMemo, lazy } from 'react';

import { View, ScrollView, Pressable } from 'react-native';
import { Search, SlidersHorizontal, Dumbbell, WifiOff, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { theme } from '../../theme';
import { MasterLayout } from '../../components/MasterLayout';

import { FilterTabs } from '../../components/FilterTabs';
import { GradientText } from '../../components/GradientText';
import { WorkoutDetailsMenu } from '../../components/WorkoutDetailsMenu';

import { WorkoutService } from '../../database/services';
import { database } from '../../database';
import WorkoutTemplate from '../../database/models/WorkoutTemplate';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { CreateWorkoutOptionsModal } from '../../components/modals/CreateWorkoutOptionsModal';
import CreateWorkoutModal from '../../components/modals/CreateWorkoutModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
const EmptyStateCard = lazy(() =>
  import('../../components/theme/EmptyStateCard').then(({ EmptyStateCard }) => ({
    default: EmptyStateCard,
  }))
);
const DashedButton = lazy(() => import('../../components/theme/DashedButton'));
const SkeletonLoader = lazy(() =>
  import('../../components/theme/SkeletonLoader').then(({ SkeletonLoader }) => ({
    default: SkeletonLoader,
  }))
);
const ErrorStateCard = lazy(() =>
  import('../../components/theme/ErrorStateCard').then(({ ErrorStateCard }) => ({
    default: ErrorStateCard,
  }))
);
const WorkoutCard = lazy(() =>
  import('../../components/cards/WorkoutCard').then(({ WorkoutCard }) => ({ default: WorkoutCard }))
);

export default function WorkoutsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const FILTER_TABS = [
    { id: 'all', label: t('workouts.filters.all') },
    { id: 'strength', label: t('workouts.filters.strength') },
    { id: 'cardio', label: t('workouts.filters.cardio') },
    { id: 'flexibility', label: t('workouts.filters.flexibility') },
  ];
  const [activeFilter, setActiveFilter] = useState('all');
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [selectedWorkoutName, setSelectedWorkoutName] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [isCreateOptionsVisible, setIsCreateOptionsVisible] = useState(false);
  const [isCreateWorkoutModalVisible, setIsCreateWorkoutModalVisible] = useState(false);
  const [isWorkoutOverviewVisible, setIsWorkoutOverviewVisible] = useState(false);
  const [selectedWorkoutLogId, setSelectedWorkoutLogId] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>(undefined);

  // Use reactive hook for workout templates
  const { templates, isLoading, error } = useWorkoutTemplates();

  // Process templates to separate featured vs regular
  const { featuredWorkout, workouts } = useMemo(() => {
    if (templates.length === 0) {
      return { featuredWorkout: null, workouts: [] };
    }

    // First template is the featured workout (most recently completed, or most recently created)
    const featured = templates[0];
    const featuredWorkoutData = {
      id: featured.id,
      name: featured.name,
      lastCompleted: featured.lastCompleted,
      lastCompletedTimestamp: featured.lastCompletedTimestamp,
      exerciseCount: featured.exerciseCount,
      duration: featured.duration,
      image: featured.image,
    };

    // Rest are regular workouts
    const regularWorkouts = templates.slice(1).map((template) => ({
      id: template.id,
      name: template.name,
      lastCompleted: template.lastCompleted,
      lastCompletedTimestamp: template.lastCompletedTimestamp,
      exerciseCount: template.exerciseCount,
      duration: template.duration,
      image: template.image,
    }));

    return {
      featuredWorkout: featuredWorkoutData,
      workouts: regularWorkouts,
    };
  }, [templates]);

  // Filter workouts based on active filter
  const filteredWorkouts = workouts.filter((workout) => {
    if (activeFilter === 'all') return true;
    // Add filter logic based on workout type
    return true;
  });

  // Helper function to start a workout and show overview modal
  const handleStartWorkout = async (templateId: string) => {
    try {
      const workoutLog = await WorkoutService.startWorkoutFromTemplate(templateId);
      setSelectedWorkoutLogId(workoutLog.id);
      setIsWorkoutOverviewVisible(true);
    } catch (err) {
      console.error('Error starting workout:', err);
      // Show error to user (you might want to add an alert here)
    }
  };

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
                }}
              >
                {t('workouts.title')}
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
            {error ? (
              <ErrorStateCard
                icon={WifiOff}
                title={t('errors.connectionTimeout.title')}
                description={t('errors.connectionTimeout.description')}
                buttonLabel={t('errors.connectionTimeout.tryAgain')}
                onButtonPress={() => {
                  // Error will clear automatically when data updates
                  // No manual reload needed with reactive hooks
                }}
              />
            ) : null}

            {/* Loading State */}
            {isLoading && !error ? (
              <>
                {/* Featured Workout Skeleton */}
                <View
                  className="rounded-lg border bg-bg-card p-5"
                  style={{ borderColor: theme.colors.background.white5 }}
                >
                  <View className="mb-4 flex-row items-start justify-between">
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="40%" height={theme.size['5']} />
                      <SkeletonLoader width="60%" height={theme.size['6']} />
                      <SkeletonLoader width="50%" height={theme.size['4']} />
                    </View>
                    <SkeletonLoader
                      width={theme.size['16']}
                      height={theme.size['16']}
                      borderRadius={theme.borderRadius.md}
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <SkeletonLoader
                      width={theme.size['120']}
                      height={theme.size['44']}
                      borderRadius={theme.borderRadius.md}
                    />
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['44']}
                      borderRadius={theme.borderRadius.md}
                    />
                  </View>
                </View>

                {/* Workout Cards Skeletons */}
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="rounded-lg border bg-bg-card p-4"
                    style={{ borderColor: theme.colors.background.white5 }}
                  >
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader
                        width={theme.size['12']}
                        height={theme.size['12']}
                        borderRadius={theme.borderRadius.md}
                      />
                      <View className="flex-1 gap-2">
                        <SkeletonLoader width="75%" height={theme.size['4']} />
                        <SkeletonLoader width="50%" height={theme.size['3']} />
                      </View>
                    </View>
                    <View className="mt-4 flex-row gap-2">
                      <SkeletonLoader
                        width={theme.size['20']}
                        height={theme.size['8']}
                        borderRadius={theme.borderRadius.lg}
                      />
                      <SkeletonLoader
                        width={theme.size['20']}
                        height={theme.size['8']}
                        borderRadius={theme.borderRadius.lg}
                      />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
            {!isLoading && !error && !featuredWorkout && filteredWorkouts.length === 0 ? (
              <EmptyStateCard
                icon={Dumbbell}
                title={t('emptyStates.workouts.title')}
                description={t('emptyStates.workouts.description')}
                buttonLabel={t('emptyStates.workouts.buttonLabel')}
                iconGradient={true}
                buttonVariant="gradientCta"
                onButtonPress={() => {
                  setIsCreateOptionsVisible(true);
                }}
              />
            ) : null}

            {/* Normal State - Featured Workout */}
            {!isLoading && !error && featuredWorkout ? (
              <WorkoutCard
                name={featuredWorkout.name}
                lastCompleted={featuredWorkout.lastCompleted}
                lastCompletedTimestamp={featuredWorkout.lastCompletedTimestamp}
                exerciseCount={featuredWorkout.exerciseCount}
                duration={featuredWorkout.duration}
                image={featuredWorkout.image}
                onStart={async () => {
                  if (featuredWorkout.id) {
                    await handleStartWorkout(featuredWorkout.id);
                  }
                }}
                onMore={() => {
                  setSelectedWorkoutName(featuredWorkout.name);
                  setSelectedWorkoutId(featuredWorkout.id);
                  setIsMenuVisible(true);
                }}
              />
            ) : null}

            {/* Normal State - Regular Workouts */}
            {!isLoading && !error && filteredWorkouts.length > 0 ? (
              <>
                {filteredWorkouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    name={workout.name}
                    lastCompleted={workout.lastCompleted}
                    lastCompletedTimestamp={workout.lastCompletedTimestamp}
                    exerciseCount={workout.exerciseCount}
                    duration={workout.duration}
                    variant="standard"
                    image={workout.image}
                    onStart={async () => {
                      await handleStartWorkout(workout.id);
                    }}
                    onArchive={() => {
                      // TODO: Implement archive functionality
                      console.log('Archive workout:', workout.name);
                    }}
                    onMore={() => {
                      setSelectedWorkoutName(workout.name);
                      setSelectedWorkoutId(workout.id);
                      setIsMenuVisible(true);
                    }}
                  />
                ))}

                <DashedButton
                  label={t('workouts.createTemplate')}
                  onPress={() => {
                    setIsCreateWorkoutModalVisible(true);
                  }}
                  size="lg"
                  icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.primary} />}
                />
              </>
            ) : null}
          </View>
          <View className="h-32" />
        </ScrollView>
      </View>

      {/* Workout Details Menu */}
      <WorkoutDetailsMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        workoutName={selectedWorkoutName}
        onEdit={() => {
          if (selectedWorkoutId) {
            setEditingTemplateId(selectedWorkoutId);
            setIsCreateWorkoutModalVisible(true);
            setIsMenuVisible(false);
          } else {
            console.error('Cannot edit workout: No workout ID selected');
            setIsMenuVisible(false);
          }
        }}
        onDuplicate={() => {
          // TODO: Implement duplicate functionality
          console.log('Duplicate workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
        onShare={() => {
          // TODO: Implement share functionality
          console.log('Share workout:', selectedWorkoutName);
          setIsMenuVisible(false);
        }}
        onDelete={async () => {
          if (selectedWorkoutId) {
            try {
              const template = await database
                .get<WorkoutTemplate>('workout_templates')
                .find(selectedWorkoutId);
              await template.markAsDeleted();
            } catch (err) {
              console.error('Error deleting workout:', err);
            }
          }
          setIsMenuVisible(false);
        }}
      />
      <CreateWorkoutOptionsModal
        visible={isCreateOptionsVisible}
        onClose={() => setIsCreateOptionsVisible(false)}
        onGenerateWithAi={() => {
          setIsCreateOptionsVisible(false);
          setEditingTemplateId(undefined);
          setIsCreateWorkoutModalVisible(true);
        }}
        onCreateEmptyTemplate={() => {
          setIsCreateOptionsVisible(false);
          setEditingTemplateId(undefined);
          setIsCreateWorkoutModalVisible(true);
        }}
        onBrowseTemplates={() => {
          setIsCreateOptionsVisible(false);
          // Navigate to templates browser if exists
          router.push('/workout/templates');
        }}
      />
      <CreateWorkoutModal
        visible={isCreateWorkoutModalVisible}
        onClose={() => {
          setIsCreateWorkoutModalVisible(false);
          setEditingTemplateId(undefined);
        }}
        templateId={editingTemplateId}
      />
      {/* Workout Session Overview Modal */}
      <WorkoutSessionOverviewModal
        visible={isWorkoutOverviewVisible}
        onClose={() => setIsWorkoutOverviewVisible(false)}
        workoutLogId={selectedWorkoutLogId}
        onStartWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          router.push(`/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onResumeSession={() => {
          setIsWorkoutOverviewVisible(false);
          router.push(`/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onSelectExercise={(exerciseId) => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout session with selected exercise
          router.push(
            `/workout/workout-session?workoutLogId=${selectedWorkoutLogId}&exerciseId=${exerciseId}`
          );
        }}
        onCancelWorkout={async () => {
          setIsWorkoutOverviewVisible(false);
          // Cancel the workout and navigate back
          if (selectedWorkoutLogId) {
            try {
              // Clear active workout and delete the workout log
              await clearActiveWorkoutLogId();
              const log = await database.get('workout_logs').find(selectedWorkoutLogId);
              await log.markAsDeleted();
            } catch (err) {
              console.error('Error canceling workout:', err);
            }
          }
        }}
        onFinishWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout summary
          router.push(`/workout/workout-summary?workoutLogId=${selectedWorkoutLogId}`);
        }}
      />
    </MasterLayout>
  );
}
