import {
  CalendarDays,
  Dumbbell,
  HeartPulse,
  Repeat,
  Search,
  ThumbsDown,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { FilterTabs } from '@/components/FilterTabs';
import { suggestionsBelongOnTab } from '@/components/modals/replaceSuggestionTab';
import { OptionsSelector, SelectorOption } from '@/components/OptionsSelector';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import {
  EQUIPMENT_LABEL_KEYS,
  FAMILY_LABEL_KEYS,
  INJURY_EXPIRY_LABEL_KEYS,
  REMEMBER_CHOICE_KEYS,
  SUBSTITUTION_REASON_KEYS,
} from '@/components/workout/restrictionLabelKeys';
import Exercise from '@/database/models/Exercise';
import {
  MUSCLE_GROUP_FAMILY,
  type MuscleGroupFamily,
  muscleGroupFamily,
} from '@/database/models/muscleGroupFamily';
import { ExerciseService } from '@/database/services/ExerciseService';
import { ExerciseSuggestionService } from '@/database/services/ExerciseSuggestionService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useExerciseRestrictions } from '@/hooks/useExerciseRestrictions';
import { useExercises } from '@/hooks/useExercises';
import { useTheme } from '@/hooks/useTheme';
import {
  excludedExerciseIds,
  INJURY_EXPIRY_OPTIONS,
  type InjuryExpiryOption,
  injuryExpiryTimestamp,
  isDisliked,
  rankSubstitutes,
  restrictionKindForReason,
  SUBSTITUTION_REASONS,
  type SubstitutionOutcome,
  type SubstitutionReason,
} from '@/utils/exerciseSubstitution';
import {
  getMechanicTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';
import { ALWAYS_AVAILABLE_EQUIPMENT, isEquipmentAvailable } from '@/utils/gym';

/**
 * Exercise data for replacement modal.
 * Uses Pick to extract only needed fields from Exercise model.
 */
export type ReplaceExerciseData = Pick<
  Exercise,
  'id' | 'name' | 'muscleGroup' | 'mechanicType' | 'equipmentType'
> & {
  imageUrl?: string;
};

type ReplaceExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called with the chosen exercise and what the user decided to remember about the swap. */
  onReplace: (exercise: ReplaceExerciseData, outcome: SubstitutionOutcome) => void | Promise<void>;
  /** The exercise being replaced: drives the suggestions and the default region tab. */
  currentExerciseId?: string;
};

type FamilyTab = 'all' | MuscleGroupFamily;
const FAMILY_TABS: readonly FamilyTab[] = ['all', 'torso', 'arms', 'legs', 'core', 'other'];
const SUGGESTION_COUNT = 5;

const REASON_ICONS = {
  equipment_unavailable: Wrench,
  pain: HeartPulse,
  too_hard: TrendingUp,
  too_easy: TrendingDown,
  dislike: ThumbsDown,
  machine_occupied: Users,
  just_today: CalendarDays,
} as const satisfies Record<SubstitutionReason, unknown>;

function exerciseToReplaceData(exercise: Exercise): ReplaceExerciseData {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    mechanicType: exercise.mechanicType,
    equipmentType: exercise.equipmentType,
    imageUrl: exercise.imageUrl?.trim() || undefined,
  };
}

const groupsOfFamily = (family: MuscleGroupFamily): string[] =>
  Object.entries(MUSCLE_GROUP_FAMILY)
    .filter(([, candidate]) => candidate === family)
    .map(([group]) => group);

export function ReplaceExerciseModal({
  visible,
  onClose,
  onReplace,
  currentExerciseId,
}: ReplaceExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { gym } = useActiveGym();
  const { active: restrictions } = useExerciseRestrictions();

  const [searchQuery, setSearchQuery] = useState('');
  const [family, setFamily] = useState<FamilyTab>('all');
  const [current, setCurrent] = useState<Exercise | null>(null);
  const [suggested, setSuggested] = useState<ReplaceExerciseData[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [step, setStep] = useState<'pick' | 'reason'>('pick');
  const [reason, setReason] = useState<SubstitutionReason>('just_today');
  const [rememberChoice, setRememberChoice] = useState(false);
  const [injuryExpiry, setInjuryExpiry] = useState<InjuryExpiryOption>('4w');
  const [removeEquipment, setRemoveEquipment] = useState(false);

  // Start every open on the first step. The previous swap's choices are history, not a default.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const reset = () => {
      setStep('pick');
      setSearchQuery('');
      setReason('just_today');
      setRememberChoice(false);
      setRemoveEquipment(false);
      setInjuryExpiry('4w');
    };

    reset();
  }, [visible]);

  // The exercise being replaced: its body region is the tab the list opens on.
  useEffect(() => {
    if (!visible || !currentExerciseId) {
      return;
    }

    let cancelled = false;
    ExerciseService.getExerciseById(currentExerciseId)
      .then((exercise) => {
        if (cancelled) {
          return;
        }

        setCurrent(exercise);
        setFamily(exercise ? muscleGroupFamily(exercise.muscleGroup) : 'all');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, currentExerciseId]);

  // What the swap list must leave out: the exercise itself, anything never/injury, and (SQL-side,
  // so pages stay full) anything the active gym cannot supply.
  const suggestionContext = useMemo(() => ({ restrictions, gym }), [restrictions, gym]);
  const excludeIds = useMemo(
    () => [...(currentExerciseId ? [currentExerciseId] : []), ...excludedExerciseIds(restrictions)],
    [currentExerciseId, restrictions]
  );
  const equipmentTypes = useMemo(
    () => (gym ? [...gym.equipment, ...ALWAYS_AVAILABLE_EQUIPMENT] : undefined),
    [gym]
  );
  const muscleGroups = useMemo(
    () => (family === 'all' ? undefined : groupsOfFamily(family)),
    [family]
  );

  const {
    exercises: exercisesFromHook,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useExercises({
    mode: 'list',
    visible,
    muscleGroups,
    equipmentTypes,
    excludeIds,
    searchTerm: searchQuery.trim() || undefined,
    initialLimit: 5,
    batchSize: 5,
    enableReactivity: false,
  });

  // Ranked suggestions: same body region, then mechanic and equipment; never a restricted exercise.
  useEffect(() => {
    if (!visible || !current) {
      return;
    }

    let cancelled = false;
    ExerciseSuggestionService.getSuggestibleExercises(undefined, suggestionContext)
      .then(({ exercises }) => {
        if (cancelled) {
          return;
        }

        setSuggested(
          rankSubstitutes(current, exercises, suggestionContext)
            .filter((candidate) => candidate.sameFamily && !candidate.disliked)
            .slice(0, SUGGESTION_COUNT)
            .map((candidate) => exerciseToReplaceData(candidate.exercise))
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, current, suggestionContext]);

  const showSuggestions =
    !searchQuery.trim() &&
    suggested.length > 0 &&
    suggestionsBelongOnTab(family, current ? muscleGroupFamily(current.muscleGroup) : null);
  const suggestedIds = useMemo(
    () => new Set(suggested.map((exercise) => exercise.id)),
    [suggested]
  );

  const displayList: ReplaceExerciseData[] = useMemo(
    () =>
      exercisesFromHook
        .map(exerciseToReplaceData)
        .filter((exercise) => !showSuggestions || !suggestedIds.has(exercise.id)),
    [exercisesFromHook, showSuggestions, suggestedIds]
  );

  const everythingShown = useMemo(
    () => [...(showSuggestions ? suggested : []), ...displayList],
    [showSuggestions, suggested, displayList]
  );

  useEffect(() => {
    const syncSelection = () => {
      if (everythingShown.length === 0) {
        setSelectedExercise('');
        return;
      }

      if (!everythingShown.some((exercise) => exercise.id === selectedExercise)) {
        setSelectedExercise(everythingShown[0].id);
      }
    };

    syncSelection();
  }, [everythingShown, selectedExercise]);

  const dislikedIds = useMemo(
    () =>
      new Set(
        restrictions
          .map((restriction) => restriction.exerciseId)
          .filter((id) => isDisliked(id, restrictions))
      ),
    [restrictions]
  );

  const toOption = (exercise: ReplaceExerciseData): SelectorOption<string> => {
    const muscleGroupLabel = t(getMuscleGroupTranslationKey(exercise.muscleGroup));
    const mechanicLabel = t(getMechanicTypeTranslationKey(exercise.mechanicType));
    return {
      id: exercise.id,
      label: exercise.name,
      description: dislikedIds.has(exercise.id)
        ? `${muscleGroupLabel} • ${mechanicLabel} • ${t('replaceExercise.disliked')}`
        : `${muscleGroupLabel} • ${mechanicLabel}`,
      icon: Dumbbell,
      iconBgColor: theme.colors.background.iconDark,
      iconColor: theme.colors.text.primary,
      imageUrl: exercise.imageUrl,
    };
  };

  const tabs = FAMILY_TABS.map((id) => ({ id, label: t(FAMILY_LABEL_KEYS[id]) }));

  const chosen = everythingShown.find((exercise) => exercise.id === selectedExercise);
  const removableEquipment =
    gym && current && !ALWAYS_AVAILABLE_EQUIPMENT.includes(current.equipmentType)
      ? isEquipmentAvailable(current.equipmentType, gym)
      : false;
  const impliedKind = restrictionKindForReason(reason);

  const selectReason = (next: SubstitutionReason) => {
    setReason(next);
    // Pain and dislike default to remembering, because the whole point of saying why is that the
    // app stops offering it. It stays a visible, switchable choice — never applied silently.
    setRememberChoice(restrictionKindForReason(next) !== null);
    setRemoveEquipment(false);
  };

  const handleConfirm = async () => {
    if (!chosen) {
      return;
    }

    const kind = rememberChoice ? impliedKind : null;
    // The host closes the sheet once the swap succeeded; a failed swap leaves it open to retry.
    await onReplace(chosen, {
      reason,
      ...(kind
        ? {
            restriction: {
              kind,
              expiresAt: kind === 'injury' ? injuryExpiryTimestamp(injuryExpiry) : null,
            },
          }
        : {}),
      ...(removeEquipment && reason === 'equipment_unavailable' && removableEquipment
        ? { removeEquipmentFromGym: true }
        : {}),
    });
  };

  const reasonOptions: SelectorOption<SubstitutionReason>[] = SUBSTITUTION_REASONS.map((id) => ({
    id,
    label: t(SUBSTITUTION_REASON_KEYS[id].label),
    description: t(SUBSTITUTION_REASON_KEYS[id].description),
    icon: REASON_ICONS[id],
    iconBgColor: theme.colors.background.iconDark,
    iconColor: theme.colors.text.primary,
  }));

  const showSpinner = isLoading && everythingShown.length === 0;
  const showEmpty = !isLoading && everythingShown.length === 0;

  const pickFooter = (
    <View className="flex-row items-stretch gap-3">
      <Button
        label={t('replaceExercise.addReason')}
        variant="outline"
        size="sm"
        width="auto"
        onPress={() => setStep('reason')}
        disabled={!chosen}
      />
      {/* The reason is optional: Replace alone swaps for today, which is the default reason. */}
      <Button
        label={t('replaceExercise.replace')}
        icon={Repeat}
        size="sm"
        width="flex-1"
        onPress={handleConfirm}
        disabled={!chosen}
        testID="replace-now"
      />
    </View>
  );

  const reasonFooter = (
    <View className="flex-row items-stretch gap-3">
      <Button
        label={t('replaceExercise.back')}
        variant="outline"
        size="sm"
        width="flex-1"
        onPress={() => setStep('pick')}
      />
      <Button
        label={t('replaceExercise.replace')}
        icon={Repeat}
        size="sm"
        width="flex-2"
        onPress={handleConfirm}
      />
    </View>
  );

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={step === 'pick' ? t('replaceExercise.title') : t('replaceExercise.reason.title')}
      subtitle={
        step === 'reason' && chosen
          ? t('replaceExercise.reason.subtitle', { name: chosen.name })
          : undefined
      }
      maxHeight="85%"
      scrollable={false}
      footer={step === 'pick' ? pickFooter : reasonFooter}
    >
      {step === 'pick' ? (
        <View style={{ flex: 1 }}>
          {/* Sticky: Search and Filters */}
          <View className="gap-3" style={{ paddingBottom: theme.spacing.padding.sm }}>
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('replaceExercise.searchPlaceholder')}
              icon={
                <Search
                  size={theme.iconSize.lg}
                  color={searchQuery ? theme.colors.accent.primary : theme.colors.text.tertiary}
                />
              }
            />

            <FilterTabs
              tabs={tabs}
              activeTab={family}
              onTabChange={(id) => setFamily(id as FamilyTab)}
              showContainer={false}
              scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
            />
          </View>

          {/* Scrollable: Exercise list only */}
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: theme.spacing.padding.xl,
              paddingTop: theme.spacing.padding.sm,
            }}
            bottomOffset={16}
          >
            {showSpinner ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : null}
            {showEmpty ? (
              <Text
                className="py-8 text-center"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {t('replaceExercise.noExercisesMatch')}
              </Text>
            ) : null}
            {everythingShown.length > 0 ? (
              <>
                {showSuggestions ? (
                  <OptionsSelector
                    title={t('replaceExercise.suggested')}
                    options={suggested.map(toOption)}
                    selectedId={selectedExercise}
                    onSelect={(id) => setSelectedExercise(id)}
                  />
                ) : null}
                {displayList.length > 0 ? (
                  <OptionsSelector
                    title={t('replaceExercise.selectExercise')}
                    options={displayList.map(toOption)}
                    selectedId={selectedExercise}
                    onSelect={(id) => setSelectedExercise(id)}
                  />
                ) : null}
                {hasMore ? (
                  <View className="py-4">
                    <Button
                      label={
                        isLoadingMore
                          ? t('replaceExercise.loadingMore')
                          : t('replaceExercise.loadMore')
                      }
                      onPress={loadMore}
                      size="sm"
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                      width="full"
                      iconPosition="left"
                    />
                  </View>
                ) : null}
                {restrictions.length > 0 || gym ? (
                  <Text
                    className="pt-2 text-center text-xs"
                    style={{ color: theme.colors.text.tertiary }}
                  >
                    {t('replaceExercise.hiddenHint')}
                  </Text>
                ) : null}
              </>
            ) : null}
          </KeyboardAwareScrollView>
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: theme.spacing.padding.xl }}
          bottomOffset={16}
        >
          <View className="gap-4" testID="replace-reason-step">
            <OptionsSelector
              title={t('replaceExercise.reason.question')}
              options={reasonOptions}
              selectedId={reason}
              onSelect={selectReason}
            />

            {impliedKind ? (
              <View className="gap-3">
                <ToggleInput
                  items={[
                    {
                      key: 'remember',
                      label: t(REMEMBER_CHOICE_KEYS[impliedKind].label, {
                        name: current?.name ?? '',
                      }),
                      subtitle: t(REMEMBER_CHOICE_KEYS[impliedKind].hint),
                      value: rememberChoice,
                      onValueChange: setRememberChoice,
                    },
                  ]}
                />
                {rememberChoice && impliedKind === 'injury' ? (
                  <View className="flex-row flex-wrap gap-2">
                    {INJURY_EXPIRY_OPTIONS.map((option) => {
                      const selected = injuryExpiry === option;
                      return (
                        <Chip
                          key={option}
                          selected={selected}
                          onPress={() => setInjuryExpiry(option)}
                          label={t(INJURY_EXPIRY_LABEL_KEYS[option])}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {reason === 'equipment_unavailable' && removableEquipment && gym && current ? (
              <ToggleInput
                items={[
                  {
                    key: 'removeEquipment',
                    label: t('replaceExercise.reason.removeEquipment', {
                      equipment: t(EQUIPMENT_LABEL_KEYS[current.equipmentType]),
                      gym: gym.name,
                    }),
                    subtitle: t('replaceExercise.reason.removeEquipmentHint'),
                    value: removeEquipment,
                    onValueChange: setRemoveEquipment,
                  },
                ]}
              />
            ) : null}
          </View>
        </KeyboardAwareScrollView>
      )}
    </BottomPopUpMenu>
  );
}
