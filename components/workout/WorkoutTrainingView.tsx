import { CheckCircle, Flag, Plus } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { Button } from '@/components/theme/Button';
import type Exercise from '@/database/models/Exercise';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { weightInputStep } from '@/utils/loadIncrement';
import { warmupOfferFor, type WarmupSetPrescription } from '@/utils/warmupSets';
import { isResolvedWorkoutSet } from '@/utils/workoutSetCompletion';
import {
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

import type { SessionExerciseAction } from './session/ExerciseHeader';
import { GuidedExerciseView } from './session/GuidedExerciseView';
import { InlineExerciseCard } from './session/InlineExerciseCard';
import { RestTimerBar } from './session/RestTimerBar';
import { buildSessionBlocks, guidanceStateFor, type SessionBlock } from './session/sessionModel';
import { SetDetailsSheet } from './session/SetDetailsSheet';
import { draftFromSet, valuesFromDraft } from './session/setDraft';

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
  selectedExercise,
  onSelect,
  onAction,
  onWarmups,
  onAddExercise,
  onFinish,
  children,
}: {
  sets: EnrichedWorkoutLogSet[];
  exercises: Exercise[];
  controller: Controller;
  selectedExercise?: string;
  onSelect: (id: string) => void;
  onAction: (exerciseId: string, action: TrainingViewAction) => void;
  onWarmups: (exerciseId: string, warmups: readonly WarmupSetPrescription[] | 'remove') => void;
  onAddExercise: () => void;
  onFinish: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const { gym } = useActiveGym();
  const { unitsFor, get } = useExerciseUserSettings();
  // The user's own choice for the rest panel, remembered for one rest only.
  const [timerChoice, setTimerChoice] = useState<{ restId: number; expanded: boolean } | null>(
    null
  );
  const [detailsSetId, setDetailsSetId] = useState<string | null>(null);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const cardPositions = useRef(new Map<string, number>());
  const insightsHeight = useRef(0);

  const blocks = useMemo(() => buildSessionBlocks(sets), [sets]);
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises]);
  const next = getFirstUnloggedInEffectiveOrder(sets);
  const allResolved = sets.length > 0 && sets.every(isResolvedWorkoutSet);
  const currentBlock =
    blocks.find((block) => block.exerciseId === selectedExercise) ??
    blocks.find((block) => block.logExerciseId === next?.logExerciseId) ??
    blocks[0];

  const isCurrentBlock = (block: SessionBlock) => block === currentBlock && !allResolved;
  const valuesFor = (setId: string) => {
    const set = sets.find((row) => row.id === setId)!;
    return controller.drafts[setId] ?? draftFromSet(set, unitsFor(set.exerciseId), locale);
  };
  const complete = (setId: string) => {
    const set = sets.find((row) => row.id === setId);
    if (!set) {
      return;
    }
    void controller
      .complete(
        setId,
        valuesFromDraft(
          valuesFor(setId),
          unitsFor(set.exerciseId),
          locale,
          !!controller.drafts[setId]
        )
      )
      .catch(() => {});
  };
  const skip = (setId: string) => {
    void controller.skip(setId).catch(() => {});
  };
  const warmupFor = (block: SessionBlock): 'add' | 'remove' | null => {
    const offer = warmupOfferFor({
      exerciseSets: block.rows.map((row) => row.set),
      currentSet: block.focus,
      workingKg: block.focus.weight,
      gym,
      equipmentType: exerciseById.get(block.exerciseId)?.equipmentType,
      units: unitsFor(block.exerciseId),
    });
    if (offer.toAdd.length) {
      return 'add';
    }
    return offer.canRemove ? 'remove' : null;
  };
  const action = (block: SessionBlock, kind: SessionExerciseAction) => {
    if (kind === 'warmup') {
      const offer = warmupOfferFor({
        exerciseSets: block.rows.map((row) => row.set),
        currentSet: block.focus,
        workingKg: block.focus.weight,
        gym,
        equipmentType: exerciseById.get(block.exerciseId)?.equipmentType,
        units: unitsFor(block.exerciseId),
      });
      onWarmups(block.exerciseId, offer.toAdd.length ? offer.toAdd : 'remove');
      return;
    }
    onAction(block.exerciseId, kind);
  };
  const notesFor = (block: SessionBlock) => {
    const notes: string[] = [];
    const pinned = get(block.exerciseId).note;
    if (pinned) {
      notes.push(`📌 ${pinned}`);
    }
    if (block.focus.notes) {
      notes.push(`📝 ${block.focus.notes}`);
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

  const finishButton = (
    <View className="gap-3 pt-2">
      {allResolved ? (
        <View className="bg-accent-primary10 items-center gap-1 rounded-2xl p-4">
          <Flag size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          <Text className="text-lg font-bold text-text-primary">{t('trainingFlow.allDone')}</Text>
          <Text className="text-center text-sm text-text-secondary">
            {t('trainingFlow.allDoneHint')}
          </Text>
        </View>
      ) : null}
      {controller.view === 'inline' || allResolved ? (
        <Button
          label={t('trainingFlow.addExercise')}
          icon={Plus}
          variant="dashed"
          width="full"
          onPress={onAddExercise}
        />
      ) : null}
      <Button
        label={t('trainingFlow.finish')}
        icon={CheckCircle}
        onPress={onFinish}
        disabled={controller.busy}
        variant={allResolved ? 'gradientCta' : 'outline'}
        size="lg"
        width="full"
      />
    </View>
  );

  const errorText =
    controller.error != null ? (
      <Text accessibilityRole="alert" className="py-3 text-center text-status-error">
        {t('trainingFlow.saveError')}
      </Text>
    ) : null;

  let body: ReactNode;
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
      exercise && !(allResolved && !selectedExercise) ? (
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
          onPreviousExercise={index > 0 ? () => onSelect(blocks[index - 1].exerciseId) : undefined}
          onNextExercise={
            index < blocks.length - 1 ? () => onSelect(blocks[index + 1].exerciseId) : undefined
          }
          onWhy={() => onAction(currentBlock.exerciseId, 'guidance')}
          onRevert={() => void controller.revert(currentBlock.logExerciseId).catch(() => {})}
          onAction={(kind) => action(currentBlock, kind)}
          onEdit={(draft) => controller.edit(row.set.id, draft)}
          onDetails={() => setDetailsSetId(row.set.id)}
          onComplete={() => complete(row.set.id)}
        />
      ) : null;
  } else {
    body = (
      <View className="gap-4">
        {blocks.map((block) => {
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
                onWhy={() => onAction(block.exerciseId, 'guidance')}
                onRevert={() => void controller.revert(block.logExerciseId).catch(() => {})}
                onAction={(kind) => action(block, kind)}
                onEdit={controller.edit}
                onComplete={complete}
                onSkip={skip}
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
        {/* Guided leads with the set; context cards follow it instead of pushing the hero down. */}
        <View
          onLayout={(event) => {
            insightsHeight.current = event.nativeEvent.layout.height;
          }}
          className="pt-3"
        >
          {controller.view === 'inline' ? children : null}
        </View>
        {body}
        {controller.view === 'guided' ? <View className="pt-4">{children}</View> : null}
        {errorText}
        {finishButton}
      </KeyboardAwareScrollView>
      <RestTimerBar
        remaining={controller.restSeconds}
        total={controller.restTotal}
        defaultRest={controller.defaultRest}
        expanded={timerExpanded}
        onToggleExpanded={() =>
          setTimerChoice({ restId: controller.restId, expanded: !timerExpanded })
        }
        onStart={() => void controller.startRest(controller.defaultRest)}
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
          editable={detailsSet.completionStatus !== 'performed'}
          canSkip={detailsSet.completionStatus === 'planned'}
          busy={controller.busy}
          onChange={(draft) => controller.edit(detailsSet.id, draft)}
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
