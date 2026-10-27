import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Footprints,
  History,
  Layers3,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { FilterTabs } from '@/components/FilterTabs';
import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { MasterLayout } from '@/components/MasterLayout';
import { BrowseTemplatesModal, getRawTemplateById } from '@/components/modals/BrowseTemplatesModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { CreateEditPlanModal } from '@/components/modals/CreateEditPlanModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import { CreateWorkoutOptionsModal } from '@/components/modals/CreateWorkoutOptionsModal';
import { GenerateWorkoutWithAiModal } from '@/components/modals/GenerateWorkoutWithAiModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { LogCardioModal } from '@/components/modals/LogCardioModal';
import PastWorkoutsHistoryModal from '@/components/modals/PastWorkoutsHistoryModal';
import { WorkoutSessionHistoryModal } from '@/components/modals/WorkoutSessionHistoryModal';
import { MenuButton } from '@/components/theme/MenuButton';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextInput } from '@/components/theme/TextInput';
import { WeeklyReviewCard } from '@/components/WeeklyReviewCard';
import { usePlanAssignment } from '@/components/workout/usePlanAssignment';
import { WorkoutLibraryContent } from '@/components/workout/WorkoutLibraryContent';
import { WorkoutReminderExplainerSheet } from '@/components/workout/WorkoutReminderExplainerSheet';
import { WorkoutTodayCard } from '@/components/workout/WorkoutTodayCard';
import { WorkoutDetailsMenu } from '@/components/WorkoutDetailsMenu';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { useSnackbar } from '@/context/SnackbarContext';
import { database, WorkoutLog, WorkoutTemplate } from '@/database';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { ActiveWorkoutExistsError, WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
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
import { parseWorkoutReminderParams } from '@/utils/workoutReminderExplainer';

/**
 * The workout a preview is showing, and the plan it was opened from.
 *
 * The plan travels WITH the template id rather than being read back off a separate state slot:
 * starting a workout stamps `workout_logs.plan_id`, and a workout that belongs to several plans
 * cannot have that inferred after the fact. Previewing used to drop it, so every session started
 * from a preview was recorded as unaffiliated.
 */
interface PreviewTarget {
  templateId: string;
  planId?: string;
}

export default function WorkoutsScreen() {
  const theme = useTheme();
  const { i18n, t } = useTranslation();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();
  const router = useRouter();
  const params = useLocalSearchParams<{
    previewTemplateId?: string;
    reminderTemplateId?: string;
    reminderDay?: string;
    reminderTime?: string;
    reminderLead?: string;
    reminderPlan?: string;
  }>();
  const { isAiConfigured } = useSettings();
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const previewTemplateId = previewTarget?.templateId ?? null;

  // Open template preview when navigating from ViewExerciseModal (e.g. "Workouts using this")
  useEffect(() => {
    const id = params.previewTemplateId?.trim();
    if (id) {
      // Through a named helper rather than a bare setState in the effect body:
      // `react-hooks/set-state-in-effect` is an error in this repo, and this is the wrapper idiom
      // it already uses elsewhere (`useCopyDaySource`, `CoachQuickSettingsModal`). Don't inline it.
      const openPreview = () => setPreviewTarget({ templateId: id });
      openPreview();
    }
  }, [params.previewTemplateId]);

  // A tapped workout reminder lands here with its context in the route: explain it once, then drop
  // the params so coming back to the screen does not reopen the sheet. Adjusting state during
  // render, as the cycle screen does, so the sheet is part of the first frame.
  const reminderContext = parseWorkoutReminderParams(params);
  const [handledReminder, setHandledReminder] = useState<string | undefined>(undefined);
  const [explainedReminder, setExplainedReminder] =
    useState<ReturnType<typeof parseWorkoutReminderParams>>(null);
  if (params.reminderTemplateId !== handledReminder) {
    setHandledReminder(params.reminderTemplateId);
    if (reminderContext) {
      setExplainedReminder(reminderContext);
    }
  }

  const closeReminderExplainer = () => {
    setExplainedReminder(null);
    if (params.reminderTemplateId) {
      router.setParams({
        reminderTemplateId: undefined,
        reminderDay: undefined,
        reminderTime: undefined,
        reminderLead: undefined,
        reminderPlan: undefined,
      });
    }
  };

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
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [isLogCardioVisible, setIsLogCardioVisible] = useState(false);
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);
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
  const [todayCardRefreshKey, setTodayCardRefreshKey] = useState(0);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  const [editingPlanId, setEditingPlanId] = useState<string | undefined>();
  const [isPlanEditorVisible, setIsPlanEditorVisible] = useState(false);
  const [isPlanMenuVisible, setIsPlanMenuVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isDeletePlanConfirmationVisible, setIsDeletePlanConfirmationVisible] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      WorkoutService.getActiveWorkout().then(setInterruptedWorkoutLog);
    }, [])
  );

  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();

  // Starting while a session is still open is refused by the service. That is the user's state,
  // not a failure: explain it and surface the resume banner instead of reporting it to Sentry.
  const handleActiveWorkoutExists = useCallback(() => {
    showSnackbar('error', t('workouts.interruptedSession.alreadyActive'));
    WorkoutService.getActiveWorkout().then(setInterruptedWorkoutLog);
  }, [showSnackbar, t]);

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

  // "Start Workout" means start: the session opens straight away, as in Hevy or Strong. It used
  // to create the session and then show an overview with a second "Start Workout" button — two
  // taps, and an "In progress" sheet that looked like a preview. Previewing is the card's own job.
  const handleStartWorkout = useCallback(
    async (templateId: string, planId?: string) => {
      try {
        const workoutLog = await WorkoutService.startWorkoutFromTemplate(templateId, planId);
        router.navigate(`/app/workout/workout-session?workoutLogId=${workoutLog.id}`);
        triggerConfetti(ConfettiActivity.FIRST_WORKOUT_CREATED);
      } catch (err) {
        if (err instanceof ActiveWorkoutExistsError) {
          handleActiveWorkoutExists();
          return;
        }

        handleError(err, 'workouts.handleStartWorkout', {
          snackbarMessage: t('errors.somethingWentWrong'),
        });
      }
    },
    [handleActiveWorkoutExists, router, t, triggerConfetti]
  );

  // `planId` is the section the workout was tapped in. It is carried on `menuPlanId` rather than
  // written to `selectedPlanId`, which belongs to the plan menu and its delete confirmation.
  const [menuPlanId, setMenuPlanId] = useState<string | undefined>();
  const openWorkoutMenu = useCallback(
    (templateId: string, workoutName: string, planId?: string) => {
      setSelectedWorkoutName(workoutName);
      setSelectedWorkoutId(templateId);
      setMenuPlanId(planId);
      setIsMenuVisible(true);
    },
    []
  );

  const toggleAccordion = useCallback((id: string) => {
    setOpenAccordions((current) => ({ ...current, [id]: !(current[id] ?? true) }));
  }, []);

  // Helper function to open preview modal (now synchronous!)
  const handlePreviewWorkout = (templateId: string, planId?: string) => {
    // Verify template exists in already loaded templates
    const templateMetadata = templates.find((t) => t.id === templateId);
    if (!templateMetadata) {
      showSnackbar('error', t('common.error'));
      return;
    }

    setIsMenuVisible(false);
    setPreviewTarget({ planId, templateId });
  };

  // Helper function to start workout from preview
  const handleStartWorkoutFromPreview = async () => {
    if (!previewTarget) {
      return;
    }

    const { planId, templateId } = previewTarget;
    setPreviewTarget(null);
    try {
      await handleStartWorkout(templateId, planId);
    } catch (err) {
      console.error('Error starting workout from preview:', err);
      showSnackbar('error', t('common.error'));
    }
  };

  // No `selectedPlanIds`/`onChange`: this screen persists the membership on confirm and reads the
  // result back off the `memberships` subscription, so there is nothing for the hook to hand back.
  const planAssignment = usePlanAssignment({
    onConfirm: async (planIds) => {
      if (!selectedWorkoutId) {
        return false;
      }

      try {
        await WorkoutPlanService.setTemplatePlans(selectedWorkoutId, planIds);
        return true;
      } catch (error) {
        await handleError(error, 'workouts.setTemplatePlans', {
          snackbarMessage: t('workouts.plans.saveError'),
        });
        // Reported as a refusal so the picker stays open with the user's selection intact to retry.
        return false;
      }
    },
    templateId: selectedWorkoutId || undefined,
  });

  return (
    <MasterLayout>
      <ScreenHeader
        title={t('workouts.title')}
        destination="workouts"
        lockArea="workout"
        actions={
          <MenuButton
            onPress={() => setIsScreenMenuVisible(true)}
            accessibilityLabel={t('workouts.title')}
          />
        }
      />
      <AreaLockGate area="workout">
        {showConfetti ? <ConfettiOverlay /> : null}
        <View className="flex-1">
          <KeyboardAwareScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            bottomOffset={16}
          >
            <View className="px-4 py-6">
              <View className="mb-4 gap-3">
                <WorkoutTodayCard
                  onDiscard={() => setIsDiscardInterruptedConfirmVisible(true)}
                  refreshKey={todayCardRefreshKey}
                  onPreview={(templateId, planId) => setPreviewTarget({ templateId, planId })}
                />
                <WeeklyReviewCard compact />
              </View>
              {/* Filter Tabs */}
              <FilterTabs
                tabs={FILTER_TABS}
                activeTab={activeFilter}
                onTabChange={setActiveFilter}
                showContainer={false}
                scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
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
              <WorkoutLibraryContent
                activeFilter={activeFilter}
                error={error}
                isLoading={isLoadingScreen}
                memberships={memberships}
                openAccordions={openAccordions}
                plans={plans}
                searchQuery={searchQuery}
                templates={templates}
                onArchiveWorkout={async (templateId) => {
                  try {
                    await WorkoutTemplateService.archiveTemplate(templateId);
                    showSnackbar('success', t('workouts.archiveSuccess'));
                  } catch (err) {
                    console.error('Error archiving workout:', err);
                    showSnackbar('error', t('workouts.archiveError'));
                  }
                }}
                onClearSearch={() => setSearchQuery('')}
                onCreateWorkout={() => setIsCreateOptionsVisible(true)}
                onOpenPlanMenu={(planId) => {
                  setSelectedPlanId(planId);
                  setIsPlanMenuVisible(true);
                }}
                onOpenWorkoutMenu={openWorkoutMenu}
                onStartWorkout={handleStartWorkout}
                onPreviewWorkout={handlePreviewWorkout}
                onToggleAccordion={toggleAccordion}
              />
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
              handlePreviewWorkout(selectedWorkoutId, menuPlanId);
            }
          }}
          onAddToPlan={() => {
            if (!selectedWorkoutId) {
              return;
            }

            setIsMenuVisible(false);
            planAssignment.openPicker(
              memberships
                .filter((membership) => membership.templateId === selectedWorkoutId)
                .map((membership) => membership.planId)
            );
          }}
        />
        <CreateWorkoutOptionsModal
          visible={isCreateOptionsVisible}
          onClose={() => setIsCreateOptionsVisible(false)}
          isAiEnabled={isAiConfigured}
          onStartFreeTraining={async () => {
            try {
              const workoutLog = await WorkoutService.startFreeWorkout(
                t('freeTraining.workoutName')
              );
              setIsCreateOptionsVisible(false);
              router.navigate(`/app/workout/workout-session?workoutLogId=${workoutLog.id}`);
            } catch (err) {
              if (err instanceof ActiveWorkoutExistsError) {
                setIsCreateOptionsVisible(false);
                handleActiveWorkoutExists();
                return;
              }

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
              setTodayCardRefreshKey((key) => key + 1);
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
          title={
            plans.find((plan) => plan.id === selectedPlanId)?.name ?? t('workouts.plans.title')
          }
          items={[
            {
              icon: Pencil,
              iconColor: theme.colors.text.primary,
              title: t('workouts.plans.editTitle'),
              description: t('workouts.plans.editDescription'),
              onPress: () => {
                setEditingPlanId(selectedPlanId);
                setIsPlanMenuVisible(false);
                setIsPlanEditorVisible(true);
              },
            },
            {
              icon: Trash2,
              iconColor: theme.colors.status.error,
              title: t('workouts.plans.deleteTitle'),
              description: t('workouts.plans.deleteDescription'),
              titleColor: theme.colors.status.error,
              onPress: () => {
                setIsPlanMenuVisible(false);
                setIsDeletePlanConfirmationVisible(true);
              },
            },
          ]}
        />

        <BottomPopUpMenu
          visible={isScreenMenuVisible}
          onClose={() => setIsScreenMenuVisible(false)}
          title={t('workouts.title')}
          items={[
            {
              icon: Layers3,
              iconColor: theme.colors.accent.primary,
              title: t('workouts.plans.createTitle'),
              description: t('workouts.plans.createDescription'),
              onPress: () => {
                setEditingPlanId(undefined);
                setIsPlanEditorVisible(true);
              },
            },
            {
              icon: Plus,
              iconColor: theme.colors.accent.primary,
              title: t('workouts.createTemplate.title'),
              description: t('workouts.createTemplate.description'),
              onPress: () => {
                setIsCreateOptionsVisible(true);
              },
            },
            {
              icon: Footprints,
              iconColor: theme.colors.accent.primary,
              title: t('cardio.menuItem'),
              description: t('cardio.subtitle'),
              onPress: () => {
                setIsLogCardioVisible(true);
              },
            },
            {
              icon: History,
              iconColor: theme.colors.accent.primary,
              title: t('workouts.history.title'),
              description: t('workouts.history.description'),
              onPress: () => {
                setIsWorkoutHistoryVisible(true);
              },
            },
            {
              icon: Target,
              iconColor: theme.colors.accent.secondary,
              title: t('exerciseGoals.title'),
              description: t('goalsManagement.exerciseGoalsSubtitle'),
              onPress: () => {
                setIsGoalsManagementModalVisible(true);
              },
            },
          ]}
        />

        {/*
        The plan picker, the plan editor and the delete-plan confirmation are screen-level siblings
        of the menus that open them, not `children` of those menus: every menu item closes its menu
        before running its handler, and a hidden `Modal` renders no children — so a follow-up modal
        parked inside one is unmounted the moment it is meant to appear. Sibling placement is safe
        here for the reason FIXES.md allows it: only one of these is ever
        visible at a time, so no dismissed modal is left holding the iOS presenter.
      */}
        {planAssignment.modals}
        {/* Editing an existing plan, which the assignment flow (create-only) does not cover. */}
        {isPlanEditorVisible ? (
          <CreateEditPlanModal
            visible={true}
            planId={editingPlanId}
            onClose={() => {
              setIsPlanEditorVisible(false);
              setEditingPlanId(undefined);
            }}
          />
        ) : null}
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

        {/* Mounted only while open so each open starts from the defaults */}
        {isLogCardioVisible ? (
          <LogCardioModal
            visible={isLogCardioVisible}
            onClose={() => setIsLogCardioVisible(false)}
          />
        ) : null}

        {/* Mounted only while open so each open starts from the default filters */}
        {isWorkoutHistoryVisible ? (
          <PastWorkoutsHistoryModal
            visible={true}
            onClose={() => setIsWorkoutHistoryVisible(false)}
          />
        ) : null}

        <GoalsManagementModal
          visible={isGoalsManagementModalVisible}
          onClose={() => setIsGoalsManagementModalVisible(false)}
          tab="fitness"
        />

        {/* Workout Preview Modal */}
        <WorkoutSessionHistoryModal
          visible={isPreviewModalVisible && !!previewTemplate ? !isLoadingPreview : false}
          onClose={() => {
            setPreviewTarget(null);
          }}
          isPreview={true}
          workoutTemplate={previewTemplate || undefined}
          templateSets={previewTemplateSets}
          templateExercises={previewTemplateExercises}
          exercises={previewExercises}
          onStartWorkout={handleStartWorkoutFromPreview}
        />

        <WorkoutReminderExplainerSheet
          reminder={explainedReminder}
          onClose={closeReminderExplainer}
        />
      </AreaLockGate>
    </MasterLayout>
  );
}
