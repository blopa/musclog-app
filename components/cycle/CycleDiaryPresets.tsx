import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import type { ObservationField } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

const PRESETS = {
  pms: {
    fields: ['impact', 'sleepHours', 'medication'],
    symptoms: ['low_mood', 'anxiety', 'irritability', 'brain_fog', 'insomnia', 'fatigue'],
  },
  fertility: {
    fields: ['temperatureC', 'discharge', 'lhTest', 'pregnancyTest', 'sex'],
    symptoms: [],
  },
  perimenopause: {
    fields: ['sleepHours', 'impact', 'medication'],
    symptoms: ['hot_flashes', 'insomnia', 'brain_fog', 'low_mood'],
  },
} as const;
export function CycleDiaryPresets() {
  const { t } = useTranslation();
  const { config, updateConfig } = useMenstrualCycle();
  return (
    <View className="gap-2">
      <Text className="text-base font-bold text-text-primary">{t('cycle.complete.presets')}</Text>
      <Text className="text-xs text-text-secondary">{t('cycle.complete.presetsHint')}</Text>
      {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((key) => (
        <TextButton
          key={key}
          label={t(`cycle.complete.preset.${key}`)}
          onPress={() => {
            const preset = PRESETS[key];
            void updateConfig({
              ...config,
              enabledFields: [
                ...new Set([...(config.enabledFields ?? []), ...preset.fields]),
              ] as ObservationField[],
              quickLog: [...new Set([...(config.quickLog ?? []), ...preset.symptoms])].slice(0, 6),
            }).catch((error) =>
              handleError(error, 'CycleDiaryPresets.save', {
                sendToSentry: false,
                snackbarMessage: t('errors.somethingWentWrong'),
              })
            );
          }}
        />
      ))}
      <Text className="text-xs text-text-secondary">{t('cycle.complete.pmsDiaryHint')}</Text>
      <Text className="text-xs text-text-secondary">{t('cycle.complete.fertilityHint')}</Text>
    </View>
  );
}
