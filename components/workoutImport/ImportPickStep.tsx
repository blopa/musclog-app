import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { LoggyPose } from '@/components/LoggyPose';
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

const HERO_POSE_HEIGHT = 156;

/** Where to find each app's export: one row per app, whole keys only. */
const EXPORT_HINTS = [
  { app: 'Strong', hintKey: 'workoutImport.pick.strongHint' },
  { app: 'Hevy', hintKey: 'workoutImport.pick.hevyHint' },
  { app: 'FitNotes', hintKey: 'workoutImport.pick.fitnotesHint' },
] as const;

/** The file and paste actions live in the modal footer, pinned where the thumb is. */
export function ImportPickStep({ batches, onUndo }: ImportPickStepProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <View className="gap-6 px-4 py-4">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-2xl font-bold text-text-primary">
            {t('workoutImport.pick.title')}
          </Text>
          <Text className="text-base text-text-secondary">
            {t('workoutImport.pick.supportedApps')}
          </Text>
        </View>
        <LoggyPose pose="writing" height={HERO_POSE_HEIGHT} />
      </View>

      <ListGroup title={t('workoutImport.pick.whereToFind')}>
        {EXPORT_HINTS.map(({ app, hintKey }) => (
          <View key={app} className="gap-0.5 px-4 py-3">
            <Text className="text-base font-semibold text-text-primary">{app}</Text>
            <Text className="text-base text-text-secondary">{t(hintKey)}</Text>
          </View>
        ))}
      </ListGroup>

      <Text className="text-base text-text-secondary">{t('workoutImport.pick.safety')}</Text>

      {batches.length > 0 ? (
        <ListGroup title={t('workoutImport.pick.past')}>
          {batches.map((batch) => (
            <ListRow
              key={batch.batchId}
              variant="grouped"
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
