import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/theme/Button';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextInput } from '@/components/theme/TextInput';
import { WeekdayPicker } from '@/components/theme/WeekdayPicker';
import type { WorkoutPlanCycleType } from '@/constants/workoutPlans';
import { useSnackbar } from '@/context/SnackbarContext';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutPlans } from '@/hooks/useWorkoutPlans';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { handleError } from '@/utils/handleError';
import { getWeekdayLabels } from '@/utils/workout';
import { getWorkoutIcon, WORKOUT_ICON_OPTIONS } from '@/utils/workoutIconUtils';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

interface CreateEditPlanModalProps {
  visible: boolean;
  planId?: string;
  onClose: () => void;
  onSaved?: (planId: string) => void | Promise<void>;
}

export function CreateEditPlanModal({
  visible,
  planId,
  onClose,
  onSaved,
}: CreateEditPlanModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { plans, memberships } = useWorkoutPlans();
  const { templates } = useWorkoutTemplates();
  const plan = plans.find((candidate) => candidate.id === planId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cycleType, setCycleType] = useState<WorkoutPlanCycleType>('weekly');
  const [icon, setIcon] = useState<string | undefined>();
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [orderedTemplateIds, setOrderedTemplateIds] = useState<string[]>([]);
  const [weekDaysByTemplate, setWeekDaysByTemplate] = useState<Record<string, number[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCycleConfirmationVisible, setIsCycleConfirmationVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const loadPlan = () => {
      const planMemberships = memberships
        .filter((membership) => membership.planId === planId)
        .sort((left, right) => left.position - right.position);
      setName(plan?.name ?? '');
      setDescription(plan?.description ?? '');
      setCycleType(plan?.cycleType ?? 'weekly');
      setIcon(plan?.icon);
      setSelectedTemplateIds(planMemberships.map((membership) => membership.templateId));
      setOrderedTemplateIds(planMemberships.map((membership) => membership.templateId));
      setWeekDaysByTemplate(
        Object.fromEntries(
          planMemberships.map((membership) => [membership.templateId, membership.weekDays ?? []])
        )
      );
    };
    loadPlan();
  }, [visible, planId, plan, memberships]);

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.name,
        description: t('workouts.plans.picker.exerciseCount', {
          count: template.exerciseCount,
        }),
        icon: getWorkoutIcon(template.icon),
        iconBgColor: theme.colors.accent.primary10,
        iconColor: theme.colors.accent.primary,
      })),
    [templates, t, theme]
  );

  const handleMembershipChange = useCallback((ids: string[]) => {
    setSelectedTemplateIds(ids);
    setOrderedTemplateIds((current) => [
      ...current.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !current.includes(id)),
    ]);
  }, []);

  const moveMember = useCallback((templateId: string, direction: -1 | 1) => {
    setOrderedTemplateIds((current) => {
      const index = current.indexOf(templateId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const toggleMemberDay = useCallback((templateId: string, day: number) => {
    setWeekDaysByTemplate((current) => {
      const days = current[templateId] ?? [];
      return {
        ...current,
        [templateId]: days.includes(day)
          ? days.filter((candidate) => candidate !== day)
          : [...days, day].sort((left, right) => left - right),
      };
    });
  }, []);

  const performSave = useCallback(async () => {
    if (!name.trim()) {
      showSnackbar('error', t('workouts.plans.validation.nameRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const planMemberships = orderedTemplateIds
        .filter((templateId) => selectedTemplateIds.includes(templateId))
        .map((templateId, position) => ({
          templateId,
          position,
          weekDays: cycleType === 'weekly' ? weekDaysByTemplate[templateId] : undefined,
        }));
      let savedPlanId = planId;
      if (planId) {
        await WorkoutPlanService.updatePlan(planId, {
          name,
          description: description || null,
          cycleType,
          icon: icon ?? null,
        });
        await WorkoutPlanService.setPlanMemberships(planId, planMemberships);
      } else {
        const created = await WorkoutPlanService.createPlan({
          name,
          description,
          cycleType,
          icon,
          memberships: planMemberships,
        });
        savedPlanId = created.id;
      }
      if (savedPlanId) {
        await onSaved?.(savedPlanId);
      }
      showSnackbar('success', t('workouts.plans.saveSuccess'));
      onClose();
    } catch (error) {
      await handleError(error, 'CreateEditPlanModal.save', {
        snackbarMessage: t('workouts.plans.saveError'),
      });
    } finally {
      setIsSaving(false);
      setIsCycleConfirmationVisible(false);
    }
  }, [
    name,
    showSnackbar,
    t,
    orderedTemplateIds,
    selectedTemplateIds,
    cycleType,
    weekDaysByTemplate,
    planId,
    description,
    icon,
    onSaved,
    onClose,
  ]);

  const handleSave = useCallback(() => {
    const hasAssignedDays = selectedTemplateIds.some(
      (templateId) => (weekDaysByTemplate[templateId]?.length ?? 0) > 0
    );
    if (plan?.cycleType === 'weekly' && cycleType === 'rotating' && hasAssignedDays) {
      setIsCycleConfirmationVisible(true);
      return;
    }
    void performSave();
  }, [plan?.cycleType, cycleType, selectedTemplateIds, weekDaysByTemplate, performSave]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={planId ? t('workouts.plans.editTitle') : t('workouts.plans.createTitle')}
      scrollable={false}
      footer={
        <Button
          label={t('common.save')}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
        />
      }
    >
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-32 pt-6"
        bottomOffset={16}
      >
        <TextInput
          label={t('workouts.plans.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('workouts.plans.namePlaceholder')}
        />
        <TextInput
          label={t('workouts.plans.descriptionLabel')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('workouts.plans.descriptionPlaceholder')}
          multiline
          numberOfLines={3}
        />
        <View className="gap-2">
          <Text className="text-sm font-medium text-text-primary">
            {t('workouts.plans.cycleType.label')}
          </Text>
          <SegmentedControl
            options={[
              { label: t('workouts.plans.cycleType.weekly'), value: 'weekly' },
              { label: t('workouts.plans.cycleType.rotating'), value: 'rotating' },
            ]}
            value={cycleType}
            onValueChange={(value) => setCycleType(value as WorkoutPlanCycleType)}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-medium text-text-primary">
            {t('workouts.plans.iconLabel')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {WORKOUT_ICON_OPTIONS.map((option) => {
                const Icon = getWorkoutIcon(option.value);
                const selected = icon === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setIcon(option.value)}
                    className={`h-12 w-12 items-center justify-center rounded-lg ${selected ? 'bg-accent-primary' : 'bg-bg-secondary'}`}
                  >
                    <Icon
                      size={theme.iconSize.md}
                      color={selected ? theme.colors.text.white : theme.colors.text.secondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
        <OptionsMultiSelector
          title={t('workouts.plans.membersLabel')}
          options={templateOptions}
          selectedIds={selectedTemplateIds}
          onChange={handleMembershipChange}
          hasGroups={false}
        />
        {orderedTemplateIds
          .filter((templateId) => selectedTemplateIds.includes(templateId))
          .map((templateId, index, ordered) => {
            const template = templates.find((candidate) => candidate.id === templateId);
            if (!template) {
              return null;
            }
            const days = weekDaysByTemplate[templateId] ?? [];
            return (
              <View key={templateId} className="gap-3 rounded-lg bg-bg-card p-4">
                <View className="flex-row items-center gap-2">
                  <Text className="min-w-0 flex-1 font-semibold text-text-primary">
                    {template.name}
                  </Text>
                  <Pressable
                    onPress={() => moveMember(templateId, -1)}
                    disabled={index === 0}
                    className="p-2"
                  >
                    <ArrowUp
                      size={theme.iconSize.sm}
                      color={index === 0 ? theme.colors.text.tertiary : theme.colors.text.secondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => moveMember(templateId, 1)}
                    disabled={index === ordered.length - 1}
                    className="p-2"
                  >
                    <ArrowDown
                      size={theme.iconSize.sm}
                      color={
                        index === ordered.length - 1
                          ? theme.colors.text.tertiary
                          : theme.colors.text.secondary
                      }
                    />
                  </Pressable>
                </View>
                {cycleType === 'weekly' ? (
                  <>
                    <WeekdayPicker
                      days={getWeekdayLabels()}
                      selectedDays={days}
                      onToggleDay={(day) => toggleMemberDay(templateId, day)}
                    />
                    {days.length === 0 ? (
                      <Text className="text-status-warning text-xs">
                        {t('workouts.plans.unscheduled')}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
      </KeyboardAwareScrollView>
      <ConfirmationModal
        visible={isCycleConfirmationVisible}
        onClose={() => setIsCycleConfirmationVisible(false)}
        onConfirm={performSave}
        title={t('workouts.plans.schedule.clearTitle')}
        message={t('workouts.plans.schedule.clearMessage')}
        confirmLabel={t('workouts.plans.schedule.clearConfirm')}
        isLoading={isSaving}
      />
    </FullScreenModal>
  );
}
