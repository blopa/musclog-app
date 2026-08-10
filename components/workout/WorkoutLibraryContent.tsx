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
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import type { WorkoutTemplateWithMetadata } from '@/hooks/useWorkoutTemplates';
import {
  groupTemplatesByPlan,
  type PlanMembershipSummary,
  type WorkoutPlanSummary,
} from '@/utils/workoutPlanGrouping';

import { WorkoutPlanSection } from './WorkoutPlanSection';

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

function matchesQuery(template: WorkoutTemplateWithMetadata, query: string): boolean {
  return (
    template.name.toLowerCase().includes(query) ||
    Boolean(template.description?.toLowerCase().includes(query))
  );
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
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasSearchQuery = Boolean(searchQuery);
  const showPlanSections = activeFilter !== 'archived' && plans.length > 0;

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        const matchesType =
          activeFilter === 'all' || activeFilter === 'archived' || template.type === activeFilter;
        return matchesType && (!normalizedQuery || matchesQuery(template, normalizedQuery));
      }),
    [activeFilter, normalizedQuery, templates]
  );

  const grouped = useMemo(
    () =>
      groupTemplatesByPlan(
        plans,
        memberships,
        templates.filter(
          (template) =>
            activeFilter === 'all' || activeFilter === 'archived' || template.type === activeFilter
        ),
        searchQuery
      ),
    [activeFilter, memberships, plans, searchQuery, templates]
  );
  const searchResults = useMemo(
    () => [
      ...grouped.sections.flatMap((section) =>
        section.workouts.map(({ template }) => ({ plan: section.plan, template }))
      ),
      ...grouped.unplanned.map((template) => ({ plan: undefined, template })),
    ],
    [grouped]
  );
  const resultCount = showPlanSections ? searchResults.length : filteredTemplates.length;
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
    return (
      <>
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
        {[1, 2, 3].map((index) => (
          <View
            key={index}
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
    );
  }

  if (resultCount === 0) {
    const isSearch = hasSearchQuery;
    return (
      <>
        <EmptyStateCard
          icon={isSearch ? Search : Dumbbell}
          title={isSearch ? t('workouts.noSearchResults') : t('emptyStates.workouts.title')}
          description={
            isSearch
              ? t('workouts.noSearchResultsDescription', { query: searchQuery })
              : t('emptyStates.workouts.description')
          }
          buttonLabel={
            isSearch
              ? t('workouts.noSearchResultsButtonLabel')
              : t('emptyStates.workouts.buttonLabel')
          }
          iconGradient={!isSearch}
          buttonVariant={isSearch ? undefined : 'gradientCta'}
          onButtonPress={isSearch ? onClearSearch : onCreateWorkout}
        />
        {createWorkoutButton}
      </>
    );
  }

  return (
    <>
      {showPlanSections && hasSearchQuery ? (
        <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
          {searchResults.map(({ template, plan }) => (
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
                onStart={() => onStartWorkout(template.id, plan?.id)}
                onMore={() => onOpenWorkoutMenu(template.id, template.name, plan?.id)}
              />
            </View>
          ))}
        </AnimatedContent>
      ) : null}

      {showPlanSections && !hasSearchQuery ? (
        <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
          {grouped.sections.map((section) => (
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
          {grouped.unplanned.length > 0 ? (
            <Accordion
              title={t('workouts.plans.unplanned')}
              count={grouped.unplanned.length}
              isOpen={openAccordions.unplanned ?? true}
              onToggle={() => onToggleAccordion('unplanned')}
              maxHeight={Math.max(480, grouped.unplanned.length * 240 + 80)}
            >
              <View className="gap-4 p-4">
                {grouped.unplanned.map((template) => (
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
      ) : null}

      {!showPlanSections ? (
        <AnimatedContent style={{ gap: theme.spacing.gap.base }}>
          {filteredTemplates.map((template) => {
            const featured = template.id === templates[0]?.id;
            return (
              <WorkoutCard
                key={template.id}
                name={template.name}
                lastCompleted={template.lastCompleted}
                lastCompletedTimestamp={template.lastCompletedTimestamp}
                exerciseCount={template.exerciseCount}
                duration={template.duration}
                icon={template.icon}
                variant={featured ? undefined : 'standard'}
                onStart={() => onStartWorkout(template.id)}
                onArchive={featured ? undefined : () => onArchiveWorkout(template.id)}
                onMore={() => onOpenWorkoutMenu(template.id, template.name)}
              />
            );
          })}
        </AnimatedContent>
      ) : null}

      {createWorkoutButton}
    </>
  );
}
