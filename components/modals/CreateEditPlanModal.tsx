import { ArrowDown, ArrowUp, X } from 'lucide-react-native';
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

/**
 * How many workouts the picker renders per page. The library is unbounded — every workout the user
 * has ever made is a candidate for a plan — and rendering them all pushed the plan's own membership
 * list far below the fold.
 */
const WORKOUT_PICKER_PAGE_SIZE = 10;

/**
 * One row of the plan's membership: which workout, and (for a weekly plan) which days.
 *
 * Membership, order and schedule are ONE concept and so are one piece of state: the array order is
 * the plan order, presence in the array is selection, and `weekDays` rides along. Holding them as
 * three parallel structures — a selected-id set, an ordered-id list and an id → days record — meant
 * every read had to re-intersect them, and the intersection was written out twice.
 */
interface PlanMemberDraft {
  templateId: string;
  weekDays: number[];
}

interface CreateEditPlanModalProps {
  visible: boolean;
  planId?: string;
  /**
   * Workouts a NEW plan starts out containing. The plan and this membership are created in one
   * `WorkoutPlanService.createPlan` call, so "create a plan from this workout" cannot half-succeed
   * and leave an empty plan behind. Ignored when editing, where the stored membership wins.
   */
  initialTemplateIds?: string[];
  onClose: () => void;
  onSaved?: (planId: string) => void;
}

export function CreateEditPlanModal({
  visible,
  planId,
  initialTemplateIds,
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
  const [members, setMembers] = useState<PlanMemberDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCycleConfirmationVisible, setIsCycleConfirmationVisible] = useState(false);
  const [visibleWorkoutCount, setVisibleWorkoutCount] = useState(WORKOUT_PICKER_PAGE_SIZE);

  // Closing rewinds the picker so a reopen starts at the first page. Deliberately not folded into
  // the load effect below, which re-runs on every membership emission and would collapse the picker
  // under the user mid-edit.
  useEffect(() => {
    if (visible) {
      return;
    }

    const rewindPicker = () => {
      setVisibleWorkoutCount(WORKOUT_PICKER_PAGE_SIZE);
    };

    rewindPicker();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const loadPlan = () => {
      setName(plan?.name ?? '');
      setDescription(plan?.description ?? '');
      setCycleType(plan?.cycleType ?? 'weekly');
      setIcon(plan?.icon);
      setMembers(
        planId
          ? memberships
              .filter((membership) => membership.planId === planId)
              .sort((left, right) => left.position - right.position)
              .map((membership) => ({
                templateId: membership.templateId,
                weekDays: membership.weekDays ?? [],
              }))
          : (initialTemplateIds ?? []).map((templateId) => ({ templateId, weekDays: [] }))
      );
    };
    loadPlan();
  }, [visible, planId, plan, memberships, initialTemplateIds]);

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

  const visibleTemplateOptions = useMemo(
    () => templateOptions.slice(0, visibleWorkoutCount),
    [templateOptions, visibleWorkoutCount]
  );

  const selectedTemplateIds = useMemo(() => members.map((member) => member.templateId), [members]);

  /** Ticking a workout appends it; unticking drops it. Existing rows keep their order and days. */
  const handleSelectionChange = useCallback((ids: string[]) => {
    setMembers((current) => [
      ...current.filter((member) => ids.includes(member.templateId)),
      ...ids
        .filter((id) => !current.some((member) => member.templateId === id))
        .map((templateId) => ({ templateId, weekDays: [] })),
    ]);
  }, []);

  const removeMember = useCallback((templateId: string) => {
    setMembers((current) => current.filter((member) => member.templateId !== templateId));
  }, []);

  const toggleMemberDay = useCallback((templateId: string, day: number) => {
    setMembers((current) =>
      current.map((member) =>
        member.templateId === templateId
          ? {
              ...member,
              weekDays: member.weekDays.includes(day)
                ? member.weekDays.filter((candidate) => candidate !== day)
                : [...member.weekDays, day].sort((left, right) => left - right),
            }
          : member
      )
    );
  }, []);

  /**
   * The members that have a workout to render. One whose workout is missing from `templates`
   * (archived, say) stays in `members` so saving does not silently unfile it — it simply has
   * nothing to draw.
   */
  const visibleMembers = useMemo(
    () =>
      members.flatMap((member) => {
        const template = templates.find((candidate) => candidate.id === member.templateId);
        return template ? [{ ...member, template }] : [];
      }),
    [members, templates]
  );

  /** Swaps with the neighbouring VISIBLE member, so an invisible row cannot swallow a tap. */
  const moveMember = useCallback(
    (templateId: string, direction: -1 | 1) => {
      const visibleIndex = visibleMembers.findIndex((member) => member.templateId === templateId);
      const neighbour = visibleMembers[visibleIndex + direction];
      if (visibleIndex < 0 || !neighbour) {
        return;
      }

      setMembers((current) => {
        const from = current.findIndex((member) => member.templateId === templateId);
        const to = current.findIndex((member) => member.templateId === neighbour.templateId);
        if (from < 0 || to < 0) {
          return current;
        }
        const next = [...current];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    },
    [visibleMembers]
  );

  const performSave = useCallback(async () => {
    if (!name.trim()) {
      showSnackbar('error', t('workouts.plans.validation.nameRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const planMemberships = members.map((member, position) => ({
        templateId: member.templateId,
        position,
        weekDays: cycleType === 'weekly' ? member.weekDays : undefined,
      }));

      if (planId) {
        await WorkoutPlanService.savePlan(
          planId,
          { name, description: description || null, cycleType, icon: icon ?? null },
          planMemberships
        );
        onSaved?.(planId);
      } else {
        // Fields and membership in one call: a plan created from a workout's picker is never
        // committed empty and then filled by a second transaction that might fail on its own.
        const created = await WorkoutPlanService.createPlan({
          name,
          description,
          cycleType,
          icon,
          memberships: planMemberships,
        });
        onSaved?.(created.id);
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
  }, [name, showSnackbar, t, members, cycleType, planId, description, icon, onSaved, onClose]);

  const handleSave = useCallback(() => {
    const hasAssignedDays = members.some((member) => member.weekDays.length > 0);
    if (plan?.cycleType === 'weekly' && cycleType === 'rotating' && hasAssignedDays) {
      setIsCycleConfirmationVisible(true);
      return;
    }
    void performSave();
  }, [plan?.cycleType, cycleType, members, performSave]);

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
      {/*
        Padding lives on an inner View, not on `contentContainerClassName`: NativeWind only maps
        that prop for the components it registers (RN's ScrollView/FlatList/VirtualizedList), and
        `KeyboardAwareScrollView` is not one of them — so the classes were silently dropped and the
        form rendered edge to edge with the last row hidden under the footer.
      */}
      <KeyboardAwareScrollView className="flex-1" bottomOffset={16}>
        <View className="gap-5 px-4 pb-32 pt-6">
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
            <Text className="ml-1 text-sm font-medium text-text-secondary">
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
            <Text className="ml-1 text-sm font-medium text-text-secondary">
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
          {/*
            This selector lists EVERY workout in the library, not the plan's members — ticking one
            adds it, unticking removes it. It used to carry the "Workouts in this plan" heading,
            which read as a member list you could only shrink: an unticked workout stayed on screen,
            so removal looked like it had not been saved and there was no obvious way to add one.
            The plan's actual membership is the separate, shorter list below.
          */}
          <OptionsMultiSelector
            title={t('workouts.plans.selectorLabel')}
            options={visibleTemplateOptions}
            selectedIds={selectedTemplateIds}
            onChange={handleSelectionChange}
            hasGroups={false}
          />
          {templateOptions.length > visibleWorkoutCount ? (
            <View className="items-center">
              <Button
                label={t('common.loadMore')}
                variant="outline"
                size="sm"
                width="auto"
                onPress={() =>
                  setVisibleWorkoutCount((current) => current + WORKOUT_PICKER_PAGE_SIZE)
                }
              />
            </View>
          ) : null}
          <View className="gap-3">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('workouts.plans.membersLabel')}
            </Text>
            {visibleMembers.length === 0 ? (
              <Text className="ml-1 text-xs text-text-tertiary">
                {t('workouts.plans.membersEmpty')}
              </Text>
            ) : null}
            {visibleMembers.map((member, index) => (
              <View key={member.templateId} className="gap-3 rounded-lg bg-bg-card p-4">
                <View className="flex-row items-center gap-2">
                  <Text className="min-w-0 flex-1 font-semibold text-text-primary">
                    {member.template.name}
                  </Text>
                  <Pressable
                    onPress={() => moveMember(member.templateId, -1)}
                    disabled={index === 0}
                    className="p-2"
                  >
                    <ArrowUp
                      size={theme.iconSize.sm}
                      color={index === 0 ? theme.colors.text.tertiary : theme.colors.text.secondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => moveMember(member.templateId, 1)}
                    disabled={index === visibleMembers.length - 1}
                    className="p-2"
                  >
                    <ArrowDown
                      size={theme.iconSize.sm}
                      color={
                        index === visibleMembers.length - 1
                          ? theme.colors.text.tertiary
                          : theme.colors.text.secondary
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => removeMember(member.templateId)}
                    className="p-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.plans.removeMember')}
                  >
                    <X size={theme.iconSize.sm} color={theme.colors.status.error} />
                  </Pressable>
                </View>
                {cycleType === 'weekly' ? (
                  <>
                    <WeekdayPicker
                      days={getWeekdayLabels()}
                      selectedDays={member.weekDays}
                      onToggleDay={(day) => toggleMemberDay(member.templateId, day)}
                    />
                    {member.weekDays.length === 0 ? (
                      <Text className="text-status-warning text-xs">
                        {t('workouts.plans.unscheduled')}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            ))}
          </View>
        </View>
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
