import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { WorkoutCard } from '@/components/cards/WorkoutCard';
import { Accordion } from '@/components/theme/Accordion';
import { MenuButton } from '@/components/theme/MenuButton';
import { getWeekdayLabels } from '@/utils/workout';
import type { PlanSection } from '@/utils/workoutPlanGrouping';

interface WorkoutPlanSectionProps {
  section: PlanSection;
  isOpen: boolean;
  onToggle: () => void;
  onPlanMenu: () => void;
  onStartWorkout: (templateId: string, planId: string) => Promise<void>;
  onWorkoutMenu: (templateId: string, workoutName: string, planId: string) => void;
}

export function WorkoutPlanSection({
  section,
  isOpen,
  onToggle,
  onPlanMenu,
  onStartWorkout,
  onWorkoutMenu,
}: WorkoutPlanSectionProps) {
  const { t } = useTranslation();
  const weekdayLabels = getWeekdayLabels();
  const maxHeight = Math.max(480, section.workouts.length * 260 + 80);

  return (
    <Accordion
      title={section.plan.name}
      isOpen={isOpen}
      onToggle={onToggle}
      maxHeight={maxHeight}
      headerContent={
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
              {section.plan.name}
            </Text>
            <View className="mt-1 flex-row flex-wrap gap-2">
              <Text className="text-xs text-text-secondary">
                {t('workouts.plans.workoutCount', { count: section.workouts.length })}
              </Text>
              <Text className="rounded-full bg-accent-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-text-accent">
                {t(`workouts.plans.cycleType.${section.plan.cycleType}`)}
              </Text>
              {section.plan.difficulty ? (
                <Text className="rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                  {t(`workouts.browseTemplatesModal.tabs.${section.plan.difficulty}`)}
                </Text>
              ) : null}
            </View>
          </View>
          <MenuButton onPress={onPlanMenu} size="sm" />
        </View>
      }
    >
      <View className="gap-4 p-4">
        {section.workouts.map(({ template, membership }) => {
          const schedule =
            section.plan.cycleType === 'weekly'
              ? membership.weekDays?.map((day) => weekdayLabels[day]).join(', ')
              : undefined;
          return (
            <View key={`${section.plan.id}:${template.id}`} className="gap-2">
              {section.plan.cycleType === 'weekly' ? (
                <Text
                  className={`text-xs font-medium ${schedule ? 'text-text-secondary' : 'text-status-warning'}`}
                >
                  {schedule || t('workouts.plans.unscheduled')}
                </Text>
              ) : null}
              <WorkoutCard
                name={template.name}
                lastCompleted={template.lastCompleted}
                lastCompletedTimestamp={template.lastCompletedTimestamp}
                exerciseCount={template.exerciseCount}
                duration={template.duration}
                icon={template.icon}
                variant="standard"
                onStart={() => onStartWorkout(template.id, section.plan.id)}
                onMore={() => onWorkoutMenu(template.id, template.name, section.plan.id)}
              />
            </View>
          );
        })}
      </View>
    </Accordion>
  );
}
