import { Dumbbell, Plus, Search, WifiOff } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { WorkoutCard } from '@/components/cards/WorkoutCard';
import { Accordion } from '@/components/theme/Accordion';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import DashedButton from '@/components/theme/DashedButton';
import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { ErrorStateCard } from '@/components/theme/ErrorStateCard';
import { useTheme } from '@/hooks/useTheme';
import type { WorkoutTemplateWithMetadata } from '@/hooks/useWorkoutTemplates';
import {
  groupTemplatesByPlan,
  type PlanMembershipSummary,
  type WorkoutPlanSummary,
} from '@/utils/workoutPlanGrouping';

import { WorkoutLibrarySkeleton } from './WorkoutLibrarySkeleton';
import { WorkoutPlanSection } from './WorkoutPlanSection';

/** Archived workouts are listed flat: a plan lists what you would train next, not your history. */
const FLAT_FILTERS = new Set(['archived']);

interface WorkoutLibraryContentProps {
  activeFilter: string;
  error: string | null;
  isLoading: boolean;
  memberships: PlanMembershipSummary[];
  openAccordions: Record<string, boolean>;
  plans: WorkoutPlanSummary[];
  searchQuery: string;
  templates: WorkoutTemplateWithMetadata[];
  onArchiveWorkout: (templateId: string) => Promise<void>;
  onClearSearch: () => void;
  onCreateWorkout: () => void;
  onOpenPlanMenu: (planId: string) => void;
  onOpenWorkoutMenu: (templateId: string, workoutName: string, planId?: string) => void;
  onStartWorkout: (templateId: string, planId?: string) => Promise<void>;
  onToggleAccordion: (id: string) => void;
}

export function WorkoutLibraryContent({
  activeFilter,
  error,
  isLoading,
  memberships,
  openAccordions,
  plans,
  searchQuery,
  templates,
  onArchiveWorkout,
  onClearSearch,
  onCreateWorkout,
  onOpenPlanMenu,
  onOpenWorkoutMenu,
  onStartWorkout,
  onToggleAccordion,
}: WorkoutLibraryContentProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const hasSearchQuery = Boolean(searchQuery);
  const showPlanSections = !FLAT_FILTERS.has(activeFilter) && plans.length > 0;

  /**
   * One grouping pass feeds every layout below.
   *
   * When plan sections are off, `plans` is passed as empty and `unplanned` comes back as the whole
   * filtered library — which is exactly the flat list. That is why there is no second filter here:
   * a parallel "filteredTemplates" had to re-implement the type filter and the search matcher, and
   * both copies had already drifted from the ones in `groupTemplatesByPlan`.
   */
  const { sections, unplanned } = useMemo(
    () =>
      groupTemplatesByPlan(
        showPlanSections ? plans : [],
        memberships,
        templates.filter(
          (template) =>
            activeFilter === 'all' ||
            FLAT_FILTERS.has(activeFilter) ||
            template.type === activeFilter
        ),
        searchQuery
      ),
    [activeFilter, memberships, plans, searchQuery, showPlanSections, templates]
  );

  /** Searching flattens the sections: a plan heading per result reads better than empty groups. */
  const searchResults = useMemo(
    () => [
      ...sections.flatMap((section) =>
        section.workouts.map(({ template }) => ({ plan: section.plan, template }))
      ),
      ...unplanned.map((template) => ({ plan: undefined, template })),
    ],
    [sections, unplanned]
  );
  const resultCount = searchResults.length;
  const createWorkoutButton =
    templates.length > 0 ? (
      <DashedButton
        label={t('workouts.createTemplate.title')}
        onPress={onCreateWorkout}
        size="lg"
        icon={<Plus size={theme.iconSize.lg} color={theme.colors.text.primary} />}
      />
    ) : null;

  if (error) {
    return (
      <ErrorStateCard
        icon={WifiOff}
        title={t('errors.connectionTimeout.title')}
        description={t('errors.connectionTimeout.description')}
        buttonLabel={t('errors.connectionTimeout.tryAgain')}
        onButtonPress={() => {
          // Reactive hooks clear the error when their data source updates.
        }}
      />
    );
  }

  if (isLoading) {
    return <WorkoutLibrarySkeleton />;
  }

  if (resultCount === 0) {
    return (
      <>
        <EmptyStateCard
          icon={hasSearchQuery ? Search : Dumbbell}
          title={hasSearchQuery ? t('workouts.noSearchResults') : t('emptyStates.workouts.title')}
          description={
            hasSearchQuery
              ? t('workouts.noSearchResultsDescription', { query: searchQuery })
              : t('emptyStates.workouts.description')
          }
          buttonLabel={
            hasSearchQuery
              ? t('workouts.noSearchResultsButtonLabel')
              : t('emptyStates.workouts.buttonLabel')
          }
          buttonVariant={hasSearchQuery ? undefined : 'gradientCta'}
          onButtonPress={hasSearchQuery ? onClearSearch : onCreateWorkout}
        />
        {createWorkoutButton}
      </>
    );
  }

  // Flat list: no plans to group by, or searching (where a heading per result beats empty groups).
  if (!showPlanSections || hasSearchQuery) {
    return (
      <>
        <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
          {searchResults.map(({ template, plan }) => {
            const featured = !hasSearchQuery && template.id === templates[0]?.id;
            return (
              <View key={`${plan?.id ?? 'unplanned'}:${template.id}`} className="gap-2">
                {hasSearchQuery && showPlanSections ? (
                  <Text className="self-start rounded-full bg-accent-primary/10 px-2 py-1 text-xs font-medium text-text-accent">
                    {plan?.name ?? t('workouts.plans.unplanned')}
                  </Text>
                ) : null}
                <WorkoutCard
                  name={template.name}
                  lastCompleted={template.lastCompleted}
                  lastCompletedTimestamp={template.lastCompletedTimestamp}
                  exerciseCount={template.exerciseCount}
                  duration={template.duration}
                  icon={template.icon}
                  variant={featured ? undefined : 'standard'}
                  onStart={() => onStartWorkout(template.id, plan?.id)}
                  // TODO: check why can't archive featured workout
                  onArchive={featured ? undefined : () => onArchiveWorkout(template.id)}
                  onMore={() => onOpenWorkoutMenu(template.id, template.name, plan?.id)}
                />
              </View>
            );
          })}
        </AnimatedContent>
        {createWorkoutButton}
      </>
    );
  }

  return (
    <>
      <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
        {sections.map((section) => (
          <WorkoutPlanSection
            key={section.plan.id}
            section={section}
            isOpen={openAccordions[section.plan.id] ?? true}
            onToggle={() => onToggleAccordion(section.plan.id)}
            onPlanMenu={() => onOpenPlanMenu(section.plan.id)}
            onStartWorkout={(templateId, planId) => onStartWorkout(templateId, planId)}
            onWorkoutMenu={onOpenWorkoutMenu}
          />
        ))}
        {unplanned.length > 0 ? (
          <Accordion
            title={t('workouts.plans.unplanned')}
            count={unplanned.length}
            isOpen={openAccordions.unplanned ?? true}
            onToggle={() => onToggleAccordion('unplanned')}
            maxHeight={Math.max(480, unplanned.length * 240 + 80)}
          >
            <View className="gap-4 p-4">
              {unplanned.map((template) => (
                <WorkoutCard
                  key={template.id}
                  name={template.name}
                  lastCompleted={template.lastCompleted}
                  lastCompletedTimestamp={template.lastCompletedTimestamp}
                  exerciseCount={template.exerciseCount}
                  duration={template.duration}
                  icon={template.icon}
                  variant="standard"
                  onStart={() => onStartWorkout(template.id)}
                  onMore={() => onOpenWorkoutMenu(template.id, template.name)}
                />
              ))}
            </View>
          </Accordion>
        ) : null}
      </AnimatedContent>

      {createWorkoutButton}
    </>
  );
}
