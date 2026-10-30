import { Check, SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { NumericTextField } from '@/components/theme/NumericTextField';
import { TextButton } from '@/components/theme/TextButton';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { adjustedFields } from '@/utils/setAdjustment';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

import { RirQuickPick } from './RirQuickPick';
import type { SessionSetRowModel } from './sessionModel';
import { draftFromPrevious, type SetDraftField } from './setDraft';

/**
 * Column widths shared by the header and every row, so they always line up. The inputs are kept
 * just wide enough for "102.5" / "12" so "Last time" — the column lifters read before every set —
 * is not truncated on a 390pt phone.
 */
export const SET_TABLE_COLUMNS = { set: 32, weight: 66, reps: 50, check: 48 } as const;

function useCompactSetTable() {
  const { width, fontScale } = useWindowDimensions();
  return width / fontScale < 400;
}

export function SetTableHeader({ weightUnit }: { weightUnit: string }) {
  const { t } = useTranslation();
  const compact = useCompactSetTable();
  const label = 'text-xs font-medium text-text-tertiary';
  return (
    <View className="flex-row items-center gap-2 px-1" accessibilityElementsHidden>
      <Text className={label} style={{ width: SET_TABLE_COLUMNS.set, textAlign: 'center' }}>
        {t('trainingFlow.columns.set')}
      </Text>
      {compact ? (
        <View className="flex-1" />
      ) : (
        <Text className={`${label} flex-1`}>{t('trainingFlow.columns.previous')}</Text>
      )}
      <Text className={label} style={{ width: SET_TABLE_COLUMNS.weight, textAlign: 'center' }}>
        {weightUnit}
      </Text>
      <Text className={label} style={{ width: SET_TABLE_COLUMNS.reps, textAlign: 'center' }}>
        {t('trainingFlow.columns.reps')}
      </Text>
      <View style={{ width: SET_TABLE_COLUMNS.check }} />
    </View>
  );
}

export function InlineSetRow({
  row,
  draft,
  values,
  units,
  isCurrent,
  busy,
  invalidField,
  onEdit,
  onComplete,
  onSkip,
  onDetails,
}: {
  row: SessionSetRowModel;
  draft?: Partial<SessionDraft>;
  /** What the inputs show: the draft, else the set's own numbers. */
  values: SessionDraft;
  units: Units;
  isCurrent: boolean;
  busy: boolean;
  /** The field that stopped the last attempt to complete this set, until the user edits it. */
  invalidField?: SetDraftField | null;
  onEdit: (patch: Partial<SessionDraft>) => void;
  onComplete: () => void;
  onSkip: () => void;
  /** Opens the set's details (effort, partials, skip): one sheet, owned by the session view. */
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const compact = useCompactSetTable();
  const { set, workingNumber, prescription } = row;
  const done = isPerformedWorkoutSet(set);
  const skipped = set.completionStatus === 'skipped';
  // A number the app calculated is marked — underlined as well as tinted, so it reads without
  // colour — until the user types over it, at which point it is theirs.
  const appAdjusted = adjustedFields(set.adjustment);
  const editable = !done && !skipped;
  const marked = (field: 'weight' | 'reps') =>
    !done && draft?.[field] === undefined && appAdjusted[field];
  const previous = prescription?.previous;
  const setLabel =
    workingNumber == null
      ? t('trainingFlow.warmupShort')
      : formatInteger(workingNumber, { useGrouping: false });
  const setName =
    workingNumber == null
      ? t('workoutSession.warmup.badge')
      : t('trainingFlow.setLabel', { number: formatInteger(workingNumber) });

  let surface = 'border-transparent';
  if (done) {
    surface = 'border-transparent bg-accent-primary/10';
  } else if (isCurrent) {
    surface = 'border-accent-primary bg-bg-secondary';
  }

  const input = (field: 'weight' | 'reps', label: string, width: number) => (
    <NumericTextField
      size="cell"
      width={width}
      accessibilityLabel={`${setName}, ${label}`}
      accessibilityHint={marked(field) ? t('trainingFlow.adjustedHint') : undefined}
      testID={`set-${set.id}-${field}`}
      value={skipped ? '' : (values[field] ?? '')}
      placeholder={skipped ? '–' : undefined}
      editable={editable}
      onChangeText={(text) => onEdit({ [field]: text })}
      integer={field === 'reps'}
      marked={marked(field)}
      invalid={invalidField === field}
      surface={!done}
    />
  );

  const previousCell =
    previous && editable ? (
      // Like Hevy's PREVIOUS column: one tap repeats last time's numbers for this set.
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${setName}, ${t('trainingFlow.usePrevious')}`}
        onPress={() => onEdit(draftFromPrevious(values, previous, units, locale))}
        className={compact ? 'justify-center' : 'min-w-0 flex-1 justify-center'}
        style={{ minHeight: 44 }}
        testID={`set-${set.id}-previous`}
      >
        <Text className="text-sm tabular-nums text-text-secondary">
          {`${compact ? t('trainingFlow.columns.previous') + ': ' : ''}${formatDisplayWeightKg(locale, units, previous.weightKg)} × ${formatInteger(previous.reps, { useGrouping: false })}`}
        </Text>
      </Pressable>
    ) : (
      <Text
        className={
          compact ? 'text-sm text-text-secondary' : 'min-w-0 flex-1 text-sm text-text-secondary'
        }
      >
        {previous
          ? `${formatDisplayWeightKg(locale, units, previous.weightKg)} × ${formatInteger(previous.reps, { useGrouping: false })}`
          : '–'}
      </Text>
    );

  return (
    <View className={`rounded-control border px-1 py-1 ${surface}`} testID={`set-${set.id}`}>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${setName}, ${t('trainingFlow.details')}`}
          onPress={onDetails}
          className="items-center justify-center rounded-control"
          style={{ width: SET_TABLE_COLUMNS.set, height: 44 }}
          // The column is 32pt so the row fits a 390pt phone; the touch target still reaches 44.
          hitSlop={{ left: 6, right: 6 }}
        >
          <Text
            className={`text-base font-semibold tabular-nums ${workingNumber == null ? 'text-text-secondary' : 'text-text-primary'}`}
          >
            {setLabel}
          </Text>
          {values.rir?.trim() ? (
            <Text className="text-xs font-semibold text-text-tertiary">
              {t('trainingFlow.rir', { value: values.rir })}
            </Text>
          ) : null}
        </Pressable>
        {compact ? <View className="flex-1" /> : previousCell}
        {input('weight', t('workoutSession.weight'), SET_TABLE_COLUMNS.weight)}
        {input('reps', t('workoutSession.reps'), SET_TABLE_COLUMNS.reps)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={done ? t('trainingFlow.reopen') : t('trainingFlow.complete')}
          accessibilityState={{ disabled: busy, checked: done }}
          disabled={busy}
          onPress={onComplete}
          testID={`set-${set.id}-complete`}
          className={`items-center justify-center rounded-control ${done ? 'bg-accent-primary' : 'border border-border-default bg-bg-cardElevated'}`}
          style={{ width: SET_TABLE_COLUMNS.check, height: 44 }}
        >
          {skipped ? (
            <SkipForward size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          ) : (
            <Check
              size={theme.iconSize.md}
              strokeWidth={3}
              color={done ? theme.colors.text.onAccent : theme.colors.text.tertiary}
            />
          )}
        </Pressable>
      </View>
      {compact ? previousCell : null}
      {isCurrent && editable ? (
        <View className="gap-1 px-1 pb-2 pt-1">
          <RirQuickPick
            value={values.rir}
            onChange={(rir) => onEdit({ rir })}
            testID={`set-${set.id}-rir-quick`}
          />
          {/* Skipping is a decision the lifter makes in the middle of a set, not a detail. */}
          <TextButton
            label={t('trainingFlow.skipSet')}
            tone="muted"
            disabled={busy}
            onPress={onSkip}
            testID={`set-${set.id}-skip`}
          />
        </View>
      ) : null}
    </View>
  );
}
