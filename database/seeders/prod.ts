import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEEDING_COMPLETE_KEY } from '../../constants/database';
import { database } from '../database-instance';
import {
  ExerciseService,
  FoodPortionService,
  MigrationService,
  type MigrationStepKey,
} from '../services';

export type InitProgressPhase = 'seeding' | 'migrating';

export interface SeedProductionDataOptions {
  onProgress?: (info: { phase: InitProgressPhase; step?: MigrationStepKey }) => void;
}

/**
 * Seed production data
 * This seeds only the common food portions and exercises that will be available in the production app
 * Foods are NOT seeded in production - users will add them as needed via the app
 *
 * Order: seed common portions and exercises first, then run migration from the old database.
 * Migration reuses existing exercises by name (only adds old exercises that are not already seeded).
 */
export async function seedProductionData(options?: SeedProductionDataOptions): Promise<boolean> {
  const onProgress = options?.onProgress;

  try {
    // Check if seeding has already been completed
    const seedingComplete = await AsyncStorage.getItem(SEEDING_COMPLETE_KEY);
    if (seedingComplete === 'true') {
      console.log('Production data seeding already completed, skipping');
      return true;
    }

    // Seeding flag is not set: either first run or app was closed during a previous
    // migration. Reset the database so we always start a fresh seed + migration.
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      console.log('Database reset (clean slate for seeding/migration)');
    } catch (error) {
      console.error('Error deleting database:', error);
    }

    // 1. Seed common portions if none exist
    onProgress?.({ phase: 'seeding' });
    const existingPortions = await FoodPortionService.getAllPortions();

    if (existingPortions.length > 0) {
      console.log(`Skipping portion seeding: ${existingPortions.length} portions already exist`);
    } else {
      const createdPortions = await FoodPortionService.createCommonPortions();
      console.log(`Seeded ${createdPortions.length} common food portions`);
    }

    // 2. Seed common exercises from JSON first; migration will then add any from the old DB that are not already present (by name)
    const existingExercises = await ExerciseService.getAllExercises();

    if (existingExercises.length > 0) {
      console.log(`Skipping exercise seeding: ${existingExercises.length} exercises already exist`);
    } else {
      const createdExercises = await ExerciseService.createCommonExercises();
      console.log(`Seeded ${createdExercises.length} common exercises`);
    }

    // 3. Migrate data from the old database if it exists (e.g. app upgrade)
    const migrationService = new MigrationService();
    if (await migrationService.checkOldDatabaseExists()) {
      const result = await migrationService.migrateAll({
        onProgress: (step) => onProgress?.({ phase: 'migrating', step }),
      });
      if (result.success) {
        console.log(
          `Migration completed: ${result.exercises} exercises, ${result.workouts} workouts, ${result.workoutLogs} workout logs, ${result.templateSets} template sets, ${result.workoutLogSets} log sets`
        );
      } else {
        console.warn('Migration from old database failed:', result.error);
      }
    }

    // Mark seeding as complete
    await AsyncStorage.setItem(SEEDING_COMPLETE_KEY, 'true');
    console.log('Production data seeding completed successfully');

    return true;
  } catch (error) {
    console.error('Error seeding production data:', error);
    throw error;
  }
}
