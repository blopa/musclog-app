import { CheckCircle, Flag, Plus } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { Button } from '@/components/theme/Button';
import { useSnackbar } from '@/context/SnackbarContext';
import type Exercise from '@/database/models/Exercise';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { useWorkTimer } from '@/hooks/useWorkTimer';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { weightInputStep } from '@/utils/loadIncrement';
import { resolveRestSeconds } from '@/utils/restTimer';
import { getWeightUnitI18nKey } from '@/utils/units';
import { warmupOfferFor, type WarmupSetPrescription } from '@/utils/warmupSets';
import {
  isPerformedWorkoutSet,
  isResolvedWorkoutSet,
  isWorkingSet,
} from '@/utils/workoutSetCompletion';
import {
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

import type { SessionExerciseAction } from './session/ExerciseHeader';
import type { SessionNote } from './session/ExerciseNotes';
import { FirstSessionTip } from './session/FirstSessionTip';
import { GuidedCompleteButton, GuidedExerciseView } from './session/GuidedExerciseView';
import { InlineExerciseCard } from './session/InlineExerciseCard';
import { RestTimerBar } from './session/RestTimerBar';
import { buildSessionBlocks, guidanceStateFor, type SessionBlock } from './session/sessionModel';
import { SetDetailsSheet } from './session/SetDetailsSheet';
import {
  draftFromSet,
  linkEffortPatch,
  reconcileWeightDraft,
  type SetDraftField,
  setDraftProblem,
  stampWeightPatch,
  valuesFromDraft,
} from './session/setDraft';
import { WorkTimerBar } from './session/WorkTimerBar';

/** What to tell the user when a set cannot be completed as typed; whole keys, never built. */
const INVALID_FIELD_KEYS = {
  weight: 'trainingFlow.invalidWeight',
  reps: 'trainingFlow.invalidReps',
  rir: 'trainingFlow.invalidRir',
  rpe: 'trainingFlow.invalidRpe',
  partials: 'trainingFlow.invalidPartials',
} as const satisfies Record<SetDraftField, string>;

type Controller = ReturnType<typeof useWorkoutSessionController>;

const SESSION_MAX_WIDTH = 720;

export type TrainingViewAction = 'guidance' | SessionExerciseAction;

/**
 * The live session body for both views. It derives everything a view needs once — blocks, values,
 * guidance, warm-up offers — and both views write through the same controller, so switching between
 * them changes only what is drawn.
 */
export function WorkoutTrainingView({
  sets,
  exercises,
  controller,
  selectedLogExerciseId,
  onSelect,
  onAction,
  onWarmups,
  onAddExercise,
  onFinish,
  controls,
  children,
}: {
  sets: EnrichedWorkoutLogSet[];
  exercises: Exercise[];
  controller: Controller;
  selectedLogExerciseId?: string;
  onSelect: (id: string) => void;
  onAction: (logExerciseId: string, action: TrainingViewAction) => void;
  onWarmups: (logExerciseId: string, warmups: readonly WarmupSetPrescription[] | 'remove') => void;
  onAddExercise: () => void;
  onFinish: () => void;
  /** Recording controls (sensor start/stop) that must stay reachable in both views. */
  controls?: ReactNode;
  /** Context cards above the sets; shown in the Inline view only (Guided is the focus mode). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();
  const {
    units: accountUnits,
    autoStartRestTimer,
    restTimerHaptics,
    restHapticStrength,
  } = useSettings();
  const { gym } = useActiveGym();
  const { unitsFor, get } = useExerciseUserSettings();
  // The user's own choice for the rest panel, remembered for one rest only.
  const [timerChoice, setTimerChoice] = useState<{ restId: number; expanded: boolean } | null>(
    null
  );
  const [detailsSetId, setDetailsSetId] = useState<string | null>(null);
  // The set and field that stopped the last completion; cleared once the user edits that set.
  const [problem, setProblem] = useState<{ setId: string; field: SetDraftField } | null>(null);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const cardPositions = useRef(new Map<string, number>());
  const insightsHeight = useRef(0);

  const blocks = useMemo(() => buildSessionBlocks(sets), [sets]);
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises]);
  const next = getFirstUnloggedInEffectiveOrder(sets);
  const allResolved = sets.length > 0 && sets.every(isResolvedWorkoutSet);
  const currentBlock =
    blocks.find((block) => block.logExerciseId === selectedLogExerciseId) ??
    blocks.find((block) => block.logExerciseId === next?.logExerciseId) ??
    blocks[0];

  // A timed set: when the countdown runs out the rest begins on its own (if the user lets rests
  // start by themselves), and logging the set a moment later must not start it a second time.
  const workTimer = useWorkTimer({
    hapticsEnabled: restTimerHaptics,
    hapticStrength: restHapticStrength,
    onFinish: () => {
      if (!autoStartRestTimer || controller.restSeconds > 0) {
        return false;
      }

      void controller.startRest(
        resolveRestSeconds(currentBlock?.focus.restTimeAfter, controller.defaultRest)
      );
      return true;
    },
  });

  const editDraft = (setId: string, patch: Partial<SessionDraft>) => {
    const set = sets.find((row) => row.id === setId);
    const linked = linkEffortPatch(patch, locale);
    if (problem?.setId === setId && patch[problem.field] !== undefined) {
      setProblem(null);
    }

    controller.edit(
      setId,
      set ? stampWeightPatch(linked, unitsFor(set.exerciseId), locale) : linked
    );
  };

  const isCurrentBlock = (block: SessionBlock) => block === currentBlock && !allResolved;
  const valuesFor = (setId: string) => {
    const set = sets.find((row) => row.id === setId)!;
    const units = unitsFor(set.exerciseId);
    const draft = controller.drafts[setId];
    // A typed weight is a display string stamped with its unit and locale: when either has changed
    // since, it is shown converted, so the number keeps meaning the same load.
    return {
      ...draftFromSet(set, units, locale),
      ...draft,
      ...reconcileWeightDraft(draft, units, locale),
    };
  };

  const complete = (setId: string) => {
    const set = sets.find((row) => row.id === setId);
    if (!set) {
      return;
    }

    const reopening = isPerformedWorkoutSet(set);
    const invalid = reopening ? null : setDraftProblem(valuesFor(setId), locale);
    if (invalid) {
      setProblem({ setId, field: invalid });
      showSnackbar('error', t(INVALID_FIELD_KEYS[invalid]));
      if (invalid === 'rir' || invalid === 'rpe' || invalid === 'partials') {
        // These fields live in the details sheet, so the outline has to be shown there.
        setDetailsSetId(setId);
      }

      return;
    }

    const loggedValues = valuesFromDraft(
      valuesFor(setId),
      unitsFor(set.exerciseId),
      locale,
      controller.drafts[setId]?.weight !== undefined || controller.drafts[setId]?.reps !== undefined
    );
    const restAlreadyStarted = workTimer.consumeRestHandoff(controller.restSeconds > 0);
    void controller
      .complete(setId, loggedValues, restAlreadyStarted ? { autoRest: false } : undefined)
      .then((completed) => {
        if (!completed || !reopening) {
          return;
        }

        // Reopening is one stray tap away from un-logging a set: say so, and offer the way back.
        // Putting it back is not a fresh set, so it must not start another rest.
        showSnackbar('success', t('trainingFlow.setReopened'), {
          action: t('trainingFlow.undo'),
          duration: 5000,
          onAction: () =>
            void controller.complete(setId, { ...loggedValues, manual: true }, { autoRest: false }),
        });
      });
  };

  const skip = (setId: string) => {
    void controller.skip(setId);
  };

  const warmupOfferForBlock = (block: SessionBlock) =>
    warmupOfferFor({
      exerciseSets: block.rows.map((row) => row.set),
      currentSet: block.focus,
      workingKg: block.focus.weight,
      gym,
      equipmentType: exerciseById.get(block.exerciseId)?.equipmentType,
      units: unitsFor(block.exerciseId),
    });
  const warmupFor = (block: SessionBlock): 'add' | 'remove' | null => {
    const offer = warmupOfferForBlock(block);
    if (offer.toAdd.length) {
      return 'add';
    }

    return offer.canRemove ? 'remove' : null;
  };

  const action = (block: SessionBlock, kind: SessionExerciseAction) => {
    if (kind === 'warmup') {
      const offer = warmupOfferForBlock(block);
      onWarmups(block.logExerciseId, offer.toAdd.length ? offer.toAdd : 'remove');
      return;
    }

    onAction(block.logExerciseId, kind);
  };

  const notesFor = (block: SessionBlock) => {
    const notes: SessionNote[] = [];
    const pinned = get(block.exerciseId).note;
    if (pinned) {
      notes.push({ kind: 'pinned', text: pinned });
    }

    if (block.focus.notes) {
      notes.push({ kind: 'session', text: block.focus.notes });
    }

    return notes;
  };

  // Bring the next set into view after each completion (Inline only — Guided always shows it). The
  // next set's id is the trigger: a completion moves it even when the exercise stays the same.
  const currentBlockId = currentBlock?.logExerciseId;
  const nextSetId = next?.id;
  useEffect(() => {
    if (controller.view !== 'inline' || !currentBlockId || !nextSetId) {
      return;
    }

    const y = cardPositions.current.get(currentBlockId);
    if (y != null) {
      scroll.current?.scrollTo({ y: Math.max(0, insightsHeight.current + y - 8), animated: true });
    }
  }, [nextSetId, controller.view, currentBlockId]);

  // The Guided view is read from across the room, so a rest opens its large panel there; a toggle
  // made during a rest holds for that rest only.
  const resting = controller.restSeconds > 0;
  const timerExpanded =
    timerChoice?.restId === controller.restId
      ? timerChoice.expanded
      : resting && controller.view === 'guided';

  const workingDone = sets.filter(isWorkingSet);
  const volumeKg = workingDone.reduce((sum, set) => sum + set.weight * set.reps, 0);
  let summaryText: string | null = null;
  if (allResolved && workingDone.length > 0) {
    summaryText =
      volumeKg > 0
        ? t('trainingFlow.allDoneSummary', {
            sets: formatInteger(workingDone.length),
            volume: formatDisplayWeightKg(locale, accountUnits, volumeKg),
            unit: t(getWeightUnitI18nKey(accountUnits)),
          })
        : t('trainingFlow.allDoneSets', { sets: formatInteger(workingDone.length) });
  }

  const finish = (
    <Button
      label={t('trainingFlow.finish')}
      icon={CheckCircle}
      onPress={onFinish}
      disabled={controller.busy}
      variant={allResolved ? 'gradientCta' : 'outline'}
      size="lg"
      width="full"
    />
  );
  const finishButton = (
    <View className="gap-3 pt-2">
      {allResolved ? (
        <View className="items-center gap-1 rounded-card bg-accent-primary/10 p-4">
          <Flag size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          <Text className="text-lg font-semibold text-text-primary">
            {t('trainingFlow.allDone')}
          </Text>
          {summaryText ? (
            <Text className="text-center text-base font-semibold text-accent-primary">
              {summaryText}
            </Text>
          ) : null}
          <Text className="text-center text-sm text-text-secondary">
            {t('trainingFlow.allDoneHint')}
          </Text>
        </View>
      ) : null}
      {controller.view === 'inline' || allResolved ? (
        <Button
          variant="dashed"
          size="sm"
          width="full"
          icon={Plus}
          label={t('trainingFlow.addExercise')}
          onPress={onAddExercise}
        />
      ) : null}
      {/* Once every set is resolved, Finish is THE action and is pinned in the thumb zone below;
          before that, finishing early is the exception and stays at the end of the list. */}
      {allResolved ? null : finish}
    </View>
  );

  let body: ReactNode;
  let pinnedAction: ReactNode = null;
  if (controller.view === 'guided' && currentBlock) {
    const exercise = exerciseById.get(currentBlock.exerciseId);
    const row =
      currentBlock.rows.find((candidate) => candidate.set.id === currentBlock.focus.id) ??
      currentBlock.rows[0];
    const index = blocks.indexOf(currentBlock);
    const upcoming = getNextSetInEffectiveOrder(sets, row.set.setOrder ?? 0);
    const upcomingBlock = upcoming
      ? blocks.find((block) => block.logExerciseId === upcoming.logExerciseId)
      : undefined;
    const upcomingRow = upcomingBlock?.rows.find((candidate) => candidate.set.id === upcoming?.id);
    const units = unitsFor(currentBlock.exerciseId);
    body =
      exercise && !(allResolved && !selectedLogExerciseId) ? (
        <GuidedExerciseView
          block={currentBlock}
          exercise={exercise}
          row={row}
          draft={controller.drafts[row.set.id]}
          values={valuesFor(row.set.id)}
          state={guidanceStateFor(currentBlock, { equipmentType: exercise.equipmentType, gym })}
          units={units}
          weightStep={weightInputStep(exercise.equipmentType, gym, units)}
          exerciseIndex={index}
          exerciseCount={blocks.length}
          notes={notesFor(currentBlock)}
          warmup={warmupFor(currentBlock)}
          busy={controller.busy}
          nextLabel={
            upcoming && upcomingRow && upcoming.id !== row.set.id
              ? `${exerciseById.get(upcoming.exerciseId)?.name ?? ''} · ${
                  upcomingRow.workingNumber == null
                    ? t('workoutSession.warmup.badge')
                    : t('trainingFlow.setLabel', {
                        number: formatInteger(upcomingRow.workingNumber),
                      })
                }`
              : undefined
          }
          onPreviousExercise={
            index > 0 ? () => onSelect(blocks[index - 1].logExerciseId) : undefined
          }
          onNextExercise={
            index < blocks.length - 1 ? () => onSelect(blocks[index + 1].logExerciseId) : undefined
          }
          onWhy={() => onAction(currentBlock.logExerciseId, 'guidance')}
          onRevert={() => void controller.revert(currentBlock.logExerciseId)}
          onAction={(kind) => action(currentBlock, kind)}
          invalidField={problem?.setId === row.set.id ? problem.field : null}
          onEdit={(draft) => editDraft(row.set.id, draft)}
          onDetails={() => setDetailsSetId(row.set.id)}
        />
      ) : null;
    pinnedAction = body ? (
      <GuidedCompleteButton
        setId={row.set.id}
        done={isPerformedWorkoutSet(row.set)}
        busy={controller.busy}
        onPress={() => complete(row.set.id)}
      />
    ) : null;
  } else {
    body = (
      <View className="gap-4">
        {blocks.map((block, index) => {
          const exercise = exerciseById.get(block.exerciseId);
          if (!exercise) {
            return null;
          }

          return (
            <View
              key={block.logExerciseId}
              onLayout={(event) =>
                cardPositions.current.set(block.logExerciseId, event.nativeEvent.layout.y)
              }
            >
              <InlineExerciseCard
                block={block}
                exercise={exercise}
                state={guidanceStateFor(block, { equipmentType: exercise.equipmentType, gym })}
                units={unitsFor(block.exerciseId)}
                isCurrent={isCurrentBlock(block)}
                currentSetId={next?.id}
                drafts={controller.drafts}
                valuesFor={valuesFor}
                notes={notesFor(block)}
                warmup={warmupFor(block)}
                busy={controller.busy}
                onWhy={() => onAction(block.logExerciseId, 'guidance')}
                onRevert={() => void controller.revert(block.logExerciseId)}
                onAction={(kind) => action(block, kind)}
                onEdit={editDraft}
                problem={problem}
                onComplete={complete}
                onSkip={skip}
                onDetails={setDetailsSetId}
                showHint={index === 0}
              />
            </View>
          );
        })}
      </View>
    );
  }

  const detailsSet = detailsSetId ? sets.find((set) => set.id === detailsSetId) : undefined;
  const detailsRow = detailsSet
    ? blocks
        .find((block) => block.logExerciseId === detailsSet.logExerciseId)
        ?.rows.find((row) => row.set.id === detailsSet.id)
    : undefined;

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        ref={scroll}
        bottomOffset={16}
        keyboardShouldPersistTaps="handled"
        // Phones fill the width; tablets keep the set table readable instead of stretching it.
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: SESSION_MAX_WIDTH,
          alignSelf: 'center',
        }}
      >
        <View className="pt-3">
          <FirstSessionTip view={controller.view} />
        </View>
        {/* Recording controls show in both views. Context cards (fueling, cycle insights) belong to
            Inline's full picture; Guided is the focus mode, so it leaves those out. */}
        <View
          onLayout={(event) => {
            insightsHeight.current = event.nativeEvent.layout.height;
          }}
          className="pt-3"
        >
          {controls}
          {controller.view === 'inline' ? children : null}
        </View>
        {body}
        {finishButton}
      </KeyboardAwareScrollView>
      {pinnedAction || allResolved ? (
        <View className="gap-2 bg-bg-primary px-4 pb-2 pt-2">
          {pinnedAction}
          {allResolved ? finish : null}
        </View>
      ) : null}
      {workTimer.mode === 'closed' ? null : (
        <WorkTimerBar
          mode={workTimer.mode}
          seconds={workTimer.seconds}
          remaining={workTimer.remaining}
          onAdjust={workTimer.adjust}
          onStart={workTimer.start}
          onStop={workTimer.stop}
          onClose={workTimer.close}
        />
      )}
      <RestTimerBar
        onOpenWorkTimer={workTimer.mode === 'closed' ? workTimer.open : undefined}
        remaining={controller.restSeconds}
        total={controller.restTotal}
        defaultRest={controller.defaultRest}
        expanded={timerExpanded}
        onToggleExpanded={() =>
          setTimerChoice({ restId: controller.restId, expanded: !timerExpanded })
        }
        // Starting by hand rests as long as finishing the set would have: the set's own rest.
        onStart={() =>
          void controller.startRest(
            resolveRestSeconds(currentBlock?.focus.restTimeAfter, controller.defaultRest)
          )
        }
        onStop={() => void controller.stopRest()}
        onAdjust={(delta) => void controller.adjustRest(delta)}
      />
      {detailsSet && detailsRow ? (
        <SetDetailsSheet
          title={
            detailsRow.workingNumber == null
              ? t('workoutSession.warmup.badge')
              : t('trainingFlow.setLabel', { number: formatInteger(detailsRow.workingNumber) })
          }
          draft={valuesFor(detailsSet.id)}
          locale={locale}
          editable={detailsSet.completionStatus !== 'performed'}
          canSkip={detailsSet.completionStatus === 'planned'}
          busy={controller.busy}
          onChange={(draft) => editDraft(detailsSet.id, draft)}
          onSkip={() => {
            setDetailsSetId(null);
            skip(detailsSet.id);
          }}
          onClose={() => setDetailsSetId(null)}
        />
      ) : null}
    </View>
  );
}
