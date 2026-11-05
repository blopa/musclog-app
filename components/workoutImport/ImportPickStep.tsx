import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { TextButton } from '@/components/theme/TextButton';
import type { ImportBatch } from '@/database/services/WorkoutImportService';
import { IMPORT_SOURCE_NAMES } from '@/utils/workoutImport/importFlow';
import type { WorkoutImportSource } from '@/utils/workoutImport/types';

import { formatImportRange } from './importDates';

type ImportPickStepProps = {
  onChooseFile: () => void;
  /** Only offered when an AI provider is configured; the paste path is AI-parsed. */
  onPasteText?: () => void;
  batches: readonly ImportBatch[];
  onUndo: (batch: ImportBatch) => void;
};

/** Where to find each app's export: one line per app, whole keys only. */
const EXPORT_HINTS = [
  'workoutImport.pick.strongHint',
  'workoutImport.pick.hevyHint',
  'workoutImport.pick.fitnotesHint',
] as const;

export function ImportPickStep({
  onChooseFile,
  onPasteText,
  batches,
  onUndo,
}: ImportPickStepProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <View className="gap-6 px-4 py-6">
      <View className="gap-4">
        <Text className="text-base text-text-secondary">
          {t('workoutImport.pick.supportedApps')}
        </Text>
        <Button label={t('workoutImport.pick.chooseFile')} onPress={onChooseFile} width="full" />
        {onPasteText ? (
          <TextButton label={t('workoutImport.pick.pasteInstead')} onPress={onPasteText} />
        ) : null}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-text-primary">
          {t('workoutImport.pick.whereToFind')}
        </Text>
        {EXPORT_HINTS.map((key) => (
          <Text key={key} className="text-sm text-text-secondary">
            {t(key)}
          </Text>
        ))}
      </View>

      {batches.length > 0 ? (
        <ListGroup title={t('workoutImport.pick.past')}>
          {batches.map((batch) => (
            <ListRow
              key={batch.batchId}
              title={t('workoutImport.pick.pastEntry', {
                source: IMPORT_SOURCE_NAMES[batch.source as WorkoutImportSource] ?? batch.source,
                from: formatImportRange(locale, batch.firstStartedAt),
                to: formatImportRange(locale, batch.lastStartedAt),
              })}
              subtitle={t('workoutImport.pick.pastSessions', {
                count: batch.sessions,
              })}
              onPress={() => onUndo(batch)}
              accessibilityLabel={t('workoutImport.pick.undoLabel', {
                source: IMPORT_SOURCE_NAMES[batch.source as WorkoutImportSource] ?? batch.source,
              })}
              // The row is the button, so this is a label, not a second control nested in it.
              trailing={
                <Text className="text-sm font-semibold text-status-error">
                  {t('workoutImport.pick.undo')}
                </Text>
              }
            />
          ))}
        </ListGroup>
      ) : null}
    </View>
  );
}
