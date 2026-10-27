import { differenceInCalendarDays } from 'date-fns';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { ListRow } from '@/components/theme/ListRow';
import { NumericTextField } from '@/components/theme/NumericTextField';
import { TextButton } from '@/components/theme/TextButton';
import { WeekdayPicker } from '@/components/theme/WeekdayPicker';
import { WELLBEING_SUPPORT_URL } from '@/constants/misc';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { ComebackService } from '@/database/services/ComebackService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { type ComebackSetupResult, startComeback } from '@/services/comebackSetup';
import {
  BREAK_LENGTH_LABEL_KEYS,
  type ComebackKey,
  DAYS_CHOICES,
  EATING_LABEL_KEYS,
  ENERGY_LABEL_KEYS,
  NUTRITION_GOAL_LABEL_KEYS,
  START_CHOICE_LABEL_KEYS,
  STEP_COPY,
  TRACK_LABEL_KEYS,
  TRACKING_LABEL_KEYS,
  WHERE_LABEL_KEYS,
} from '@/utils/comeback/comebackCopy';
import {
  COMEBACK_TIME_CHOICES,
  DEFAULT_COMEBACK_TIME,
  hasIfThenCue,
  planWeeks,
  showsLongBreakNote,
} from '@/utils/comeback/comebackPlanSummary';
import { type SetupMode, type SetupStepKey, setupSteps } from '@/utils/comeback/comebackSetupSteps';
import {
  BREAK_LENGTHS,
  COMEBACK_EATING,
  COMEBACK_ENERGY,
  COMEBACK_NUTRITION_GOALS,
  COMEBACK_START_CHOICES,
  COMEBACK_TRACKING_DEPTHS,
  COMEBACK_TRACKS,
  type ComebackAnswers,
  type ComebackTrack,
  tracksNutrition,
  tracksWorkouts,
} from '@/utils/comeback/comebackState';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { handleError } from '@/utils/handleError';
import { getDecimalSeparator, parseStrictLocalizedNumber } from '@/utils/localizedDecimalInput';
import { inferTrainingLocation, TRAINING_LOCATIONS } from '@/utils/onboardingTraining';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

export type ComebackSetupModalProps = {
  visible: boolean;
  onClose: () => void;
  mode?: SetupMode;
  /** Whole days since the last workout / food log, when the offer detected a break. */
  workoutGapDays?: number | null;
  foodGapDays?: number | null;
  /** The half(s) that lapsed; the track starts on it. */
  suggestedTrack?: ComebackTrack | null;
  /** The break length the gap implies; the person can change it. */
  detectedBreak?: ComebackAnswers['breakLength'];
  /** Answers already known (onboarding, or the running comeback when editing). */
  initialAnswers?: ComebackAnswers;
  initialTrack?: ComebackTrack;
  /** Called once the comeback has started (or the edit saved), with what setup did. */
  onDone: (result: ComebackSetupResult | null) => void;
};

const NO_ANSWERS: ComebackAnswers = {};

const GOAL_HINT_KEYS: Record<(typeof COMEBACK_NUTRITION_GOALS)[number], ComebackKey> = {
  regular: 'comeback.setup.goal.regularHint',
  loseSlowly: 'comeback.setup.goal.loseSlowlyHint',
  rebuild: 'comeback.setup.goal.rebuildHint',
  keep: 'comeback.setup.goal.keepHint',
};

const START_HINT_KEYS: Record<(typeof COMEBACK_START_CHOICES)[number], ComebackKey> = {
  ownPlan: 'comeback.setup.start.ownPlanHint',
  shortPlan: 'comeback.setup.start.shortPlanHint',
  chooseLater: 'comeback.setup.start.chooseLaterHint',
};

const TRACKING_HINT_KEYS: Record<(typeof COMEBACK_TRACKING_DEPTHS)[number], ComebackKey> = {
  full: 'comeback.setup.tracking.fullHint',
  caloriesProtein: 'comeback.setup.tracking.caloriesProteinHint',
  mealsOnly: 'comeback.setup.tracking.mealsOnlyHint',
};

const ENERGY_HINT_KEYS: Record<(typeof COMEBACK_ENERGY)[number], ComebackKey> = {
  plenty: 'comeback.setup.energy.plentyHint',
  some: 'comeback.setup.energy.someHint',
  low: 'comeback.setup.energy.lowHint',
};

/** Steps that are questions: each can be skipped, which clears its answer. */
const SKIPPABLE: readonly SetupStepKey[] = [
  'where',
  'days',
  'start',
  'eating',
  'tracking',
  'goal',
  'energy',
];

function ComebackSetupBody({
  visible,
  onClose,
  mode = 'start',
  workoutGapDays = null,
  foodGapDays = null,
  suggestedTrack = null,
  detectedBreak,
  initialAnswers = NO_ANSWERS,
  initialTrack,
  onDone,
}: ComebackSetupModalProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const { gym } = useActiveGym();
  const { locale, formatInteger } = useFormatAppNumber();

  const [track, setTrack] = useState<ComebackTrack>(initialTrack ?? suggestedTrack ?? 'both');
  const [answers, setAnswers] = useState<ComebackAnswers>({
    ...initialAnswers,
    breakLength: initialAnswers.breakLength ?? detectedBreak,
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [weightText, setWeightText] = useState('');
  const [setWeeklyGoal, setSetWeeklyGoal] = useState(false);
  const [switchDiary, setSwitchDiary] = useState(false);
  const [hasWorkouts, setHasWorkouts] = useState(false);
  const [hasGoal, setHasGoal] = useState(false);
  const [latestWeight, setLatestWeight] = useState<{ weightKg: number; date: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      ComebackService.hasWorkouts().catch(() => false),
      NutritionGoalService.getCurrent().catch(() => null),
      ComebackNutritionService.latestWeight().catch(() => null),
    ]).then(([workouts, goal, weight]) => {
      if (cancelled) {
        return;
      }

      setHasWorkouts(workouts);
      setHasGoal(!!goal);
      setLatestWeight(weight);
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // The "where" question starts on the answer the active gym profile already gives.
  const inferredLocation = gym ? inferTrainingLocation(gym.equipment) : undefined;
  const resolvedAnswers = useMemo<ComebackAnswers>(
    () =>
      answers.location || !inferredLocation ? answers : { ...answers, location: inferredLocation },
    [answers, inferredLocation]
  );

  const steps = useMemo(
    () => setupSteps({ mode, track, prefill: mode === 'edit' ? NO_ANSWERS : initialAnswers }),
    [mode, track, initialAnswers]
  );
  const stepKey = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  const patch = useCallback(
    (change: Partial<ComebackAnswers>) => setAnswers((current) => ({ ...current, ...change })),
    []
  );
  const clear = useCallback((key: keyof ComebackAnswers) => {
    setAnswers((current) => {
      const next = { ...current };
      delete next[key];

      return next;
    });
  }, []);

  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + index))
      ),
    [locale]
  );
  const weekdayLong = useCallback(
    (index: number) =>
      new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 1 + index)),
    [locale]
  );

  const toggleWeekDay = (index: number) =>
    setAnswers((current) => {
      const days = new Set(current.weekDays ?? []);
      if (days.has(index)) {
        days.delete(index);
      } else {
        days.add(index);
      }

      const sorted = [...days].sort((a, b) => a - b);
      const next = { ...current };
      if (sorted.length > 0) {
        next.weekDays = sorted;
        next.time = next.time ?? DEFAULT_COMEBACK_TIME;
      } else {
        delete next.weekDays;
      }

      return next;
    });

  const parsedWeightKg = (() => {
    const value = parseStrictLocalizedNumber(weightText, getDecimalSeparator(locale));

    return value !== null && value > 0 ? displayToKg(value, units) : null;
  })();
  const weightProblem = weightText.trim() !== '' && parsedWeightKg === null;

  const goNext = () => {
    if (!isLast) {
      setStepIndex((index) => index + 1);
    }
  };

  const goBack = () => {
    if (isFirst) {
      onClose();

      return;
    }

    setStepIndex((index) => index - 1);
  };

  const skip = () => {
    const cleared: Partial<Record<SetupStepKey, (keyof ComebackAnswers)[]>> = {
      where: ['location'],
      days: ['daysPerWeek', 'weekDays', 'time'],
      start: ['start'],
      eating: ['eating'],
      tracking: ['tracking'],
      goal: ['nutritionGoal'],
      energy: ['energy'],
    };
    for (const key of cleared[stepKey] ?? []) {
      clear(key);
    }

    goNext();
  };

  const finish = async () => {
    setBusy(true);
    setFailed([]);
    try {
      if (mode === 'edit') {
        await ComebackService.updateAnswers({ track, answers: resolvedAnswers });
        if (tracksNutrition(track)) {
          await ComebackNutritionService.apply(resolvedAnswers, { applyDeficit: false });
        }

        onDone(null);

        return;
      }

      const depth = resolvedAnswers.tracking;
      const result = await startComeback({
        track,
        answers: resolvedAnswers,
        todayWeightKg: tracksNutrition(track) ? parsedWeightKg : null,
        setWeeklyGoal,
        applyTrackingDepth: switchDiary && depth && depth !== 'full' ? depth : null,
      });
      if (result.failures.length > 0) {
        setFailed(result.failures);
      }

      onDone(result);
    } catch (error) {
      await handleError(error, 'comebackSetup.finish', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const choices = <K extends string>(
    values: readonly K[],
    selected: K | undefined,
    onPick: (value: K) => void,
    label: (value: K) => ComebackKey,
    hint?: (value: K) => ComebackKey
  ) => (
    <View className="gap-2">
      {values.map((value) => (
        <ListRow
          key={value}
          title={t(label(value))}
          subtitle={hint ? t(hint(value)) : undefined}
          selected={selected === value}
          onPress={() => onPick(value)}
          testID={`comeback-choice-${value}`}
        />
      ))}
    </View>
  );

  const renderIntro = () => {
    const lines: string[] = [];
    if (workoutGapDays !== null && workoutGapDays >= 14) {
      lines.push(t('comeback.setup.intro.workoutGap', { count: workoutGapDays }));
    }

    if (foodGapDays !== null && foodGapDays >= 14) {
      lines.push(t('comeback.setup.intro.foodGap', { count: foodGapDays }));
    }

    return (
      <View className="gap-5">
        {lines.length > 0 ? (
          <View className="gap-1">
            {lines.map((line) => (
              <Text key={line} className="text-lg font-semibold text-text-primary">
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        <Text className="text-base text-text-secondary">{t('comeback.setup.intro.body')}</Text>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-text-secondary">
            {t('comeback.setup.intro.howLong')}
          </Text>
          {choices(
            BREAK_LENGTHS,
            resolvedAnswers.breakLength,
            (value) => patch({ breakLength: value }),
            (value) => BREAK_LENGTH_LABEL_KEYS[value]
          )}
        </View>
      </View>
    );
  };

  const renderDays = () => {
    const picked = resolvedAnswers.weekDays ?? [];
    const selectedLabel = picked.map((day) => weekdayLong(day)).join(', ');

    return (
      <View className="gap-5">
        <View className="gap-2">
          {DAYS_CHOICES.map((choice) => (
            <ListRow
              key={choice.value}
              title={t(choice.labelKey)}
              subtitle={
                'recommended' in choice && choice.recommended
                  ? t('comeback.setup.days.recommended')
                  : undefined
              }
              selected={resolvedAnswers.daysPerWeek === choice.value}
              onPress={() => patch({ daysPerWeek: choice.value })}
              testID={`comeback-days-${choice.value}`}
            />
          ))}
        </View>
        <View className="gap-3">
          <Text className="text-sm font-semibold text-text-secondary">
            {t('comeback.setup.days.pickDays')}
          </Text>
          <WeekdayPicker days={weekdayLabels} selectedDays={picked} onToggleDay={toggleWeekDay} />
          {picked.length > 0 ? (
            <>
              <Text className="text-sm text-text-secondary">{selectedLabel}</Text>
              <Text className="text-sm font-semibold text-text-secondary">
                {t('comeback.setup.days.pickTime')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {COMEBACK_TIME_CHOICES.map((time) => (
                  <Chip
                    key={time}
                    label={time}
                    selected={(resolvedAnswers.time ?? DEFAULT_COMEBACK_TIME) === time}
                    onPress={() => patch({ time })}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </View>
    );
  };

  const renderStart = () => (
    <View className="gap-2">
      {COMEBACK_START_CHOICES.filter((choice) => choice !== 'ownPlan' || hasWorkouts).map(
        (choice) => (
          <ListRow
            key={choice}
            title={t(START_CHOICE_LABEL_KEYS[choice])}
            subtitle={t(START_HINT_KEYS[choice])}
            selected={resolvedAnswers.start === choice}
            onPress={() => patch({ start: choice })}
            testID={`comeback-choice-${choice}`}
          />
        )
      )}
    </View>
  );

  const renderGoal = () => (
    <View className="gap-5">
      {choices(
        COMEBACK_NUTRITION_GOALS.filter((goal) => goal !== 'keep' || hasGoal),
        resolvedAnswers.nutritionGoal,
        (value) => patch({ nutritionGoal: value }),
        (value) => NUTRITION_GOAL_LABEL_KEYS[value],
        (value) => GOAL_HINT_KEYS[value]
      )}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-text-secondary">
          {t('comeback.setup.goal.weightTitle')}
        </Text>
        {latestWeight ? (
          <Text className="text-sm text-text-secondary">
            {t('comeback.setup.goal.latestWeight', {
              weight: formatDisplayWeightKg(locale, units, latestWeight.weightKg),
              unit: t(getWeightUnitI18nKey(units)),
              count: Math.max(0, differenceInCalendarDays(new Date(), latestWeight.date)),
            })}
          </Text>
        ) : null}
        <NumericTextField
          value={weightText}
          onChangeText={setWeightText}
          accessibilityLabel={t('comeback.setup.goal.weightLabel')}
          placeholder={
            latestWeight
              ? formatDisplayWeightKg(locale, units, latestWeight.weightKg)
              : formatInteger(Math.round(kgToDisplay(75, units)))
          }
          invalid={weightProblem}
          testID="comeback-weight"
        />
        <Text className="text-xs text-text-tertiary">{t('comeback.setup.goal.weightHint')}</Text>
      </View>
    </View>
  );

  const renderEnergy = () => (
    <View className="gap-5">
      {choices(
        COMEBACK_ENERGY,
        resolvedAnswers.energy,
        (value) => patch({ energy: value }),
        (value) => ENERGY_LABEL_KEYS[value],
        (value) => ENERGY_HINT_KEYS[value]
      )}
      <TextButton
        label={t('comeback.setup.energy.support')}
        onPress={() => void Linking.openURL(WELLBEING_SUPPORT_URL)}
      />
    </View>
  );

  const renderPlan = () => {
    const rows = planWeeks(resolvedAnswers);
    const days = resolvedAnswers.weekDays ?? [];
    const cueDays = days.map((day) => weekdayLong(day)).join(', ');
    const depth = resolvedAnswers.tracking;

    return (
      <View className="gap-5">
        {tracksWorkouts(track) ? (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-text-secondary">
              {t('comeback.plan.programTitle')}
            </Text>
            {rows.map((row) => (
              <View
                key={row.week}
                className="rounded-control border border-border-light bg-bg-card p-3"
              >
                <Text className="text-sm font-semibold text-text-primary">
                  {t('comeback.plan.weekLabel', { week: row.week })}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {row.sets === null
                    ? t('comeback.plan.weekRowPlanSets', {
                        rir: row.rir,
                        percent: row.percent,
                      })
                    : t('comeback.plan.weekRow', {
                        count: row.sets,
                        rir: row.rir,
                        percent: row.percent,
                      })}
                  {row.sessions !== null
                    ? ` ${t('comeback.plan.sessions', { count: row.sessions })}`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {hasIfThenCue(resolvedAnswers) ? (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-text-secondary">
              {t('comeback.plan.cueTitle')}
            </Text>
            <Text className="text-base text-text-primary">
              {t('comeback.plan.cue', {
                days: cueDays,
                time: resolvedAnswers.time ?? DEFAULT_COMEBACK_TIME,
              })}
            </Text>
          </View>
        ) : null}
        <View className="gap-1">
          <Text className="text-sm font-semibold text-text-secondary">
            {t('comeback.plan.missTitle')}
          </Text>
          <Text className="text-base text-text-primary">{t('comeback.plan.missRule')}</Text>
        </View>
        {tracksNutrition(track) && resolvedAnswers.nutritionGoal === 'loseSlowly' ? (
          <Text className="text-sm text-text-secondary">{t('comeback.plan.maintenanceFirst')}</Text>
        ) : null}
        {tracksWorkouts(track) && resolvedAnswers.daysPerWeek && mode === 'start' ? (
          <ListRow
            title={t('comeback.plan.setGoal', { count: resolvedAnswers.daysPerWeek })}
            selected={setWeeklyGoal}
            onPress={() => setSetWeeklyGoal((value) => !value)}
            testID="comeback-set-goal"
          />
        ) : null}
        {tracksNutrition(track) && depth && depth !== 'full' && mode === 'start' ? (
          <ListRow
            title={t('comeback.plan.switchDiary')}
            subtitle={t(TRACKING_LABEL_KEYS[depth])}
            selected={switchDiary}
            onPress={() => setSwitchDiary((value) => !value)}
            testID="comeback-switch-diary"
          />
        ) : null}
        {showsLongBreakNote(resolvedAnswers) ? (
          <Text className="text-sm text-text-secondary">{t('comeback.plan.longBreakNote')}</Text>
        ) : null}
        {failed.length > 0 ? (
          <Text accessibilityRole="alert" className="text-sm text-status-error">
            {t('comeback.plan.partialFailure')}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderStep = () => {
    switch (stepKey) {
      case 'intro':
        return renderIntro();
      case 'track':
        return choices(COMEBACK_TRACKS, track, setTrack, (value) => TRACK_LABEL_KEYS[value]);
      case 'where':
        return choices(
          TRAINING_LOCATIONS,
          resolvedAnswers.location,
          (value) => patch({ location: value }),
          (value) => WHERE_LABEL_KEYS[value]
        );
      case 'days':
        return renderDays();
      case 'start':
        return renderStart();
      case 'eating':
        return choices(
          COMEBACK_EATING,
          resolvedAnswers.eating,
          (value) => patch({ eating: value }),
          (value) => EATING_LABEL_KEYS[value]
        );
      case 'tracking':
        return choices(
          COMEBACK_TRACKING_DEPTHS,
          resolvedAnswers.tracking,
          (value) => patch({ tracking: value }),
          (value) => TRACKING_LABEL_KEYS[value],
          (value) => TRACKING_HINT_KEYS[value]
        );
      case 'goal':
        return renderGoal();
      case 'energy':
        return renderEnergy();
      case 'plan':
        return renderPlan();
    }
  };

  const copy = STEP_COPY[stepKey];
  const nextLabel = isLast
    ? t(mode === 'edit' ? 'comeback.setup.save' : 'comeback.setup.start')
    : t('common.next');

  const footer = (
    <View className="gap-3">
      {SKIPPABLE.includes(stepKey) ? (
        <TextButton label={t('comeback.setup.skip')} onPress={skip} />
      ) : null}
      <View className="flex-row gap-3">
        <Button
          label={isFirst ? t('common.cancel') : t('common.back')}
          variant="outline"
          size="md"
          width="flex-1"
          icon={isFirst ? undefined : ChevronLeft}
          iconPosition="left"
          onPress={goBack}
        />
        <Button
          label={nextLabel}
          variant="accent"
          size="md"
          width="flex-1"
          loading={busy}
          disabled={busy || (stepKey === 'goal' && weightProblem)}
          onPress={isLast ? () => void finish() : goNext}
          testID="comeback-next"
        />
      </View>
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('comeback.title')}
      footer={footer}
    >
      <QuickSetupProgressBar current={stepIndex + 1} total={steps.length} />
      <View className="gap-2 px-6 pb-8 pt-6">
        <Text className="text-xs font-semibold text-accent-primary">
          {t('comeback.setup.step', { current: stepIndex + 1, total: steps.length })}
        </Text>
        <Text className="text-2xl font-bold text-text-primary">{t(copy.titleKey)}</Text>
        <Text className="mb-4 text-sm text-text-secondary">{t(copy.subtitleKey)}</Text>
        {renderStep()}
      </View>
    </FullScreenModal>
  );
}

/**
 * The modal re-seeds from its props every time it opens. The body is remounted per opening (keyed
 * on a counter bumped when `visible` turns true) so its state starts from the props directly,
 * rather than being reset from an effect after a stale first render.
 */
export function ComebackSetupModal(props: ComebackSetupModalProps) {
  const [openings, setOpenings] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) {
      setOpenings((count) => count + 1);
    }
  }

  return <ComebackSetupBody key={openings} {...props} />;
}
