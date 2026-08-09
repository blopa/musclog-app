import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import {
  Dumbbell,
  Layers3,
  Pencil,
  Plus,
  Repeat,
  Search,
  Target,
  Trash2,
  WifiOff,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { WorkoutCard } from '@/components/cards/WorkoutCard';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { FilterTabs } from '@/components/FilterTabs';
import { GradientText } from '@/components/GradientText';
import { MasterLayout } from '@/components/MasterLayout';
import { BrowseTemplatesModal, getRawTemplateById } from '@/components/modals/BrowseTemplatesModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { CreateEditPlanModal } from '@/components/modals/CreateEditPlanModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import { CreateWorkoutOptionsModal } from '@/components/modals/CreateWorkoutOptionsModal';
import { GenerateWorkoutWithAiModal } from '@/components/modals/GenerateWorkoutWithAiModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { WorkoutPlanPickerModal } from '@/components/modals/WorkoutPlanPickerModal';
import { WorkoutSessionHistoryModal } from '@/components/modals/WorkoutSessionHistoryModal';
import WorkoutSessionOverviewModal from '@/components/modals/WorkoutSessionOverviewModal';
import { Accordion } from '@/components/theme/Accordion';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import DashedButton from '@/components/theme/DashedButton';
import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { TextInput } from '@/components/theme/TextInput';
import { WorkoutPlanSection } from '@/components/workout/WorkoutPlanSection';
import { WorkoutDetailsMenu } from '@/components/WorkoutDetailsMenu';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { useSnackbar } from '@/context/SnackbarContext';
import { database, WorkoutLog, WorkoutTemplate } from '@/database';
import { WorkoutPlanService, WorkoutService, WorkoutTemplateService } from '@/database/services';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutPlans } from '@/hooks/useWorkoutPlans';
import { useWorkoutTemplateDetails } from '@/hooks/useWorkoutTemplateDetails';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { clearActiveWorkoutLogId } from '@/utils/activeWorkoutStorage';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { handleError } from '@/utils/handleError';
import { groupTemplatesByPlan } from '@/utils/workoutPlanGrouping';

type PlanEditorOrigin = 'workout-picker' | 'plan-menu' | 'screen-menu';

export default function WorkoutsScreen() {
  const theme = useTheme();
  const { i18n, t } = useTranslation();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();
  const router = useRouter();
  const params = useLocalSearchParams<{ previewTemplateId?: string }>();
  const { isAiConfigured } = useSettings();
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  // Open template preview when navigating from ViewExerciseModal (e.g. "Workouts using this")
  useEffect(() => {
    const id = params.previewTemplateId;
    if (id?.trim()) {
      const sync = () => {
        setPreviewTemplateId(id.trim());
      };
      sync();
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
  const [isScreenMenuVisible, setIsScreenMenuVisible] = useState(false);
  const [selectedWorkoutName, setSelectedWorkoutName] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [isCreateOptionsVisible, setIsCreateOptionsVisible] = useState(false);
  const [isCreateWorkoutModalVisible, setIsCreateWorkoutModalVisible] = useState(false);
  const [isWorkoutOverviewVisible, setIsWorkoutOverviewVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
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
  const isPreviewModalVisible = previewTemplateId !== null;
  const [searchQuery, setSearchQuery] = useState('');
  const [interruptedWorkoutLog, setInterruptedWorkoutLog] = useState<WorkoutLog | null>(null);
  const [isDiscardInterruptedConfirmVisible, setIsDiscardInterruptedConfirmVisible] =
    useState(false);
  const [isDiscardingInterrupted, setIsDiscardingInterrupted] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  const [planEditorOrigin, setPlanEditorOrigin] = useState<PlanEditorOrigin | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | undefined>();
  const [isPlanMenuVisible, setIsPlanMenuVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isDeletePlanConfirmationVisible, setIsDeletePlanConfirmationVisible] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [isPlanPickerVisible, setIsPlanPickerVisible] = useState(false);
  const [pendingPlanIds, setPendingPlanIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      WorkoutService.getActiveWorkout().then(setInterruptedWorkoutLog);
    }, [])
  );

  const handleOverviewModalClose = useCallback(() => {
    setIsWorkoutOverviewVisible(false);
    WorkoutService.getActiveWorkout().then(setInterruptedWorkoutLog);
  }, []);

  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();

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
    templateExercises: previewTemplateExercises,
    exercises: previewExercises,
    isLoading: isLoadingPreview,
  } = useWorkoutTemplateDetails(previewTemplateId);

  // Use reactive hook for workout templates with scope based on active filter
  const { templates, isLoading, error } = useWorkoutTemplates({
    scope: activeFilter === 'archived' ? 'archived' : 'active',
  });
  const { plans, memberships, isLoading: isLoadingPlans } = useWorkoutPlans();
  const isLoadingScreen = isLoading || isLoadingPlans;
  const hasPlans = activeFilter !== 'archived' && plans.length > 0;

  const templatesForPlans = useMemo(() => {
    if (
      activeFilter !== 'strength' &&
      activeFilter !== 'cardio' &&
      activeFilter !== 'flexibility'
    ) {
      return templates;
    }
    return templates.filter((template) => template.type === activeFilter);
  }, [templates, activeFilter]);

  const groupedWorkouts = useMemo(
    () =>
      groupTemplatesByPlan(
        plans,
        memberships.map((membership) => ({
          id: membership.id,
          planId: membership.planId,
          templateId: membership.templateId,
          weekDays: membership.weekDays,
          position: membership.position,
        })),
        templatesForPlans,
        searchQuery
      ),
    [plans, memberships, templatesForPlans, searchQuery]
  );

  const flatPlanSearchResults = useMemo(
    () => [
      ...groupedWorkouts.sections.flatMap((section) =>
        section.workouts.map(({ template }) => ({ template, plan: section.plan }))
      ),
      ...groupedWorkouts.unplanned.map((template) => ({ template, plan: undefined })),
    ],
    [groupedWorkouts]
  );

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
    async (templateId: string, planId?: string) => {
      try {
        const workoutLog = await WorkoutService.startWorkoutFromTemplate(templateId, planId);
        setSelectedWorkoutLogId(workoutLog.id);
        setIsWorkoutOverviewVisible(true);
        triggerConfetti(ConfettiActivity.FIRST_WORKOUT_CREATED);
      } catch (err) {
        handleError(err, 'workouts.handleStartWorkout', {
          snackbarMessage: t('errors.somethingWentWrong'),
        });
      }
    },
    [t, triggerConfetti]
  );

  const openWorkoutMenu = useCallback(
    (templateId: string, workoutName: string, planId?: string) => {
      setSelectedWorkoutName(workoutName);
      setSelectedWorkoutId(templateId);
      setSelectedPlanId(planId ?? '');
      setIsMenuVisible(true);
    },
    []
  );

  const toggleAccordion = useCallback((id: string) => {
    setOpenAccordions((current) => ({ ...current, [id]: !(current[id] ?? true) }));
  }, []);

  // Helper function to open preview modal (now synchronous!)
  const handlePreviewWorkout = (templateId: string) => {
    // Verify template exists in already loaded templates
    const templateMetadata = templates.find((t) => t.id === templateId);
    if (!templateMetadata) {
      showSnackbar('error', t('common.error'));
      return;
    }

    setIsMenuVisible(false);
    setPreviewTemplateId(templateId);
  };

  // Helper function to start workout from preview
  const handleStartWorkoutFromPreview = async () => {
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
  };

  return (
    <MasterLayout>
      {showConfetti ? <ConfettiOverlay /> : null}
      <View className="flex-1">
        <KeyboardAwareScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          bottomOffset={16}
        >
          {/* Header */}
          <View className="px-4 py-6">
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
              <MenuButton onPress={() => setIsScreenMenuVisible(true)} />
            </View>
            {/* Add spacing below header */}
            <View style={{ height: theme.spacing.gap.lg }} />
            {/* Filter Tabs */}
            <FilterTabs
              tabs={FILTER_TABS}
              activeTab={activeFilter}
              onTabChange={setActiveFilter}
              showContainer={false}
            />
            {/* Search Input */}
            <View className="mt-3">
              <TextInput
                label=""
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('workouts.searchPlaceholder')}
                icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
              />
            </View>
          </View>

          {/* Workouts List */}
          <View className="mx-4 mb-8 gap-4">
            {/* Interrupted Session Banner */}
            {interruptedWorkoutLog ? (
              <View className="z-10 bg-bg-primary">
                <View
                  className="flex-row items-center gap-4 rounded-xl border bg-bg-card p-4 shadow-sm"
                  style={{ borderColor: theme.colors.background.white5 }}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10">
                    <Repeat size={theme.iconSize.md} color={theme.colors.accent.primary} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="flex-1 text-base font-bold text-text-primary"
                        numberOfLines={1}
                      >
                        {interruptedWorkoutLog.workoutName ?? t('freeTraining.title')}
                      </Text>
                      <View className="ml-2 rounded-full bg-accent-primary/10 px-2 py-0.5">
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-text-accent">
                          {t('workout.inProgress')}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-text-secondary" numberOfLines={1}>
                      {t('workouts.interruptedSession.description')}
                    </Text>
                    <View className="mt-3 flex-row gap-2">
                      <Button
                        label={t('workouts.interruptedSession.resume')}
                        size="xs"
                        width="flex-1"
                        variant="gradientCta"
                        onPress={() => {
                          setSelectedWorkoutLogId(interruptedWorkoutLog.id);
                          setIsWorkoutOverviewVisible(true);
                        }}
                      />
                      <Button
                        label={t('workouts.interruptedSession.discard')}
                        size="xs"
                        variant="secondary"
                        onPress={() => setIsDiscardInterruptedConfirmVisible(true)}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

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
            {isLoadingScreen && !error ? (
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
            {!isLoadingScreen &&
            !error &&
            (hasPlans
              ? groupedWorkouts.sections.length === 0 && groupedWorkouts.unplanned.length === 0
              : !filteredFeaturedWorkout && filteredWorkouts.length === 0) &&
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
            {!isLoadingScreen &&
            !error &&
            searchQuery &&
            (hasPlans
              ? flatPlanSearchResults.length === 0
              : filteredFeaturedWorkout === null && filteredWorkouts.length === 0) ? (
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
            {!isLoadingScreen && !error && !hasPlans && filteredFeaturedWorkout ? (
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
                    openWorkoutMenu(filteredFeaturedWorkout.id, filteredFeaturedWorkout.name);
                  }}
                />
              </AnimatedContent>
            ) : null}

            {/* Normal State - Regular Workouts */}
            {!isLoadingScreen && !error && !hasPlans && filteredWorkouts.length > 0 ? (
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
                      onMore={() => openWorkoutMenu(workout.id, workout.name)}
                    />
                  ))}
                </>
              </AnimatedContent>
            ) : null}

            {!isLoadingScreen && !error && hasPlans && !searchQuery ? (
              <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
                <>
                  {groupedWorkouts.sections.map((section) => (
                    <WorkoutPlanSection
                      key={section.plan.id}
                      section={section}
                      isOpen={openAccordions[section.plan.id] ?? true}
                      onToggle={() => toggleAccordion(section.plan.id)}
                      onPlanMenu={() => {
                        setSelectedPlanId(section.plan.id);
                        setIsPlanMenuVisible(true);
                      }}
                      onStartWorkout={handleStartWorkout}
                      onWorkoutMenu={(templateId, workoutName, planId) =>
                        openWorkoutMenu(templateId, workoutName, planId)
                      }
                    />
                  ))}
                  {groupedWorkouts.unplanned.length > 0 ? (
                    <Accordion
                      title={t('workouts.plans.unplanned')}
                      count={groupedWorkouts.unplanned.length}
                      isOpen={openAccordions.unplanned ?? true}
                      onToggle={() => toggleAccordion('unplanned')}
                      maxHeight={Math.max(480, groupedWorkouts.unplanned.length * 240 + 80)}
                    >
                      <View className="gap-4 p-4">
                        {groupedWorkouts.unplanned.map((workout) => (
                          <WorkoutCard
                            key={workout.id}
                            name={workout.name}
                            lastCompleted={workout.lastCompleted}
                            lastCompletedTimestamp={workout.lastCompletedTimestamp}
                            exerciseCount={workout.exerciseCount}
                            duration={workout.duration}
                            icon={workout.icon}
                            variant="standard"
                            onStart={() => handleStartWorkout(workout.id)}
                            onMore={() => openWorkoutMenu(workout.id, workout.name)}
                          />
                        ))}
                      </View>
                    </Accordion>
                  ) : null}
                </>
              </AnimatedContent>
            ) : null}

            {!isLoadingScreen && !error && hasPlans && Boolean(searchQuery) ? (
              <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
                <>
                  {flatPlanSearchResults.map(({ template, plan }) => (
                    <View key={`${plan?.id ?? 'unplanned'}:${template.id}`} className="gap-2">
                      <Text className="self-start rounded-full bg-accent-primary/10 px-2 py-1 text-xs font-medium text-text-accent">
                        {plan?.name ?? t('workouts.plans.unplanned')}
                      </Text>
                      <WorkoutCard
                        name={template.name}
                        lastCompleted={template.lastCompleted}
                        lastCompletedTimestamp={template.lastCompletedTimestamp}
                        exerciseCount={template.exerciseCount}
                        duration={template.duration}
                        icon={template.icon}
                        variant="standard"
                        onStart={() => handleStartWorkout(template.id, plan?.id)}
                        onMore={() => openWorkoutMenu(template.id, template.name, plan?.id)}
                      />
                    </View>
                  ))}
                </>
              </AnimatedContent>
            ) : null}

            {/* Create Template Button - Only show when there are workouts */}
            {!isLoadingScreen && !error && templates.length > 0 ? (
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
        </KeyboardAwareScrollView>
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
            await shareText(message);
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
        onAddToPlan={() => {
          if (!selectedWorkoutId) {
            return;
          }
          setPendingPlanIds(
            memberships
              .filter((membership) => membership.templateId === selectedWorkoutId)
              .map((membership) => membership.planId)
          );
          setIsMenuVisible(false);
          setIsPlanPickerVisible(true);
        }}
        nestedModals={
          <WorkoutPlanPickerModal
            visible={isPlanPickerVisible}
            plans={plans}
            selectedPlanIds={pendingPlanIds}
            onChange={setPendingPlanIds}
            onClose={async () => {
              if (selectedWorkoutId) {
                try {
                  await WorkoutPlanService.setTemplatePlans(selectedWorkoutId, pendingPlanIds);
                } catch (error) {
                  await handleError(error, 'workouts.setTemplatePlans', {
                    snackbarMessage: t('workouts.plans.saveError'),
                  });
                }
              }
              setIsPlanPickerVisible(false);
            }}
            onCreatePlan={() => {
              setIsPlanPickerVisible(false);
              setEditingPlanId(undefined);
              setPlanEditorOrigin('workout-picker');
            }}
            nestedModals={
              planEditorOrigin === 'workout-picker' ? (
                <CreateEditPlanModal
                  visible={true}
                  onClose={() => {
                    setPlanEditorOrigin(null);
                    setEditingPlanId(undefined);
                  }}
                  onSaved={async (savedPlanId) => {
                    if (selectedWorkoutId) {
                      const nextPlanIds = [...new Set([...pendingPlanIds, savedPlanId])];
                      setPendingPlanIds(nextPlanIds);
                      try {
                        await WorkoutPlanService.setTemplatePlans(selectedWorkoutId, nextPlanIds);
                      } catch (error) {
                        await handleError(error, 'workouts.setTemplatePlansAfterCreate', {
                          snackbarMessage: t('workouts.plans.saveError'),
                        });
                      }
                    }
                  }}
                />
              ) : null
            }
          />
        }
      />
      <CreateWorkoutOptionsModal
        visible={isCreateOptionsVisible}
        onClose={() => setIsCreateOptionsVisible(false)}
        isAiEnabled={isAiConfigured}
        onStartFreeTraining={async () => {
          try {
            const workoutLog = await WorkoutService.startFreeWorkout(t('freeTraining.workoutName'));
            setIsCreateOptionsVisible(false);
            router.navigate(`/app/workout/workout-session?workoutLogId=${workoutLog.id}`);
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
      {isCreateWorkoutModalVisible ? (
        <CreateWorkoutModal
          visible={true}
          onClose={() => {
            setIsCreateWorkoutModalVisible(false);
            setEditingTemplateId(undefined);
          }}
          templateId={editingTemplateId}
        />
      ) : null}
      <GenerateWorkoutWithAiModal
        visible={isGenerateWithAiModalVisible}
        onClose={() => setIsGenerateWithAiModalVisible(false)}
      />
      <BrowseTemplatesModal
        visible={isBrowseTemplatesVisible}
        onClose={() => setIsBrowseTemplatesVisible(false)}
        onTemplateSelect={(template) => {
          const rawTemplate = getRawTemplateById(
            template.id,
            i18n.resolvedLanguage ?? i18n.language
          );
          if (rawTemplate) {
            setSelectedRawTemplate({ templateId: template.id, title: template.title });
            setIsCreateFromTemplateConfirmationVisible(true);
          } else {
            console.error('Could not find raw template data for:', template.id);
            setIsBrowseTemplatesVisible(false);
          }
        }}
      >
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
              const rawTemplate = getRawTemplateById(
                selectedRawTemplate.templateId,
                i18n.resolvedLanguage ?? i18n.language
              );
              if (!rawTemplate) {
                console.error('Could not find raw template data');
                setIsCreatingWorkoutsFromTemplate(false);
                return;
              }

              const created =
                await WorkoutTemplateService.createWorkoutsFromJsonTemplate(rawTemplate);
              showSnackbar(
                'success',
                created.plan
                  ? t('workouts.createFromTemplate.successMessageWithPlan', {
                      planName: created.plan.name,
                      count: created.templates.length,
                    })
                  : t('workouts.createFromTemplate.successMessage')
              );
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
      </BrowseTemplatesModal>
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
      {/* Discard Interrupted Session Confirmation */}
      <ConfirmationModal
        visible={isDiscardInterruptedConfirmVisible}
        onClose={() => setIsDiscardInterruptedConfirmVisible(false)}
        onConfirm={async () => {
          if (!interruptedWorkoutLog) {
            return;
          }

          setIsDiscardingInterrupted(true);
          try {
            await clearActiveWorkoutLogId();
            await WorkoutService.deleteWorkoutLog(interruptedWorkoutLog.id);
            setInterruptedWorkoutLog(null);
          } catch (err) {
            console.error('Error discarding interrupted workout:', err);
            handleError(err, 'workouts.discardInterrupted');
            showSnackbar('error', t('errors.somethingWentWrong'));
          } finally {
            setIsDiscardingInterrupted(false);
            setIsDiscardInterruptedConfirmVisible(false);
          }
        }}
        title={t('workouts.interruptedSession.discardConfirmTitle')}
        message={t('workouts.interruptedSession.discardConfirmMessage')}
        confirmLabel={t('workouts.interruptedSession.discardConfirm')}
        cancelLabel={t('workouts.interruptedSession.discardCancel')}
        variant="destructive"
        isLoading={isDiscardingInterrupted}
      />

      <BottomPopUpMenu
        visible={isPlanMenuVisible}
        onClose={() => setIsPlanMenuVisible(false)}
        title={plans.find((plan) => plan.id === selectedPlanId)?.name ?? t('workouts.plans.title')}
        items={[
          {
            icon: Pencil,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.text.primary20,
            title: t('workouts.plans.editTitle'),
            description: t('workouts.plans.editDescription'),
            onPress: () => {
              setEditingPlanId(selectedPlanId);
              setIsPlanMenuVisible(false);
              setPlanEditorOrigin('plan-menu');
            },
          },
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('workouts.plans.deleteTitle'),
            description: t('workouts.plans.deleteDescription'),
            titleColor: theme.colors.status.error,
            descriptionColor: theme.colors.status.error,
            onPress: () => {
              setIsPlanMenuVisible(false);
              setIsDeletePlanConfirmationVisible(true);
            },
          },
        ]}
        nestedModals={
          planEditorOrigin === 'plan-menu' ? (
            <CreateEditPlanModal
              visible={true}
              planId={editingPlanId}
              onClose={() => {
                setPlanEditorOrigin(null);
                setEditingPlanId(undefined);
              }}
            />
          ) : (
            <ConfirmationModal
              visible={isDeletePlanConfirmationVisible}
              onClose={() => setIsDeletePlanConfirmationVisible(false)}
              onConfirm={async () => {
                if (!selectedPlanId) {
                  return;
                }
                setIsDeletingPlan(true);
                try {
                  await WorkoutPlanService.deletePlan(selectedPlanId);
                  showSnackbar('success', t('workouts.plans.deleteSuccess'));
                } catch (error) {
                  await handleError(error, 'workouts.deletePlan', {
                    snackbarMessage: t('workouts.plans.deleteError'),
                  });
                } finally {
                  setIsDeletingPlan(false);
                  setIsDeletePlanConfirmationVisible(false);
                }
              }}
              title={t('workouts.plans.deleteConfirmation.title')}
              message={t('workouts.plans.deleteConfirmation.message', {
                name: plans.find((plan) => plan.id === selectedPlanId)?.name,
              })}
              confirmLabel={t('common.delete')}
              variant="destructive"
              isLoading={isDeletingPlan}
            />
          )
        }
      />

      <BottomPopUpMenu
        visible={isScreenMenuVisible}
        onClose={() => setIsScreenMenuVisible(false)}
        title={t('workouts.title')}
        items={[
          {
            icon: Layers3,
            iconColor: theme.colors.accent.primary,
            iconBgColor: `${theme.colors.accent.primary}20`,
            title: t('workouts.plans.createTitle'),
            description: t('workouts.plans.createDescription'),
            onPress: () => {
              setEditingPlanId(undefined);
              setPlanEditorOrigin('screen-menu');
            },
          },
          {
            icon: Plus,
            iconColor: theme.colors.accent.primary,
            iconBgColor: `${theme.colors.accent.primary}20`,
            title: t('workouts.createTemplate.title'),
            description: t('workouts.createTemplate.description'),
            onPress: () => {
              setIsCreateOptionsVisible(true);
            },
          },
          {
            icon: Target,
            iconColor: theme.colors.accent.secondary,
            iconBgColor: `${theme.colors.accent.secondary}20`,
            title: t('exerciseGoals.title'),
            description: t('goalsManagement.exerciseGoalsSubtitle'),
            onPress: () => {
              setIsGoalsManagementModalVisible(true);
            },
          },
        ]}
        nestedModals={
          planEditorOrigin === 'screen-menu' ? (
            <CreateEditPlanModal
              visible={true}
              onClose={() => {
                setPlanEditorOrigin(null);
                setEditingPlanId(undefined);
              }}
            />
          ) : null
        }
      />

      <GoalsManagementModal
        visible={isGoalsManagementModalVisible}
        onClose={() => setIsGoalsManagementModalVisible(false)}
        tab="fitness"
      />

      {/* Workout Session Overview Modal */}
      <WorkoutSessionOverviewModal
        visible={isWorkoutOverviewVisible}
        onClose={handleOverviewModalClose}
        workoutLogId={selectedWorkoutLogId}
        onStartWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          router.navigate(`/app/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onResumeSession={() => {
          setIsWorkoutOverviewVisible(false);
          router.navigate(`/app/workout/workout-session?workoutLogId=${selectedWorkoutLogId}`);
        }}
        onSelectExercise={(exerciseId) => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout session with selected exercise
          router.navigate(
            `/app/workout/workout-session?workoutLogId=${selectedWorkoutLogId}&exerciseId=${exerciseId}`
          );
        }}
        onCancelWorkout={async () => {
          setIsWorkoutOverviewVisible(false);
          // Cancel the workout and navigate back
          if (selectedWorkoutLogId) {
            try {
              // Clear active workout and delete the workout log
              await clearActiveWorkoutLogId();
              await WorkoutService.deleteWorkoutLog(selectedWorkoutLogId);
            } catch (err) {
              console.error('Error canceling workout:', err);
              handleError(err, 'workouts.cancelWorkout');
              showSnackbar('error', t('errors.somethingWentWrong'));
            }
          }
        }}
        onFinishWorkout={() => {
          setIsWorkoutOverviewVisible(false);
          // Navigate to workout summary
          router.navigate(`/app/workout/workout-summary?workoutLogId=${selectedWorkoutLogId}`);
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
        templateExercises={previewTemplateExercises}
        exercises={previewExercises}
        onStartWorkout={handleStartWorkoutFromPreview}
      />
    </MasterLayout>
  );
}
