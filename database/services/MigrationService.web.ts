import type { MigrationResult } from './MigrationService';

export class MigrationService {
  private static instance: MigrationService;

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  /**
   * Mock implementation for web - always returns true to simulate database exists
   */
  async checkOldDatabaseExists(): Promise<boolean> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }

  /**
   * Mock implementation for web - returns sample table names
   */
  async getOldDatabaseTables(): Promise<string[]> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      'FitnessGoals',
      'UserMetrics',
      'Exercise',
      'Food',
      'Meal',
      'Workout',
      'User',
      'Setting'
    ];
  }

  /**
   * Mock implementation for web - returns sample migration summary
   */
  async getMigrationSummary(): Promise<{
    fitnessGoalsCount: number;
    userMetricsCount: number;
    tables: string[];
  }> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      fitnessGoalsCount: 2, // Mock data
      userMetricsCount: 5, // Mock data
      tables: [
        'FitnessGoals',
        'UserMetrics',
        'Exercise',
        'Food',
        'Meal',
        'Workout',
        'User',
        'Setting'
      ],
    };
  }

  /**
   * Mock implementation for web - simulates successful migration
   */
  async migrateAll(): Promise<MigrationResult> {
    // Simulate migration process with delay
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay to show loading
    
    // Simulate random success/failure for testing (90% success rate)
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        fitnessGoals: 2,
        userMetrics: 5,
        details: {
          fitnessGoalsMigrated: 2,
          userMetricsMigrated: 5,
          errors: [],
        },
      };
    } else {
      return {
        success: false,
        fitnessGoals: 0,
        userMetrics: 0,
        error: 'Mock migration failed for testing purposes',
        details: {
          fitnessGoalsMigrated: 0,
          userMetricsMigrated: 0,
          errors: ['Mock migration failed for testing purposes'],
        },
      };
    }
  }
}

// Export singleton instance
export const migrationService = MigrationService.getInstance();
