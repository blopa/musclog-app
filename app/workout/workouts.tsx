import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dumbbell, Plus, Search, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { WorkoutCard } from '../../components/cards/WorkoutCard';
import { FilterTabs } from '../../components/FilterTabs';
import { GradientText } from '../../components/GradientText';
import { MasterLayout } from '../../components/MasterLayout';
import {
  BrowseTemplatesModal,
  getRawTemplateById,
} from '../../components/modals/BrowseTemplatesModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import CreateWorkoutModal from '../../components/modals/CreateWorkoutModal';
import { CreateWorkoutOptionsModal } from '../../components/modals/CreateWorkoutOptionsModal';
import { GenerateWorkoutWithAiModal } from '../../components/modals/GenerateWorkoutWithAiModal';
import { WorkoutSessionHistoryModal } from '../../components/modals/WorkoutSessionHistoryModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import { AnimatedContent } from '../../components/theme/AnimatedContent';
import DashedButton from '../../components/theme/DashedButton';
import { EmptyStateCard } from '../../components/theme/EmptyStateCard';
import { ErrorStateCard } from '../../components/theme/ErrorStateCard';
import { SkeletonLoader } from '../../components/theme/SkeletonLoader';
import { TextInput } from '../../components/theme/TextInput';
import { WorkoutDetailsMenu } from '../../components/WorkoutDetailsMenu';
import { useSnackbar } from '../../context/SnackbarContext';
import { database, WorkoutTemplate } from '../../database';
import { WorkoutService, WorkoutTemplateService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { useWorkoutTemplateDetails } from '../../hooks/useWorkoutTemplateDetails';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
import { clearActiveWorkoutLogId } from '../../utils/activeWorkoutStorage';
import { flushLoadingPaint } from '../../utils/flushLoadingPaint';
import { captureException } from '../../utils/sentry';

export default function WorkoutsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ previewTemplateId?: string }>();
  const { isAiConfigured } = useSettings();

  // Open template preview when navigating from ViewExerciseModal (e.g. "Workouts using this")
  useEffect(() => {
    const id = params.previewTemplateId;
    if (id?.trim()) {
      setPreviewTemplateId(id.trim());
    }
  }, [params.previewTemplateId]);

  const FILTER_TABS = [
    { id: 'all', label: t('workouts.filters.all') },
    { id: 'strength', label: t('workouts.filters.strength') },
    { id: 'cardio', label: t('workouts.filters.cardio') },
    { id: 'flexibility', label: t('workouts.filters.flexibility') },
    { id: 'archived', label: t('workouts.filters.archived') },
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
  const [isBrowseTemplatesVisible, setIsBrowseTemplatesVisible] = useState(false);
  const [isGenerateWithAiModalVisible, setIsGenerateWithAiModalVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDeletingWorkoutTemplate, setIsDeletingWorkoutTemplate] = useState(false);
  const [isCreateFromTemplateConfirmationVisible, setIsCreateFromTemplateConfirmationVisible] =
    useState(false);
  const [isCreatingWorkoutsFromTemplate, setIsCreatingWorkoutsFromTemplate] = useState(false);
  const [selectedRawTemplate, setSelectedRawTemplate] = useState<{
    templateId: string;
    title: string;
  } | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const isPreviewModalVisible = previewTemplateId !== null;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const { showSnackbar } = useSnackbar();

  const handleConfirmDeleteWorkout = useCallback(async () => {
    if (!selectedWorkoutId) {
      return;
    }

    setIsDeletingWorkoutTemplate(true);
    await flushLoadingPaint();
    try {
      const template = await database
        .get<WorkoutTemplate>('workout_templates')
        .find(selectedWorkoutId);
      await template.markAsDeleted();
      showSnackbar('success', t('workouts.deleteSuccess'));
    } catch (err) {
      console.error('Error deleting workout:', err);
      showSnackbar('error', t('workouts.deleteError'));
    } finally {
      setIsDeletingWorkoutTemplate(false);
    }
  }, [selectedWorkoutId, showSnackbar, t]);

  // Reactively fetch template details when previewTemplateId is set
  const {
    template: previewTemplate,
    templateSets: previewTemplateSets,
    exercises: previewExercises,
    isLoading: isLoadingPreview,
  } = useWorkoutTemplateDetails(previewTemplateId);

  // Use reactive hook for workout templates with scope based on active filter
  const { templates, isLoading, error } = useWorkoutTemplates({
    scope: activeFilter === 'archived' ? 'archived' : 'active',
  });

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
      description: featured.description,
      type: featured.type,
      lastCompleted: featured.lastCompleted,
      lastCompletedTimestamp: featured.lastCompletedTimestamp,
      exerciseCount: featured.exerciseCount,
      duration: featured.duration,
      icon: featured.icon,
    };

    // Rest are regular workouts
    const regularWorkouts = templates.slice(1).map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      lastCompleted: template.lastCompleted,
      lastCompletedTimestamp: template.lastCompletedTimestamp,
      exerciseCount: template.exerciseCount,
      duration: template.duration,
      icon: template.icon,
    }));

    return {
      featuredWorkout: featuredWorkoutData,
      workouts: regularWorkouts,
    };
  }, [templates]);

  // Filter workouts based on search query and active filter
  const filteredWorkouts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return workouts.filter((workout) => {
      // Apply search filter
      if (normalizedQuery) {
        const matchesName = workout.name.toLowerCase().includes(normalizedQuery);
        const matchesDescription = workout.description?.toLowerCase().includes(normalizedQuery);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      // Apply type filter (strength/cardio/flexibility)
      if (activeFilter === 'all' || activeFilter === 'archived') {
        return true;
      }

      if (
        activeFilter === 'strength' ||
        activeFilter === 'cardio' ||
        activeFilter === 'flexibility'
      ) {
        return workout.type === activeFilter;
      }

      return true;
    });
  }, [workouts, searchQuery, activeFilter]);

  // Filter featured workout based on search query and type
  const filteredFeaturedWorkout = useMemo(() => {
    if (!featuredWorkout) {
      return null;
    }

    if (
      activeFilter === 'strength' ||
      activeFilter === 'cardio' ||
      activeFilter === 'flexibility'
    ) {
      if (featuredWorkout.type !== activeFilter) {
        return null;
      }
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      const matchesName = featuredWorkout.name.toLowerCase().includes(normalizedQuery);
      const matchesDescription = featuredWorkout.description
        ?.toLowerCase()
        .includes(normalizedQuery);
      if (!matchesName && !matchesDescription) {
        return null;
      }
    }

    return featuredWorkout;
  }, [featuredWorkout, searchQuery, activeFilter]);

  // Helper function to start a workout and show overview modal
  const handleStartWorkout = useCallback(
    async (templateId: string) => {
      try {
        const workoutLog = await WorkoutService.startWorkoutFromTemplate(templateId);
        setSelectedWorkoutLogId(workoutLog.id);
        setIsWorkoutOverviewVisible(true);
      } catch (err) {
        console.error('Error starting workout:', err);
        captureException(err, { data: { context: 'workouts.handleStartWorkout' } });
        showSnackbar('error', t('errors.somethingWentWrong'));
      }
    },
    [showSnackbar, t]
  );

  // Helper function to open preview modal (now synchronous!)
  const handlePreviewWorkout = useCallback(
    (templateId: string) => {
      // Verify template exists in already loaded templates
      const templateMetadata = templates.find((t) => t.id === templateId);
      if (!templateMetadata) {
        showSnackbar('error', t('common.error'));
        return;
      }

      setIsMenuVisible(false);
      setPreviewTemplateId(templateId);
    },
    [templates, showSnackbar, t]
  );

  // Helper function to start workout from preview
  const handleStartWorkoutFromPreview = useCallback(async () => {
    if (!previewTemplateId) {
      return;
    }

    setPreviewTemplateId(null);
    try {
      await handleStartWorkout(previewTemplateId);
    } catch (err) {
      console.error('Error starting workout from preview:', err);
      showSnackbar('error', t('common.error'));
    }
  }, [previewTemplateId, handleStartWorkout, showSnackbar, t]);

  return (
    <MasterLayout>
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-4 py-6">
            <View className="flex-row items-center justify-between">
              {!isSearchActive ? (
                <GradientText
                  colors={theme.colors.gradients.workoutsTitle}
                  style={{
                    fontSize: theme.typography.fontSize['4xl'],
                    fontWeight: theme.typography.fontWeight.bold,
                  }}
                >
                  {t('workouts.title')}
                </GradientText>
              ) : (
                <View className="mr-4 flex-1">
                  <TextInput
                    label=""
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('workouts.searchPlaceholder')}
                    icon={
                      searchQuery ? (
                        <Pressable
                          onPress={() => {
                            setSearchQuery('');
                          }}
                        >
                          <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                        </Pressable>
                      ) : (
                        <Search size={theme.iconSize.md} color={theme.colors.text.secondary} />
                      )
                    }
                    onFocus={() => setIsSearchActive(true)}
                  />
                </View>
              )}
              <View className="ml-4 flex-row gap-4">
                {isSearchActive ? (
                  <Pressable
                    className="rounded-lg p-2"
                    onPress={() => {
                      setIsSearchActive(false);
                      setSearchQuery('');
                    }}
                  >
                    <X size={theme.iconSize.md} color={theme.colors.text.primary} />
                  </Pressable>
                ) : (
                  <Pressable
                    className="rounded-lg p-2"
                    onPress={() => {
                      setIsSearchActive(true);
                    }}
                  >
                    <Search size={theme.iconSize.md} color={theme.colors.text.primary} />
                  </Pressable>
                )}
              </View>
            </View>
            {/* Add spacing below header */}
            <View style={{ height: theme.spacing.gap.lg }} />
            {/* Filter Tabs */}
            <FilterTabs tabs={FILTER_TABS} activeTab={activeFilter} onTabChange={setActiveFilter} />
          </View>

          {/* Workouts List */}
          <View className="mx-4 mb-8 gap-4">
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
            {!isLoading &&
            !error &&
            !filteredFeaturedWorkout &&
            filteredWorkouts.length === 0 &&
            !searchQuery ? (
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
            {!isLoading &&
            !error &&
            searchQuery &&
            filteredFeaturedWorkout === null &&
            filteredWorkouts.length === 0 ? (
              <EmptyStateCard
                icon={Search}
                title={t('workouts.noSearchResults')}
                description={t('workouts.noSearchResultsDescription', { query: searchQuery })}
                iconGradient={false}
                buttonLabel={t('workouts.noSearchResultsButtonLabel')}
                onButtonPress={() => setSearchQuery('')}
              />
            ) : null}

            {/* Normal State - Featured Workout */}
            {!isLoading && !error && filteredFeaturedWorkout ? (
              <AnimatedContent>
                <WorkoutCard
                  name={filteredFeaturedWorkout.name}
                  lastCompleted={filteredFeaturedWorkout.lastCompleted}
                  lastCompletedTimestamp={filteredFeaturedWorkout.lastCompletedTimestamp}
                  exerciseCount={filteredFeaturedWorkout.exerciseCount}
                  duration={filteredFeaturedWorkout.duration}
                  icon={filteredFeaturedWorkout.icon}
                  onStart={async () => {
                    if (filteredFeaturedWorkout.id) {
                      await handleStartWorkout(filteredFeaturedWorkout.id);
                    }
                  }}
                  onMore={() => {
                    setSelectedWorkoutName(filteredFeaturedWorkout.name);
                    setSelectedWorkoutId(filteredFeaturedWorkout.id);
                    setIsMenuVisible(true);
                  }}
                />
              </AnimatedContent>
            ) : null}

            {/* Normal State - Regular Workouts */}
            {!isLoading && !error && filteredWorkouts.length > 0 ? (
              <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
                <>
                  {filteredWorkouts.map((workout) => (
                    <WorkoutCard
                      key={workout.id}
                      name={workout.name}
                      lastCompleted={workout.lastCompleted}
                      lastCompletedTimestamp={workout.lastCompletedTimestamp}
                      exerciseCount={workout.exerciseCount}
                      duration={workout.duration}
                      icon={workout.icon}
                      variant="standard"
                      onStart={async () => {
                        await handleStartWorkout(workout.id);
                      }}
                      onArchive={async () => {
                        try {
                          await WorkoutTemplateService.archiveTemplate(workout.id);
                          showSnackbar('success', t('workouts.archiveSuccess'));
                        } catch (err) {
                          console.error('Error archiving workout:', err);
                          showSnackbar('error', t('workouts.archiveError'));
                        }
                      }}
                      onMore={() => {
                        setSelectedWorkoutName(workout.name);
                        setSelectedWorkoutId(workout.id);
                        setIsMenuVisible(true);
                      }}
                    />
                  ))}
                </>
              </AnimatedContent>
            ) : null}

            {/* Create Template Button - Only show when there are workouts */}
            {!isLoading && !error && (filteredFeaturedWorkout || filteredWorkouts.length > 0) ? (
              <DashedButton
                label={t('workouts.createTemplate.title')}
                onPress={() => {
                  setIsCreateOptionsVisible(true);
                }}
                size="lg"
                icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.primary} />}
              />
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
        onDuplicate={async () => {
          if (!selectedWorkoutId) {
            console.error('Cannot duplicate workout: No workout ID selected');
            setIsMenuVisible(false);
            return;
          }

          try {
            const newTemplate = await WorkoutTemplateService.duplicateTemplate(selectedWorkoutId);
            setEditingTemplateId(newTemplate.id);
            setIsCreateWorkoutModalVisible(true);
            setIsMenuVisible(false);
            showSnackbar('success', t('workouts.duplicateSuccess'));
          } catch (err) {
            console.error('Error duplicating workout:', err);
            showSnackbar('error', t('workouts.duplicateError'));
            // Keep menu open on error so user can try again
          }
        }}
        onShare={async () => {
          setIsMenuVisible(false);
          try {
            const message = await WorkoutTemplateService.getShareMessage(selectedWorkoutId);
            await Share.share({ message });
          } catch (err) {
            console.error('Error sharing workout:', err);
            showSnackbar('error', t('common.error'));
          }
        }}
        onDelete={() => {
          setIsMenuVisible(false);
          setIsDeleteConfirmationVisible(true);
        }}
        onPreview={() => {
          if (selectedWorkoutId) {
            handlePreviewWorkout(selectedWorkoutId);
          }
        }}
      />
      <CreateWorkoutOptionsModal
        visible={isCreateOptionsVisible}
        onClose={() => setIsCreateOptionsVisible(false)}
        isAiEnabled={isAiConfigured}
        onStartFreeTraining={async () => {
          try {
            const workoutLog = await WorkoutService.startFreeWorkout(t('freeTraining.workoutName'));
            setIsCreateOptionsVisible(false);
            router.navigate(`/workout/workout-session?workoutLogId=${workoutLog.id}`);
          } catch (err) {
            console.error('Error starting free workout:', err);
            showSnackbar('error', err instanceof Error ? err.message : t('common.error'));
          }
        }}
        onGenerateWithAi={() => {
          setIsCreateOptionsVisible(false);
          setIsGenerateWithAiModalVisible(true);
        }}
        onCreateEmptyTemplate={() => {
          setIsCreateOptionsVisible(false);
          setEditingTemplateId(undefined);
          setIsCreateWorkoutModalVisible(true);
        }}
        onBrowseTemplates={() => {
          setIsCreateOptionsVisible(false);
          // Open the Browse Templates modal
          setIsBrowseTemplatesVisible(true);
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
      <GenerateWorkoutWithAiModal
        visible={isGenerateWithAiModalVisible}
        onClose={() => setIsGenerateWithAiModalVisible(false)}
      />
      <BrowseTemplatesModal
        visible={isBrowseTemplatesVisible}
        onClose={() => setIsBrowseTemplatesVisible(false)}
        onTemplateSelect={(template) => {
          const rawTemplate = getRawTemplateById(template.id);
          if (rawTemplate) {
            setSelectedRawTemplate({ templateId: template.id, title: template.title });
            setIsCreateFromTemplateConfirmationVisible(true);
          } else {
            console.error('Could not find raw template data for:', template.id);
            setIsBrowseTemplatesVisible(false);
          }
        }}
      />
      <ConfirmationModal
        visible={isDeleteConfirmationVisible}
        onClose={() => setIsDeleteConfirmationVisible(false)}
        onConfirm={handleConfirmDeleteWorkout}
        title={t('workouts.deleteConfirmation.title')}
        message={t('workouts.deleteConfirmation.message', { name: selectedWorkoutName })}
        confirmLabel={t('workouts.delete')}
        variant="destructive"
        isLoading={isDeletingWorkoutTemplate}
      />
      <ConfirmationModal
        visible={isCreateFromTemplateConfirmationVisible ? !!selectedRawTemplate : false}
        onClose={() => {
          setIsCreateFromTemplateConfirmationVisible(false);
          setSelectedRawTemplate(null);
        }}
        onConfirm={async () => {
          if (!selectedRawTemplate) {
            return;
          }

          setIsCreatingWorkoutsFromTemplate(true);
          await flushLoadingPaint();

          try {
            const rawTemplate = getRawTemplateById(selectedRawTemplate.templateId);
            if (!rawTemplate) {
              console.error('Could not find raw template data');
              setIsCreatingWorkoutsFromTemplate(false);
              return;
            }

            await WorkoutTemplateService.createWorkoutsFromJsonTemplate(rawTemplate);
            showSnackbar('success', t('workouts.createFromTemplate.successMessage'));
            setIsBrowseTemplatesVisible(false);
          } catch (error) {
            console.error('Error creating workouts from template:', error);
            showSnackbar('error', t('common.error'));
          } finally {
            setIsCreatingWorkoutsFromTemplate(false);
          }
        }}
        title={t('workouts.createFromTemplate.title')}
        message={t('workouts.createFromTemplate.message')}
        confirmLabel={t('workouts.createFromTemplate.confirm')}
        cancelLabel={t('workouts.createFromTemplate.cancel')}
        isLoading={isCreatingWorkoutsFromTemplate}
      />
      {/* Workout Session Overview Modal */}
      <WorkoutSessionOverviewModal
        visible={isWorkoutOverviewVisible}
        onClose={() => setIsWorkoutOverviewVisible(false)}
        workoutLogId={selectedWorkoutLogId}
        onStartWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          router.navigate(`/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onResumeSession={() => {
          setIsWorkoutOverviewVisible(false);
          router.navigate(`/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onSelectExercise={(exerciseId) => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout session with selected exercise
          router.navigate(
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
              captureException(err, { data: { context: 'workouts.cancelWorkout' } });
              showSnackbar('error', t('errors.somethingWentWrong'));
            }
          }
        }}
        onFinishWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout summary
          router.navigate(`/workout/workout-summary?workoutLogId=${selectedWorkoutLogId}`);
        }}
      />

      {/* Workout Preview Modal */}
      <WorkoutSessionHistoryModal
        visible={isPreviewModalVisible && !!previewTemplate ? !isLoadingPreview : false}
        onClose={() => {
          setPreviewTemplateId(null);
        }}
        isPreview={true}
        workoutTemplate={previewTemplate || undefined}
        templateSets={previewTemplateSets}
        exercises={previewExercises}
        onStartWorkout={handleStartWorkoutFromPreview}
      />
    </MasterLayout>
  );
}
