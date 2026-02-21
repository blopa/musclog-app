import { Database, Download } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useOldDatabaseMigration } from '../hooks/useOldDatabaseMigration';
import { theme } from '../theme';

export const MigrationSection = () => {
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
        <Text className="text-lg font-bold text-text-primary">Data Migration</Text>
      </View>
      <Text className="text-sm text-text-secondary">
        Import data from old database to new WatermelonDB
      </Text>

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
            Check Migration Data
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
            {migrating ? 'Migrating...' : 'Import Data'}
          </Text>
        </Pressable>
      </View>

      {migrationSummary ? (
        <View className="rounded-lg border border-border-light bg-bg-primary p-3">
          <Text className="mb-2 text-sm font-bold text-text-primary">Migration Summary:</Text>
          <Text className="text-sm text-text-secondary">
            • Fitness Goals: {migrationSummary.fitnessGoalsCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • User Metrics: {migrationSummary.userMetricsCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Users: {migrationSummary.usersCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Foods: {migrationSummary.foodsCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Nutrition Logs: {migrationSummary.nutritionLogsCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Exercises: {migrationSummary.exercisesCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Workouts: {migrationSummary.workoutsCount} records
          </Text>
          <Text className="text-sm text-text-secondary">
            • Tables Found: {migrationSummary.tables.join(', ')}
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
            {migrationResult.success ? 'Migration Successful!' : 'Migration Failed'}
          </Text>

          {migrationResult.success ? (
            <View>
              <Text className="text-status-success text-sm">
                • Fitness Goals: {migrationResult.details.fitnessGoalsMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • User Metrics: {migrationResult.details.userMetricsMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • Users: {migrationResult.details.usersMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • Foods: {migrationResult.details.foodsMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • Nutrition Logs: {migrationResult.details.nutritionLogsMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • Exercises: {migrationResult.details.exercisesMigrated} migrated
              </Text>
              <Text className="text-status-success text-sm">
                • Workouts: {migrationResult.details.workoutsMigrated} migrated
              </Text>
            </View>
          ) : (
            <Text className="text-status-error text-sm">Error: {migrationResult.error}</Text>
          )}
        </View>
      ) : null}

      {!migrationSummary && !checkingOldDatabase ? (
        <Text className="py-2 text-sm text-text-tertiary">
          Click Check Migration Data to see what can be migrated
        </Text>
      ) : null}

      {migrationResult ? (
        <Pressable
          className="mt-2 self-center rounded-lg border border-border-light bg-bg-primary px-4 py-2"
          onPress={resetMigration}
        >
          <Text className="text-sm text-text-secondary">Reset Migration</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
