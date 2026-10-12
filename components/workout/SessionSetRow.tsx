import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import type { Units } from '@/constants/settings';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import type { SessionSetValues } from '@/database/services/WorkoutSessionService';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { displayWeightKgNumeric, formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getDecimalSeparator, parseLocalizedDecimalString } from '@/utils/localizedDecimalInput';
import { displayToKg } from '@/utils/unitConversion';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

export function SessionSetRow({
  set,
  draft,
  units,
  previous,
  guided,
  busy,
  onEdit,
  onComplete,
  onSkip,
}: {
  set: EnrichedWorkoutLogSet;
  draft?: SessionDraft;
  units: Units;
  previous?: { weightKg: number; reps: number };
  guided: boolean;
  busy: boolean;
  onEdit: (draft: SessionDraft) => void;
  onComplete: (values: SessionSetValues) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [details, setDetails] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const separator = getDecimalSeparator(locale);
  const values = draft ?? {
    weight: new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 }).format(
      displayWeightKgNumeric(set.weight, units)
    ),
    reps: String(set.reps),
    rir:
      set.rirRecorded || (set.rirRecorded == null && isPerformedWorkoutSet(set))
        ? String(set.repsInReserve)
        : '',
    rpe: set.difficultyLevel ? String(set.difficultyLevel) : '',
    partials: String(set.partials ?? 0),
  };
  const done = isPerformedWorkoutSet(set);
  const input = (field: keyof SessionDraft, label: string) => (
    <View className="min-w-16 flex-1 gap-1">
      <Text className="text-xs text-text-secondary">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={`set-${set.id}-${field}`}
        value={values[field] ?? ''}
        editable={!done}
        onChangeText={(text) => onEdit({ ...values, [field]: text })}
        keyboardType="decimal-pad"
        inputMode="decimal"
        selectTextOnFocus
        style={{
          minHeight: guided ? 72 : 48,
          padding: 8,
          borderRadius: 12,
          color: theme.colors.text.primary,
          backgroundColor: theme.colors.background.cardElevated,
          fontSize: guided ? 36 : 18,
          textAlign: 'center',
        }}
      />
    </View>
  );
  const complete = () =>
    onComplete({
      weight: displayToKg(parseLocalizedDecimalString(values.weight, separator), units),
      reps: Number(values.reps),
      partials: Number(values.partials || 0),
      repsInReserve: values.rir?.trim()
        ? parseLocalizedDecimalString(values.rir, separator)
        : undefined,
      difficultyLevel: values.rpe?.trim()
        ? parseLocalizedDecimalString(values.rpe, separator)
        : undefined,
      manual: draft != null,
    }).catch(() => {});
  return (
    <View
      className={`gap-2 rounded-xl border p-3 ${done ? 'bg-accent-primary10 border-accent-primary' : 'border-border-light'}`}
      testID={`set-${set.id}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs text-text-secondary">
          {t('trainingFlow.setLabel', { number: set.setOrder })} ·{' '}
          {t(`workouts.addExercise.setType.${set.setType === 'normal' ? 'normal' : set.setType}`)}
        </Text>
        <Text className="text-xs text-text-secondary">
          {previous
            ? t('trainingFlow.previous', {
                weight: formatDisplayWeightKg(locale, units, previous.weightKg),
                reps: previous.reps,
                unit: units === 'imperial' ? 'lb' : 'kg',
              })
            : t('trainingFlow.noHistory')}
        </Text>
      </View>
      <View className="flex-row items-end gap-2">
        {input('weight', `${t('workoutSession.weight')} (${units === 'imperial' ? 'lb' : 'kg'})`)}
        {input('reps', t('workoutSession.reps'))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={done ? t('trainingFlow.reopen') : t('trainingFlow.complete')}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={complete}
          testID={`set-${set.id}-complete`}
          className="min-h-12 min-w-12 items-center justify-center rounded-xl bg-accent-primary px-3"
        >
          <Text className="font-bold text-text-primary">
            {done ? '✓' : t('trainingFlow.completeShort')}
          </Text>
        </Pressable>
      </View>
      <View className="flex-row justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => setDetails(!details)}
          className="min-h-11 justify-center"
        >
          <Text className="text-sm text-accent-primary">
            {t('trainingFlow.details')} ·{' '}
            {values.rir?.trim()
              ? t('trainingFlow.rir', { value: values.rir })
              : t('trainingFlow.unrated')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || done}
          onPress={() => onSkip().catch(() => {})}
          className="min-h-11 justify-center"
        >
          <Text className="text-sm text-text-secondary">
            {set.completionStatus === 'skipped'
              ? t('trainingFlow.skipped')
              : t('trainingFlow.skip')}
          </Text>
        </Pressable>
      </View>
      {details ? (
        <BottomPopUp visible onClose={() => setDetails(false)} title={t('trainingFlow.details')}>
          <View className="flex-row gap-2 pb-6">
            {input('rir', t('trainingFlow.rirLabel'))}
            {input('rpe', t('trainingFlow.rpe'))}
            {input('partials', t('trainingFlow.partials'))}
          </View>
        </BottomPopUp>
      ) : null}
    </View>
  );
}
