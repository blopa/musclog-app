import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { CycleHealthImportService } from '@/database/services/CycleHealthImportService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { cycleHealthSupported, readCycleHealth, writeCycleHealth } from '@/services/cycleHealth';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import type { DatedHealthObservation } from '@/utils/cycle/healthObservations';

export function CycleHealthSettings() {
  const { t } = useTranslation();
  const { dayLogs, nowMs } = useMenstrualCycle();
  const { formatInteger } = useFormatAppNumber();
  const [pending, setPending] = useState<DatedHealthObservation[] | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmWrite, setConfirmWrite] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage(t('cycle.complete.healthError'));
    } finally {
      setBusy(false);
    }
  };

  if (!cycleHealthSupported) {
    return null;
  }

  return (
    <View className="gap-3">
      <Text className="text-base font-bold text-text-primary">
        {t('cycle.complete.healthTitle')}
      </Text>
      <Text className="text-sm text-text-secondary">{t('cycle.complete.healthHint')}</Text>
      <View className="flex-row gap-2">
        {[30, 90, 365].map((n) => (
          <Chip
            key={n}
            disabled={busy}
            label={t('cycle.complete.lastDays', { days: formatInteger(n) })}
            selected={days === n}
            onPress={() => {
              setDays(n);
              setPending(null);
              setConfirmWrite(false);
            }}
          />
        ))}
      </View>
      <Button
        disabled={busy}
        label={t('cycle.complete.healthRead')}
        onPress={() =>
          void run(async () => {
            setPending(await readCycleHealth(nowMs - days * MS_PER_SOLAR_DAY, nowMs));
          })
        }
      />
      {pending ? (
        <>
          <Text className="text-sm text-text-primary">
            {t('cycle.complete.healthPreview', { count: formatInteger(pending.length) })}
          </Text>
          <Button
            disabled={busy || !pending.length}
            label={t('cycle.complete.healthImport')}
            onPress={() =>
              void run(async () => {
                await CycleHealthImportService.import(pending);
                setPending(null);
                setMessage(t('cycle.complete.healthDone'));
              })
            }
          />
          <Button
            disabled={busy}
            label={t('common.cancel')}
            variant="outline"
            onPress={() => setPending(null)}
          />
        </>
      ) : null}
      <Button
        disabled={busy}
        label={t('cycle.complete.healthWrite')}
        variant="outline"
        onPress={() => setConfirmWrite(true)}
      />
      {confirmWrite ? (
        <>
          <Text className="text-sm text-text-secondary">{t('cycle.complete.healthWriteHint')}</Text>
          <Button
            disabled={busy}
            label={t('common.confirm')}
            onPress={() =>
              void run(async () => {
                const count = await writeCycleHealth(
                  dayLogs.filter(
                    (d) => d.date >= nowMs - days * MS_PER_SOLAR_DAY && d.date <= nowMs
                  )
                );
                setConfirmWrite(false);
                setMessage(t('cycle.complete.healthWritten', { count: formatInteger(count) }));
              })
            }
          />
          <Button
            disabled={busy}
            variant="outline"
            label={t('common.cancel')}
            onPress={() => setConfirmWrite(false)}
          />
        </>
      ) : null}
      {busy || message ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-text-secondary">
          {busy ? t('common.loading') : message}
        </Text>
      ) : null}
    </View>
  );
}
