import { useCallback, useState } from 'react';

import { type MigrationResult, MigrationService } from '../database/services/MigrationService';

export interface MigrationSummary {
  fitnessGoalsCount: number;
  userMetricsCount: number;
  tables: string[];
}

export interface UseOldDatabaseMigrationReturn {
  // State
  migrationSummary: MigrationSummary | null;
  migrationResult: MigrationResult | null;
  migrating: boolean;
  checkingOldDatabase: boolean;

  // Actions
  checkMigrationData: () => Promise<void>;
  executeMigration: () => Promise<void>;
  resetMigration: () => void;
}

export const useOldDatabaseMigration = (): UseOldDatabaseMigrationReturn => {
  const [migrationService] = useState(() => new MigrationService());
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [checkingOldDatabase, setCheckingOldDatabase] = useState(false);

  const checkMigrationData = useCallback(async () => {
    setCheckingOldDatabase(true);
    setMigrationSummary(null);

    try {
      const summary = await migrationService.getMigrationSummary();
      setMigrationSummary(summary);
    } catch (error) {
      console.error('Error loading migration summary:', error);
      setMigrationSummary(null);
    } finally {
      setCheckingOldDatabase(false);
    }
  }, [migrationService]);

  const executeMigration = useCallback(async () => {
    setMigrating(true);
    setMigrationResult(null);

    try {
      const result = await migrationService.migrateAll();
      setMigrationResult(result);
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fitnessGoals: 0,
        userMetrics: 0,
        details: {
          fitnessGoalsMigrated: 0,
          userMetricsMigrated: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
    } finally {
      setMigrating(false);
    }
  }, [migrationService]);

  const resetMigration = useCallback(() => {
    setMigrationResult(null);
    setMigrationSummary(null);
  }, []);

  return {
    // State
    migrationSummary,
    migrationResult,
    migrating,
    checkingOldDatabase,

    // Actions
    checkMigrationData,
    executeMigration,
    resetMigration,
  };
};
