import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CycleDiaryPresets } from '@/components/cycle/CycleDiaryPresets';
import { CycleGoals } from '@/components/cycle/CycleGoals';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { TextInput } from '@/components/theme/TextInput';
import { EMOTIONAL_SYMPTOM_KEYS, PHYSICAL_SYMPTOM_KEYS } from '@/constants/cycle';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { MAX_QUICK_LOG, parseQuickLog, togglePinned } from '@/utils/cycle/dayLog';
import { cycleSymptomLabel, OBSERVATION_FIELDS, toggleChoice } from '@/utils/cycle/preferences';
import type { CustomCycleField, CycleConfigUpdate } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

export function CyclePreferences() {
  const { t } = useTranslation();
  const { config, updateConfig } = useMenstrualCycle();
  const { cycleQuickLogRaw } = useSettings();
  const [name, setName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [ratingMin, setRatingMin] = useState('0');
  const [ratingMax, setRatingMax] = useState('10');
  const [kind, setKind] = useState<CustomCycleField['kind']>('text');
  const [busy, setBusy] = useState(false);
  const pinned = config.quickLog ?? parseQuickLog(cycleQuickLogRaw);
  const symptoms = [...PHYSICAL_SYMPTOM_KEYS, ...EMOTIONAL_SYMPTOM_KEYS]
    .map((s) => s.value)
    .concat((config.customSymptoms ?? []).map((s) => `custom:${s}`));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      handleError(error, 'CyclePreferences.save', {
        sendToSentry: false,
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const save = (update: CycleConfigUpdate) => void run(() => updateConfig(update));

  return (
    <View className="gap-5" pointerEvents={busy ? 'none' : 'auto'}>
      <CycleDiaryPresets />
      <CycleGoals value={config.goals ?? []} onChange={(goals) => save({ goals })} />
      <Text className="text-base font-bold text-text-primary">
        {t('cycle.personalize.quickTitle')}
      </Text>
      <Text className="text-xs text-text-secondary">{t('cycle.personalize.quickHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {symptoms.map((key) => (
          <Chip
            key={key}
            label={cycleSymptomLabel(key, t)}
            role="checkbox"
            disabled={busy || (!pinned.includes(key) && pinned.length >= MAX_QUICK_LOG)}
            selected={pinned.includes(key)}
            onPress={() =>
              save((current) => ({
                quickLog: togglePinned(current.quickLog ?? parseQuickLog(cycleQuickLogRaw), key),
              }))
            }
          />
        ))}
      </View>
      <TextInput label={t('cycle.personalize.customSymptom')} value={name} onChangeText={setName} />
      <Button
        label={t('cycle.personalize.add')}
        loading={busy}
        disabled={
          !name.trim() || name.trim().length > 60 || (config.customSymptoms?.length ?? 0) >= 30
        }
        variant="outline"
        onPress={() =>
          void run(async () => {
            const trimmed = name.trim();
            await updateConfig((current) => {
              const existing = current.customSymptoms ?? [];
              return {
                customSymptoms: existing.some(
                  (s) => s.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
                )
                  ? existing
                  : [...existing, trimmed],
              };
            });

            setName('');
          })
        }
      />
      {(config.customSymptoms ?? []).map((symptom) => (
        <TextButton
          key={symptom}
          label={t('cycle.personalize.removeNamed', { name: symptom })}
          onPress={() =>
            void run(async () => {
              await updateConfig((current) => ({
                customSymptoms: current.customSymptoms?.filter((s) => s !== symptom),
                quickLog: (current.quickLog ?? parseQuickLog(cycleQuickLogRaw)).filter(
                  (key) => key !== `custom:${symptom}`
                ),
              }));
            })
          }
        />
      ))}
      <Text className="text-base font-bold text-text-primary">
        {t('cycle.personalize.fieldsTitle')}
      </Text>
      <Text className="text-xs text-text-secondary">{t('cycle.personalize.fieldsHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {OBSERVATION_FIELDS.map((field) => (
          <Chip
            key={field}
            label={t(`cycle.personalize.fields.${field}`)}
            selected={config.enabledFields?.includes(field) ?? false}
            role="checkbox"
            onPress={() =>
              save((current) => ({
                enabledFields: toggleChoice(current.enabledFields ?? [], field),
              }))
            }
          />
        ))}
      </View>
      <TextInput
        label={t('cycle.personalize.customField')}
        value={fieldName}
        onChangeText={setFieldName}
      />
      <View className="flex-row flex-wrap gap-2">
        {(['text', 'number', 'toggle', 'rating'] as const).map((value) => (
          <Chip
            key={value}
            label={t(`cycle.personalize.kinds.${value}`)}
            selected={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </View>
      {kind === 'rating' ? (
        <View className="flex-row gap-3">
          <TextInput
            label={t('cycle.complete.ratingMin')}
            value={ratingMin}
            onChangeText={setRatingMin}
            inputMode="numeric"
          />
          <TextInput
            label={t('cycle.complete.ratingMax')}
            value={ratingMax}
            onChangeText={setRatingMax}
            inputMode="numeric"
          />
        </View>
      ) : null}
      <Button
        label={t('cycle.personalize.add')}
        loading={busy}
        variant="outline"
        disabled={
          !fieldName.trim() ||
          fieldName.trim().length > 60 ||
          (config.customFields?.length ?? 0) >= 20 ||
          (kind === 'rating' &&
            (!ratingMin.trim() ||
              !ratingMax.trim() ||
              !Number.isInteger(Number(ratingMin)) ||
              !Number.isInteger(Number(ratingMax)) ||
              Number(ratingMin) < -100 ||
              Number(ratingMax) > 100 ||
              Number(ratingMin) >= Number(ratingMax)))
        }
        onPress={() =>
          void run(async () => {
            await updateConfig((current) => ({
              customFields: [
                ...(current.customFields ?? []),
                {
                  id: randomUUID(),
                  label: fieldName.trim(),
                  kind,
                  ...(kind === 'rating' ? { min: Number(ratingMin), max: Number(ratingMax) } : {}),
                },
              ],
            }));
            setFieldName('');
          })
        }
      />
      {(config.customFields ?? []).map((field) => (
        <TextButton
          key={field.id}
          label={t('cycle.personalize.removeNamed', { name: field.label })}
          onPress={() =>
            save((current) => ({
              customFields: current.customFields?.filter((f) => f.id !== field.id),
            }))
          }
        />
      ))}
      <Text className="text-xs text-text-secondary">{t('cycle.personalize.removeHint')}</Text>
      {busy ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-text-secondary">
          {t('cycle.personalize.saving')}
        </Text>
      ) : null}
    </View>
  );
}
