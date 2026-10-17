import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import type { NutritionTargets } from '@/database/services/NutritionTargetService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

import { MACRO_LABEL_KEYS } from './NutritionReviewSection';
import {
  readTargetsDraft,
  TARGET_FIELDS,
  type TargetsDraft,
  targetsDraftFrom,
} from './targetsDraft';

/**
 * Edits a Weekly Review's recommended targets before applying them. Calories stay editable — the
 * recommendation does not add up exactly, so deriving them would quietly change it — but the sheet
 * shows what the macros add up to and offers to use that when the two disagree, so a hand-edit
 * cannot leave a calorie target and macros describing different days. Every field is checked as it
 * is typed, and Apply waits until all of them read.
 */
export function TargetsEditorSheet({
  initial,
  busy,
  saveFailed,
  onApply,
  onClose,
}: {
  initial: NutritionTargets;
  busy: boolean;
  /** The last apply was refused or failed. */
  saveFailed: boolean;
  onApply: (targets: NutritionTargets) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [draft, setDraft] = useState<TargetsDraft>(() => targetsDraftFrom(initial, locale));
  const reading = readTargetsDraft(draft, locale);

  return (
    <BottomPopUp
      visible
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
      title={t('weeklyReview.edit')}
      footer={
        <View className="gap-3">
          <Button
            label={t('weeklyReview.applyTomorrow')}
            disabled={busy || !reading.targets}
            onPress={() => (reading.targets ? onApply(reading.targets) : undefined)}
          />
          <Button label={t('common.cancel')} variant="outline" disabled={busy} onPress={onClose} />
        </View>
      }
    >
      <View className="gap-3 pb-4">
        {TARGET_FIELDS.map((field) => (
          <View key={field} className="gap-1">
            <TextInput
              label={t(MACRO_LABEL_KEYS[field])}
              value={draft[field]}
              onChangeText={(value) => setDraft({ ...draft, [field]: value })}
              inputMode="decimal"
              keyboardType="numeric"
            />
            {reading.invalid.includes(field) ? (
              <Text accessibilityRole="alert" className="text-xs text-status-error">
                {t(
                  field === 'totalCalories'
                    ? 'weeklyReview.targetsEditor.invalidCalories'
                    : 'weeklyReview.targetsEditor.invalidMacro'
                )}
              </Text>
            ) : null}
          </View>
        ))}
        {reading.macroCalories != null ? (
          <View
            className={`gap-2 rounded-xl p-3 ${reading.mismatch ? 'bg-status-warning/10' : 'bg-bg-overlay'}`}
          >
            <Text
              accessibilityRole={reading.mismatch ? 'alert' : undefined}
              className="text-sm text-text-secondary"
            >
              {t(
                reading.mismatch
                  ? 'weeklyReview.targetsEditor.mismatch'
                  : 'weeklyReview.targetsEditor.macroTotal',
                { kcal: formatInteger(reading.macroCalories) }
              )}
            </Text>
            {reading.mismatch ? (
              <Button
                label={t('weeklyReview.targetsEditor.useMacroTotal', {
                  kcal: formatInteger(reading.macroCalories),
                })}
                variant="outline"
                size="sm"
                disabled={busy}
                onPress={() =>
                  setDraft({
                    ...draft,
                    totalCalories: String(reading.macroCalories),
                  })
                }
              />
            ) : null}
          </View>
        ) : null}
        {saveFailed ? (
          <Text accessibilityRole="alert" className="text-status-error">
            {t('weeklyReview.error')}
          </Text>
        ) : null}
      </View>
    </BottomPopUp>
  );
}
