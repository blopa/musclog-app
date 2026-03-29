import { Database, Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useOldDatabaseMigration } from '../hooks/useOldDatabaseMigration';
import { useTheme } from '../hooks/useTheme';

export const MigrationSection = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    migrationSummary,
    migrationResult,
    migrating,
    checkingOldDatabase,
    checkMigrationData,
    executeMigration,
    resetMigration,
  } = useOldDatabaseMigration();

  return (
    <View className="gap-4 rounded-xl border border-border-accent bg-bg-overlay p-4">
      <View className="flex-row items-center gap-2">
        <Download size={theme.iconSize.lg} color={theme.colors.text.primary} />
        <Text className="text-lg font-bold text-text-primary">{t('settings.migration.title')}</Text>
      </View>
      <Text className="text-sm text-text-secondary">{t('settings.migration.description')}</Text>
      <View className="flex-row gap-2">
        <Pressable
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg p-3 ${
            checkingOldDatabase ? 'bg-border-light' : 'bg-accent-primary'
          }`}
          onPress={checkMigrationData}
          disabled={checkingOldDatabase}
        >
          <Database
            size={theme.iconSize.md}
            color={checkingOldDatabase ? theme.colors.text.tertiary : theme.colors.text.black}
          />
          <Text
            className={`text-sm font-bold ${
              checkingOldDatabase ? 'text-text-tertiary' : 'text-text-black'
            }`}
          >
            {t('settings.migration.checkMigrationData')}
          </Text>
        </Pressable>

        <Pressable
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg p-3 ${
            migrating ? 'bg-border-light' : 'bg-success-primary'
          }`}
          onPress={executeMigration}
          disabled={migrating || !migrationSummary}
        >
          <Download
            size={theme.iconSize.md}
            color={migrating ? theme.colors.text.tertiary : theme.colors.text.black}
          />
          <Text
            className={`text-sm font-bold ${migrating ? 'text-text-tertiary' : 'text-text-black'}`}
          >
            {migrating ? t('settings.migration.migrating') : t('settings.migration.importData')}
          </Text>
        </Pressable>
      </View>
      {migrationSummary ? (
        <View className="rounded-lg border border-border-light bg-bg-primary p-3">
          <Text className="mb-2 text-sm font-bold text-text-primary">
            {t('settings.migration.summary')}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.fitnessGoals'),
              value: `${migrationSummary.fitnessGoalsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.userMetrics'),
              value: `${migrationSummary.userMetricsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.users'),
              value: `${migrationSummary.usersCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.foods'),
              value: `${migrationSummary.foodsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.nutritionLogs'),
              value: `${migrationSummary.nutritionLogsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.exercises'),
              value: `${migrationSummary.exercisesCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.workouts'),
              value: `${migrationSummary.workoutsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.workoutLogs'),
              value: `${migrationSummary.workoutLogsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.templateSets'),
              value: `${migrationSummary.templateSetsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            •{' '}
            {t('common.labelColonValue', {
              label: t('settings.migration.summaryItems.logSets'),
              value: `${migrationSummary.logSetsCount} ${t('settings.migration.records')}`,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            • {t('settings.migration.tablesFound')} {migrationSummary.tables.join(', ')}
          </Text>
        </View>
      ) : null}
      {migrationResult ? (
        <View
          className={`rounded-lg border p-3 ${
            migrationResult.success
              ? 'border-status-success bg-bg-success'
              : 'border-status-error bg-bg-error'
          }`}
        >
          <Text
            className={`mb-2 text-sm font-bold ${
              migrationResult.success ? 'text-status-success' : 'text-status-error'
            }`}
          >
            {migrationResult.success
              ? t('settings.migration.successful')
              : t('settings.migration.failed')}
          </Text>

          {migrationResult.success ? (
            <View>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.fitnessGoals')}:{' '}
                {migrationResult.details.fitnessGoalsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.userMetrics')}:{' '}
                {migrationResult.details.userMetricsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.users')}:{' '}
                {migrationResult.details.usersMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.foods')}:{' '}
                {migrationResult.details.foodsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.nutritionLogs')}:{' '}
                {migrationResult.details.nutritionLogsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.exercises')}:{' '}
                {migrationResult.details.exercisesMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.workouts')}:{' '}
                {migrationResult.details.workoutsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.workoutLogs')}:{' '}
                {migrationResult.details.workoutLogsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.templateSets')}:{' '}
                {migrationResult.details.templateSetsMigrated} {t('settings.migration.migrated')}
              </Text>
              <Text className="text-status-success text-sm">
                • {t('settings.migration.summaryItems.logSets')}:{' '}
                {migrationResult.details.logSetsMigrated} {t('settings.migration.migrated')}
              </Text>
            </View>
          ) : (
            <Text className="text-status-error text-sm">
              {t('settings.migration.error', { error: migrationResult.error })}
            </Text>
          )}
        </View>
      ) : null}
      {!migrationSummary && !checkingOldDatabase ? (
        <Text className="py-2 text-sm text-text-tertiary">
          {t('settings.migration.clickToCheck')}
        </Text>
      ) : null}
      {migrationResult ? (
        <Pressable
          className="mt-2 self-center rounded-lg border border-border-light bg-bg-primary px-4 py-2"
          onPress={resetMigration}
        >
          <Text className="text-sm text-text-secondary">
            {t('settings.migration.resetMigration')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};
