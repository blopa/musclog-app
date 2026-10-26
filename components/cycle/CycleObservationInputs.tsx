import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { TextInput } from '@/components/theme/TextInput';
import { useSettings } from '@/hooks/useSettings';
import type { ObservationDraft } from '@/utils/cycle/observationDraft';
import { OBSERVATION_FIELD_LABEL_KEYS } from '@/utils/cycle/preferences';
import type { CycleConfig } from '@/utils/cycle/types';
import { getTemperatureUnitLabel } from '@/utils/unitConversion';

/** Whole keys, so `check-translations` sees them. */
const PILL_ANSWER_KEYS = {
  taken: 'cycle.daySheet.pill.taken',
  skipped: 'cycle.daySheet.pill.skipped',
} as const;

export function CycleObservationInputs({
  config,
  value,
  onChange,
}: {
  config: CycleConfig;
  value: ObservationDraft;
  onChange: (value: ObservationDraft) => void;
}) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const fields = [
    ...(config.enabledFields ?? []).map((key) => {
      let kind = 'text';
      if (['sex', 'leakage', 'clots'].includes(key)) {
        kind = 'toggle';
      } else if (['temperatureC', 'sleepHours', 'impact'].includes(key)) {
        kind = 'number';
      }

      // The draft holds temperature in the person's own unit (see observationDraft).
      const label =
        key === 'temperatureC'
          ? `${t(OBSERVATION_FIELD_LABEL_KEYS[key])} (${getTemperatureUnitLabel(units)})`
          : t(OBSERVATION_FIELD_LABEL_KEYS[key]);

      return { key, label, kind };
    }),
    ...(config.customFields ?? []).map((field) => ({
      key: `custom:${field.id}`,
      label: field.label,
      kind: field.kind,
    })),
  ];
  const renderInput = ({ key, label, kind }: (typeof fields)[number]) => {
    if (key === 'impact') {
      return (
        <View key={key} className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">{label}</Text>
          <View className="flex-row flex-wrap gap-2">
            {[0, 1, 2, 3].map((n) => (
              <Chip
                key={n}
                label={t(`cycle.complete.impact.${n}`)}
                selected={value[key] === String(n)}
                onPress={() =>
                  onChange({ ...value, [key]: value[key] === String(n) ? '' : String(n) })
                }
              />
            ))}
          </View>
        </View>
      );
    }

    if (key === 'lhTest' || key === 'pregnancyTest') {
      return (
        <View key={key} className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">{label}</Text>
          <View className="flex-row flex-wrap gap-2">
            {['negative', 'positive', 'unclear'].map((choice) => (
              <Chip
                key={choice}
                label={t(`cycle.complete.tests.${choice}`)}
                selected={value[key] === choice}
                onPress={() => onChange({ ...value, [key]: value[key] === choice ? '' : choice })}
              />
            ))}
          </View>
        </View>
      );
    }

    if (kind === 'toggle') {
      return (
        <View key={key} className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">{label}</Text>
          <View className="flex-row gap-2">
            {[true, false].map((choice) => (
              <Chip
                key={String(choice)}
                label={t(choice ? 'common.yes' : 'common.no')}
                selected={value[key] === choice}
                onPress={() => onChange({ ...value, [key]: value[key] === choice ? '' : choice })}
              />
            ))}
          </View>
        </View>
      );
    }

    return (
      <TextInput
        key={key}
        label={label}
        value={String(value[key] ?? '')}
        inputMode={kind === 'number' || kind === 'rating' ? 'decimal' : 'text'}
        onChangeText={(text) => onChange({ ...value, [key]: text })}
      />
    );
  };

  return (
    <View className="gap-4">
      {/* Written by the pill reminder's buttons, so it appears only once an answer exists — and then
          it can be corrected here, since a tap on a lock screen is easy to get wrong. */}
      {value.pill ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">
            {t('cycle.daySheet.pill.label')}
          </Text>
          <View className="flex-row gap-2">
            {(['taken', 'skipped'] as const).map((choice) => (
              <Chip
                key={choice}
                label={t(PILL_ANSWER_KEYS[choice])}
                selected={value.pill === choice}
                onPress={() => onChange({ ...value, pill: value.pill === choice ? '' : choice })}
              />
            ))}
          </View>
        </View>
      ) : null}
      {fields.map(renderInput)}
      {fields.length ? (
        <Text className="text-xs text-text-secondary">
          {t('cycle.personalize.observationsHint')}
        </Text>
      ) : null}
    </View>
  );
}
