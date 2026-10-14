import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { useCycleMoods } from '@/hooks/useCycleMoods';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import {
  selectedCycleSharing,
  SHARING_FIELDS,
  type SharingField,
} from '@/utils/cycle/selectedSharing';
import { shareTextFile } from '@/utils/file';
import { timestampSlug } from '@/utils/timestampSlug';

export function CycleSharingSettings() {
  const { t } = useTranslation();
  const { dayLogs, nowMs } = useMenstrualCycle();
  const { moods, isLoading, error } = useCycleMoods();
  const { formatInteger } = useFormatAppNumber();
  const [fields, setFields] = useState<SharingField[]>([]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <View className="gap-3">
      <Text className="text-base font-bold text-text-primary">{t('cycle.complete.sharing')}</Text>
      <Text className="text-sm text-text-secondary">{t('cycle.complete.sharingHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {SHARING_FIELDS.map((field) => (
          <Chip
            key={field}
            disabled={busy}
            role="checkbox"
            label={t(`cycle.complete.metrics.${field}`)}
            selected={fields.includes(field)}
            onPress={() =>
              setFields(
                fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field]
              )
            }
          />
        ))}
      </View>
      <View className="flex-row gap-2">
        {[30, 90, 365].map((n) => (
          <Chip
            key={n}
            disabled={busy}
            label={t('cycle.complete.lastDays', { days: formatInteger(n) })}
            selected={days === n}
            onPress={() => setDays(n)}
          />
        ))}
      </View>
      <Button
        label={t('cycle.complete.shareSelected')}
        disabled={!fields.length || busy || isLoading || error}
        loading={busy}
        onPress={() => {
          setBusy(true);
          setFailed(false);
          void shareTextFile(
            `${timestampSlug()}-cycle-selected.json`,
            selectedCycleSharing(dayLogs, moods, fields, nowMs - days * MS_PER_SOLAR_DAY, nowMs),
            'application/json'
          )
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      />
      {failed ? (
        <Text className="text-sm text-text-secondary">{t('errors.somethingWentWrong')}</Text>
      ) : null}
    </View>
  );
}
