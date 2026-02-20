import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { database } from '../database-instance';
import { NutritionGoal, UserMetric } from '../models';

export interface MigrationResult {
  success: boolean;
  error?: string;
  fitnessGoals: number;
  userMetrics: number;
  details: {
    fitnessGoalsMigrated: number;
    userMetricsMigrated: number;
    errors: string[];
  };
}

export class MigrationService {
  private oldDB: SQLiteDatabase | null = null;

  constructor() {
    try {
      this.oldDB = openDatabaseSync('workoutLoggerDatabase.db', {
        enableChangeListener: true,
        useNewConnection: true,
      });
    } catch (error) {
      console.log('Old database not found or not accessible:', error);
    }
  }

  /**
   * Check if old database exists and is accessible
   */
  async checkOldDatabaseExists(): Promise<boolean> {
    if (!this.oldDB) return false;
    
    try {
      await this.oldDB.getAllAsync('SELECT 1 FROM sqlite_master LIMIT 1');
      return true;
    } catch (error) {
      console.error('Error accessing old database:', error);
      return false;
    }
  }

  /**
   * Get table names from old database
   */
  async getOldDatabaseTables(): Promise<string[]> {
    if (!this.oldDB) throw new Error('Old database not available');
    
    const result = await this.oldDB.getAllAsync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    return result.map((row: any) => row.name);
  }

  /**
   * Convert TEXT timestamp to Unix timestamp (number)
   */
  private convertTimestamp(textTimestamp: string | null): number {
    if (!textTimestamp) return Date.now();
    
    try {
      // Handle ISO format and other common timestamp formats
      const date = new Date(textTimestamp);
      if (isNaN(date.getTime())) {
        // If parsing fails, use current time
        return Date.now();
      }
      return date.getTime();
    } catch (error) {
      console.warn('Failed to parse timestamp:', textTimestamp);
      return Date.now();
    }
  }

  /**
   * Migrate fitness goals from old FitnessGoals table to new nutrition_goals table
   */
  private async migrateFitnessGoals(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');
    
    const oldGoals = await this.oldDB.getAllAsync(`
      SELECT * FROM FitnessGoals 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `);
    
    let migratedCount = 0;
    
    for (const oldGoal of oldGoals) {
      try {
        await database.write(async () => {
          await database.get<NutritionGoal>('nutrition_goals').create((newGoal) => {
            newGoal.totalCalories = Number(oldGoal.calories) || 0;
            newGoal.protein = Number(oldGoal.protein) || 0;
            newGoal.carbs = Number(oldGoal.totalCarbohydrate) || 0;
            newGoal.fats = Number(oldGoal.totalFat) || 0;
            newGoal.fiber = Number(oldGoal.fiber) || 0;
            newGoal.targetWeight = Number(oldGoal.weight) || 0;
            newGoal.targetBodyFat = Number(oldGoal.bodyFat) || 0;
            newGoal.targetBmi = Number(oldGoal.bmi) || 0;
            newGoal.targetFfmi = Number(oldGoal.ffmi) || 0;
            newGoal.eatingPhase = 'maintain'; // Default value
            newGoal.targetDate = null; // Optional field
            newGoal.effectiveUntil = null; // Current goals have no end date
            newGoal.createdAt = this.convertTimestamp(oldGoal.createdAt);
            newGoal.updatedAt = this.convertTimestamp(oldGoal.createdAt);
            newGoal.deletedAt = oldGoal.deletedAt ? this.convertTimestamp(oldGoal.deletedAt) : undefined;
          });
        });
        migratedCount++;
      } catch (error) {
        console.error('Error migrating fitness goal:', error, 'Data:', oldGoal);
        throw new Error(`Failed to migrate fitness goal: ${error.message}`);
      }
    }
    
    return migratedCount;
  }

  /**
   * Migrate user metrics from old UserMetrics table to new user_metrics table
   */
  private async migrateUserMetrics(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');
    
    const oldMetrics = await this.oldDB.getAllAsync(`
      SELECT * FROM UserMetrics 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `);
    
    let migratedCount = 0;
    
    for (const oldMetric of oldMetrics) {
      const baseTimestamp = this.convertTimestamp(oldMetric.createdAt);
      const dateTimestamp = this.convertTimestamp(oldMetric.date);
      
      // Create separate records for each metric type
      const metricTypes = [
        { field: 'weight', type: 'weight', unit: 'kg' },
        { field: 'height', type: 'height', unit: 'cm' },
        { field: 'fatPercentage', type: 'body_fat', unit: '%' },
      ];
      
      for (const metricType of metricTypes) {
        const value = oldMetric[metricType.field];
        if (value && value !== '' && value !== null) {
          try {
            await database.write(async () => {
              await database.get<UserMetric>('user_metrics').create((newMetric) => {
                newMetric.type = metricType.type;
                newMetric.value = Number(value);
                newMetric.unit = metricType.unit;
                newMetric.date = dateTimestamp;
                newMetric.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                newMetric.createdAt = baseTimestamp;
                newMetric.updatedAt = baseTimestamp;
                newMetric.deletedAt = oldMetric.deletedAt ? this.convertTimestamp(oldMetric.deletedAt) : undefined;
              });
            });
            migratedCount++;
          } catch (error) {
            console.error(`Error migrating user metric ${metricType.type}:`, error, 'Data:', oldMetric);
            throw new Error(`Failed to migrate user metric ${metricType.type}: ${error.message}`);
          }
        }
      }
    }
    
    return migratedCount;
  }

  /**
   * Validate migration integrity
   */
  private async validateMigration(result: MigrationResult): Promise<void> {
    // Check that we have the expected number of records
    const nutritionGoalsCount = await database.get<NutritionGoal>('nutrition_goals').query().fetchCount();
    const userMetricsCount = await database.get<UserMetric>('user_metrics').query().fetchCount();
    
    console.log(`Migration validation: ${nutritionGoalsCount} nutrition goals, ${userMetricsCount} user metrics`);
    
    // Basic validation - ensure we have some data if migration succeeded
    if (result.details.fitnessGoalsMigrated > 0 && nutritionGoalsCount === 0) {
      throw new Error('Fitness goals migration validation failed');
    }
    
    if (result.details.userMetricsMigrated > 0 && userMetricsCount === 0) {
      throw new Error('User metrics migration validation failed');
    }
  }

  /**
   * Execute complete migration
   */
  async migrateAll(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      fitnessGoals: 0,
      userMetrics: 0,
      details: {
        fitnessGoalsMigrated: 0,
        userMetricsMigrated: 0,
        errors: [],
      },
    };
    
    try {
      // Step 1: Check if old database exists
      if (!await this.checkOldDatabaseExists()) {
        throw new Error('Old database not found or not accessible');
      }
      
      console.log('Starting migration from old database...');
      
      // Step 2: Migrate Fitness Goals
      console.log('Migrating fitness goals...');
      result.details.fitnessGoalsMigrated = await this.migrateFitnessGoals();
      result.fitnessGoals = result.details.fitnessGoalsMigrated;
      
      // Step 3: Migrate User Metrics
      console.log('Migrating user metrics...');
      result.details.userMetricsMigrated = await this.migrateUserMetrics();
      result.userMetrics = result.details.userMetricsMigrated;
      
      // Step 4: Validate migration
      console.log('Validating migration...');
      await this.validateMigration(result);
      
      result.success = true;
      console.log('Migration completed successfully!');
      
    } catch (error) {
      console.error('Migration failed:', error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.details.errors.push(result.error);
      result.success = false;
    }
    
    return result;
  }

  /**
   * Get migration summary without actually migrating
   */
  async getMigrationSummary(): Promise<{
    fitnessGoalsCount: number;
    userMetricsCount: number;
    tables: string[];
  }> {
    if (!this.oldDB) {
      return {
        fitnessGoalsCount: 0,
        userMetricsCount: 0,
        tables: [],
      };
    }
    
    const tables = await this.getOldDatabaseTables();
    
    let fitnessGoalsCount = 0;
    let userMetricsCount = 0;
    
    try {
      if (tables.includes('FitnessGoals')) {
        const result = await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM FitnessGoals 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `);
        fitnessGoalsCount = result[0]?.count || 0;
      }
      
      if (tables.includes('UserMetrics')) {
        const result = await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM UserMetrics 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `);
        userMetricsCount = result[0]?.count || 0;
      }
    } catch (error) {
      console.error('Error getting migration summary:', error);
    }
    
    return {
      fitnessGoalsCount,
      userMetricsCount,
      tables,
    };
  }
}
