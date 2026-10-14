import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

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
import type { CustomCycleField, CycleConfig } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

export function CyclePreferences() {
  const { t } = useTranslation();
  const { config, updateConfig } = useMenstrualCycle();
  const { cycleQuickLogRaw } = useSettings();
  const [name, setName] = useState('');
  const [fieldName, setFieldName] = useState('');
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

  const save = (patch: Partial<CycleConfig>) =>
    void run(() => updateConfig({ ...config, ...patch }));

  return (
    <View className="gap-5" pointerEvents={busy ? 'none' : 'auto'}>
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
            onPress={() => save({ quickLog: togglePinned(pinned, key) })}
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
            const existing = config.customSymptoms ?? [];
            const trimmed = name.trim();
            if (!existing.some((s) => s.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
              await updateConfig({ ...config, customSymptoms: [...existing, trimmed] });
            }

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
              await updateConfig({
                ...config,
                customSymptoms: config.customSymptoms?.filter((s) => s !== symptom),
                quickLog: pinned.filter((key) => key !== `custom:${symptom}`),
              });
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
            onPress={() => save({ enabledFields: toggleChoice(config.enabledFields ?? [], field) })}
          />
        ))}
      </View>
      <TextInput
        label={t('cycle.personalize.customField')}
        value={fieldName}
        onChangeText={setFieldName}
      />
      <View className="flex-row flex-wrap gap-2">
        {(['text', 'number', 'toggle'] as const).map((value) => (
          <Chip
            key={value}
            label={t(`cycle.personalize.kinds.${value}`)}
            selected={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </View>
      <Button
        label={t('cycle.personalize.add')}
        loading={busy}
        variant="outline"
        disabled={
          !fieldName.trim() ||
          fieldName.trim().length > 60 ||
          (config.customFields?.length ?? 0) >= 20
        }
        onPress={() =>
          void run(async () => {
            await updateConfig({
              ...config,
              customFields: [
                ...(config.customFields ?? []),
                { id: randomUUID(), label: fieldName.trim(), kind },
              ],
            });
            setFieldName('');
          })
        }
      />
      {(config.customFields ?? []).map((field) => (
        <TextButton
          key={field.id}
          label={t('cycle.personalize.removeNamed', { name: field.label })}
          onPress={() =>
            save({ customFields: config.customFields?.filter((f) => f.id !== field.id) })
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
