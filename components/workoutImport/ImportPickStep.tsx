import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import type { ImportBatch } from '@/database/services/WorkoutImportService';
import { IMPORT_SOURCE_NAMES } from '@/utils/workoutImport/importFlow';
import type { WorkoutImportSource } from '@/utils/workoutImport/types';

import { formatImportRange } from './importDates';

type ImportPickStepProps = {
  batches: readonly ImportBatch[];
  onUndo: (batch: ImportBatch) => void;
};

/** Where to find each app's export: one line per app, whole keys only. */
const EXPORT_HINTS = [
  'workoutImport.pick.strongHint',
  'workoutImport.pick.hevyHint',
  'workoutImport.pick.fitnotesHint',
] as const;

/** The file and paste actions live in the modal footer, pinned where the thumb is. */
export function ImportPickStep({ batches, onUndo }: ImportPickStepProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <View className="gap-6 px-4 py-6">
      <Text className="text-lg font-semibold text-text-primary">
        {t('workoutImport.pick.supportedApps')}
      </Text>

      <ListGroup title={t('workoutImport.pick.whereToFind')}>
        {EXPORT_HINTS.map((key) => (
          <ListRow key={key} variant="grouped" title={t(key)} trailing={null} />
        ))}
      </ListGroup>

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
