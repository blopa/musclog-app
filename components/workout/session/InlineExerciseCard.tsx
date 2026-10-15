import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { Units } from '@/constants/settings';
import { SurfaceColorProvider } from '@/context/SurfaceColorContext';
import type Exercise from '@/database/models/Exercise';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import type { GuidanceState } from '@/utils/progressionProjection';
import { getWeightUnitI18nKey } from '@/utils/units';

import {
  ExerciseActionChips,
  ExerciseThumbnail,
  type SessionExerciseAction,
  useExerciseCategory,
} from './ExerciseHeader';
import { ExerciseNotes, type SessionNote } from './ExerciseNotes';
import { GuidanceSummary } from './GuidanceSummary';
import { InlineSetRow, SetTableHeader } from './InlineSetRow';
import { canRevertStartAdjustment, type SessionBlock } from './sessionModel';
import type { SetDraftField } from './setDraft';

/**
 * One exercise of the Inline view: heading, where its targets come from, labelled actions, and a
 * table of its sets that are edited and completed in place.
 */
export function InlineExerciseCard({
  block,
  exercise,
  state,
  units,
  isCurrent,
  currentSetId,
  drafts,
  valuesFor,
  notes,
  warmup,
  busy,
  problem,
  onWhy,
  onRevert,
  onAction,
  onEdit,
  onComplete,
  onSkip,
  onDetails,
  showHint = false,
}: {
  block: SessionBlock;
  exercise: Exercise;
  state: GuidanceState;
  units: Units;
  isCurrent: boolean;
  currentSetId?: string;
  drafts: Record<string, Partial<SessionDraft>>;
  valuesFor: (setId: string) => SessionDraft;
  notes: SessionNote[];
  warmup: 'add' | 'remove' | null;
  busy: boolean;
  /** The set and field that stopped the last completion, until the user edits that set. */
  problem?: { setId: string; field: SetDraftField } | null;
  onWhy: () => void;
  onRevert: () => void;
  onAction: (action: SessionExerciseAction) => void;
  onEdit: (setId: string, patch: Partial<SessionDraft>) => void;
  onComplete: (setId: string) => void;
  onSkip: (setId: string) => void;
  onDetails: (setId: string) => void;
  /** The table hint is shown once per workout (on the first card), not under every exercise. */
  showHint?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const category = useExerciseCategory(exercise);
  const allDone = block.doneCount === block.rows.length;
  return (
    // The card paints its own surface, so it publishes it: the action row's edge fade blends into
    // the card instead of the screen behind it.
    <SurfaceColorProvider color={theme.colors.background.card}>
      <View
        className={`gap-3 rounded-2xl border bg-bg-card p-4 ${isCurrent ? 'border-accent-primary' : 'border-border-light'}`}
        testID={`exercise-card-${block.logExerciseId}`}
      >
        <View className="flex-row items-center gap-3">
          <ExerciseThumbnail exercise={exercise} />
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-bold text-text-primary" numberOfLines={2}>
              {exercise.name}
            </Text>
            {category ? (
              <Text className="text-sm text-text-secondary" numberOfLines={1}>
                {category}
              </Text>
            ) : null}
          </View>
          <View
            className={`rounded-full px-2.5 py-1 ${allDone ? 'bg-accent-primary' : 'bg-bg-overlay'}`}
          >
            <Text
              className={`text-xs font-bold ${allDone ? 'text-text-on-accent' : 'text-text-secondary'}`}
            >
              {t('trainingFlow.blockProgress', {
                done: formatInteger(block.doneCount),
                total: formatInteger(block.rows.length),
              })}
            </Text>
          </View>
        </View>

        <GuidanceSummary
          state={state}
          rule={block.rule}
          adjustment={block.focus.adjustment}
          units={units}
          onWhy={onWhy}
          canRevert={canRevertStartAdjustment(block)}
          onRevert={onRevert}
          flat
        />

        <ExerciseNotes notes={notes} onPress={() => onAction('notes')} />

        <ExerciseActionChips
          warmup={warmup}
          onAction={onAction}
          disabled={busy}
          canSwap={!allDone}
        />

        <View className="gap-1.5">
          <SetTableHeader weightUnit={t(getWeightUnitI18nKey(units))} />
          {block.rows.map((row) => (
            <InlineSetRow
              key={row.set.id}
              row={row}
              draft={drafts[row.set.id]}
              values={valuesFor(row.set.id)}
              units={units}
              isCurrent={row.set.id === currentSetId}
              busy={busy}
              invalidField={problem?.setId === row.set.id ? problem.field : null}
              onEdit={(draft) => onEdit(row.set.id, draft)}
              onComplete={() => onComplete(row.set.id)}
              onSkip={() => onSkip(row.set.id)}
              onDetails={() => onDetails(row.set.id)}
            />
          ))}
          {showHint ? (
            <Text className="px-1 pt-1 text-xs text-text-tertiary">
              {t('trainingFlow.setTapHint')}
            </Text>
          ) : null}
        </View>
      </View>
    </SurfaceColorProvider>
  );
}
