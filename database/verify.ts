/**
 * Database verification utility
 * Helps catch database initialization issues during development
 */

import { database } from './database-instance';

/**
 * Verify that all required tables exist in the database
 * This is useful in development to catch migration issues
 */
export async function verifyDatabaseTables(): Promise<{
  success: boolean;
  missingTables: string[];
  error?: Error;
}> {
  const requiredTables = [
    'exercises',
    'workout_templates',
    'schedules',
    'workout_template_exercises',
    'workout_template_sets',
    'workout_logs',
    'workout_log_exercises',
    'workout_log_sets',
    'foods',
    'food_portions',
    'food_food_portions',
    'supplements',
    'meals',
    'meal_foods',
    'nutrition_logs',
    'user_metrics',
    'user_metrics_notes',
    'settings',
    'users',
    'nutrition_goals',
    'nutrition_checkins',
    'menstrual_cycles',
    'chat_messages',
  ];

  const missingTables: string[] = [];

  try {
    // Try to query each table
    for (const tableName of requiredTables) {
      try {
        const collection = database.get(tableName);
        // Try to fetch one record to verify table exists
        await collection.query().fetch();
      } catch (error) {
        if (error instanceof Error && error.message.includes('no such table')) {
          missingTables.push(tableName);
        } else {
          // Some other error - rethrow
          throw error;
        }
      }
    }

    if (missingTables.length > 0) {
      console.error('❌ Database tables missing:', missingTables);
      console.error(
        '⚠️  FIX: Uninstall the app completely and reinstall to recreate the database.'
      );
      return { success: false, missingTables };
    }

    console.log('✅ All database tables verified');
    return { success: true, missingTables: [] };
  } catch (error) {
    console.error('❌ Error verifying database tables:', error);
    return { success: false, missingTables, error: error as Error };
  }
}

/**
 * Get database diagnostic information
 */
export async function getDatabaseDiagnostics(): Promise<{
  schemaVersion: number;
  tableCount: number;
  collections: string[];
}> {
  const collections = Object.values(database.collections).map((c) => c.table);

  return {
    schemaVersion: database.schema.version,
    tableCount: collections.length,
    collections,
  };
}
