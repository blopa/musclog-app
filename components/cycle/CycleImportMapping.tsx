import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextInput } from '@/components/theme/TextInput';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import {
  convertExternalCsv,
  detectImportColumns,
  type ImportColumns,
} from '@/utils/cycle/externalImport';

export function CycleImportMapping({
  text,
  onPrepared,
  onCancel,
}: {
  text: string;
  onPrepared: (text: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const detected = detectImportColumns(text);
  const [mapping, setMapping] = useState(detected.mapping);
  const [error, setError] = useState(false);
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-text-primary">
        {t('cycle.complete.importTitle')}
      </Text>
      <Text className="text-sm text-text-secondary">
        {t('cycle.complete.importHint', {
          rows: formatInteger(detected.rows),
          columns: detected.columns.join(', '),
        })}
      </Text>
      {(['date', 'end', 'flow', 'temperature', 'symptoms', 'note'] as const).map((key) => (
        <TextInput
          key={key}
          label={t(`cycle.complete.importColumns.${key}`)}
          value={mapping[key]}
          onChangeText={(value) => setMapping({ ...mapping, [key]: value })}
        />
      ))}
      <View className="flex-row flex-wrap gap-2">
        {(['iso', 'dmy', 'mdy'] as const).map((order) => (
          <Chip
            key={order}
            label={t(`cycle.complete.dateOrder.${order}`)}
            selected={mapping.dateOrder === order}
            onPress={() => setMapping({ ...mapping, dateOrder: order })}
          />
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm text-text-primary">
          {t('cycle.complete.importPeriods')}
        </Text>
        <Switch
          accessibilityLabel={t('cycle.complete.importPeriods')}
          value={mapping.periods}
          onValueChange={(periods) => setMapping({ ...mapping, periods })}
        />
      </View>
      {error ? (
        <Text className="text-sm text-text-secondary">{t('cycle.complete.importError')}</Text>
      ) : null}
      <Button
        label={t('cycle.complete.previewImport')}
        onPress={() => {
          try {
            onPrepared(convertExternalCsv(text, mapping as ImportColumns));
          } catch {
            setError(true);
          }
        }}
      />
      <Button label={t('common.cancel')} variant="outline" onPress={onCancel} />
    </View>
  );
}
