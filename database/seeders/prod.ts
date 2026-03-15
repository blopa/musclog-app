import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import { ENCRYPTION_KEY, SEEDING_COMPLETE_KEY } from '../../constants/database';
import usdaFoundationFoodsData from '../../data/usda_foundation_foods.json';
import i18n, { AVAILABLE_LANGUAGES, EN_US } from '../../lang/lang';
import { getEncryptionKey } from '../../utils/encryption';
import { preloadExerciseImages } from '../../utils/exerciseImage';
import { database } from '../database-instance';
import Food from '../models/Food';
import FoodFoodPortion from '../models/FoodFoodPortion';
import Setting from '../models/Setting';
import {
  ChatService,
  ExerciseService,
  FoodPortionService,
  FoodService,
  type MigrationProgressInfo,
  MigrationService,
  type MigrationStepKey,
  SettingsService,
} from '../services';

export type InitProgressPhase = 'seeding' | 'migrating';

export interface SeedProductionDataOptions {
  onProgress?: (info: {
    phase: InitProgressPhase;
    step?: MigrationStepKey;
    current?: number;
    total?: number;
  }) => void;
}
const clearAsyncStorage = async () => {
  const existingEncryptionKey = await AsyncStorage.getItem(ENCRYPTION_KEY);

  try {
    await AsyncStorage.clear();
    console.log('AsyncStorage has been cleared successfully.');
  } catch (error) {
    console.error('Error clearing AsyncStorage:', error);
  }

  if (existingEncryptionKey) {
    await AsyncStorage.setItem(ENCRYPTION_KEY, existingEncryptionKey);
  }
};

/**
 * Seed USDA foundation foods from JSON data (converted from CSV)
 */
async function seedUSDAFoundationFoods(): Promise<void> {
  try {
    // Check if foods already exist (skip if already seeded)
    const existingFoods = await FoodService.getAllFoods();
    const existingFoodsByExternalId = new Set(
      existingFoods.map((food) => food.externalId).filter((id): id is string => !!id)
    );

    if (existingFoodsByExternalId.size > 0) {
      console.log(
        `Skipping USDA foundation foods seeding: ${existingFoodsByExternalId.size} foods already exist`
      );
      return;
    }

    const rows = usdaFoundationFoodsData as Record<string, string>[];

    if (rows.length === 0) {
      console.warn('No data found in USDA foundation foods JSON');
      return;
    }

    console.log(`Seeding ${rows.length} foods from USDA foundation foods data`);

    // Ensure the 100g portion exists (should exist after createCommonPortions, but create if missing)
    let portion100g = await FoodPortionService.get100gPortion();
    if (!portion100g) {
      // Create 100g portion if it doesn't exist (fallback)
      console.log('100g portion not found, creating it...');
      portion100g = await FoodPortionService.getOrCreatePortion(
        i18n.t('food.portions.100g'),
        100,
        'scale',
        true
      );
    }

    // Create foods in batches
    const batchSize = 50;
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      await database.write(async () => {
        const now = Date.now();

        for (const row of batch) {
          const externalId = String(row.external_id || '');

          // Skip if already exists
          if (existingFoodsByExternalId.has(externalId)) {
            skippedCount++;
            continue;
          }

          try {
            // Parse numeric values
            const kcal = parseFloat(row.kcal || '0') || 0;
            const protein = parseFloat(row.protein || '0') || 0;
            const carbs = parseFloat(row.carbs || '0') || 0;
            const fat = parseFloat(row.fat || '0') || 0;
            const fiber = parseFloat(row.fiber || '0') || 0;
            const sugar = parseFloat(row.sugar || '0') || undefined;
            const sodium = parseFloat(row.sodium || '0') || undefined;
            const magnesium = parseFloat(row.magnesium || '0') || undefined;
            const vitaminC = parseFloat(row.vitamin_c || '0') || undefined;
            const vitaminD = parseFloat(row.vitamin_d || '0') || undefined;

            // Build micros object (only include non-zero values)
            const micros: Record<string, number> = {};
            if (sugar && sugar > 0) {
              micros.sugar = sugar;
            }

            if (sodium && sodium > 0) {
              micros.sodium = sodium;
            }

            if (magnesium && magnesium > 0) {
              micros.magnesium = magnesium;
            }

            if (vitaminC && vitaminC > 0) {
              micros.vitaminC = vitaminC;
            }

            if (vitaminD && vitaminD > 0) {
              micros.vitaminD = vitaminD;
            }

            // Create food directly in the write transaction (avoid nested writes)
            const food = await database.get<Food>('foods').create((food) => {
              food.isAiGenerated = false;
              food.name = row.description || row.name || '';
              food.brand = undefined;
              food.barcode = row.barcode || undefined;
              food.externalId = externalId;

              food.calories = kcal;
              food.protein = protein;
              food.carbs = carbs;
              food.fat = fat;
              food.fiber = fiber;

              // Store micros
              const microsData = {
                sugar: sugar && sugar > 0 ? sugar : undefined,
                sodium: sodium && sodium > 0 ? sodium : undefined,
                ...micros,
              };

              food.micros = Object.fromEntries(
                Object.entries(microsData).filter(([_, value]) => value !== undefined)
              );

              food.isFavorite = false;
              food.source = 'foundation';
              food.createdAt = now;
              food.updatedAt = now;
            });

            // Link food to the 100g portion
            await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
              ffp.foodId = food.id;
              ffp.foodPortionId = portion100g.id;
              ffp.isDefault = true;
              ffp.createdAt = now;
              ffp.updatedAt = now;
            });

            createdCount++;
            existingFoodsByExternalId.add(externalId); // Track created food
          } catch (error) {
            console.warn(`Failed to create food from row: ${row.name || row.description}`, error);
            skippedCount++;
          }
        }
      });
    }

    console.log(
      `USDA foundation foods seeding completed: ${createdCount} created, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error('Error seeding USDA foundation foods:', error);
    // Don't throw - allow seeding to continue even if this fails
  }
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
      // Repair any exercises that were seeded without an image due to a prior bug
      await ExerciseService.repairMissingExerciseImages();
      console.log('Production data seeding already completed, skipping');
      return true;
    }

    // Seeding flag is not set: either first run or app was closed during a previous
    // migration. Reset the database so we always start a fresh seed + migration.
    // Note: unsafeResetDatabase() MUST be called inside a write transaction
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });

      // TODO: super ugly hack, figure out a way to not do this
      // Longer delay to ensure IndexedDB connections are closed and database is ready.
      // On web, IndexedDB may log "blocked" warnings if connections are still open during
      // deletion. These warnings are harmless - the adapter handles them internally and
      // the reset completes successfully. This delay minimizes the chance of seeing them.
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify database is ready by attempting a simple query
      // This ensures the reset completed and the database is accessible
      let retries = 0;
      const maxRetries = 3;
      while (retries < maxRetries) {
        try {
          await database.get<Setting>('settings').query().fetchCount();
          break; // Success, exit retry loop
        } catch (verifyError) {
          retries++;
          if (retries >= maxRetries) {
            throw verifyError; // Re-throw if all retries failed
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      console.log('Database reset (clean slate for seeding/migration)');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error; // Re-throw to prevent continuing with a broken database state
    }

    // Clear async storage
    await clearAsyncStorage();

    // Ensure encryption key exists before any encrypted writes (seeding/migration)
    await getEncryptionKey();

    // 1. Seed common portions if none exist
    onProgress?.({ phase: 'seeding' });
    const existingPortions = await FoodPortionService.getAllPortions();

    if (existingPortions.length > 0) {
      console.log(`Skipping portion seeding: ${existingPortions.length} portions already exist`);
    } else {
      const createdPortions = await FoodPortionService.createCommonPortions();
      console.log(`Seeded ${createdPortions.length} common food portions`);
    }

    // Preload exercise images before seeding to ensure they're available in production builds
    await preloadExerciseImages();

    // 2. Seed common exercises from JSON first; migration will then add any from the old DB that are not already present (by name)
    const existingExercises = await ExerciseService.getAllExercises();

    if (existingExercises.length > 0) {
      console.log(`Skipping exercise seeding: ${existingExercises.length} exercises already exist`);
    } else {
      const createdExercises = await ExerciseService.createCommonExercises();
      console.log(`Seeded ${createdExercises.length} common exercises`);
    }

    // 3. Seed initial chat messages with welcome messages for each context using i18n
    const existingMessages = await ChatService.getAllMessages(1, 0);

    if (existingMessages.length === 0) {
      const sessionId = ChatService.generateSessionId();

      const contexts = [
        { key: 'coach.welcomeMessage', context: 'general' },
        { key: 'coach.welcomeMessageExercise', context: 'exercise' },
        { key: 'coach.welcomeMessageNutrition', context: 'nutrition' },
      ] as const;

      for (const { key, context } of contexts) {
        await ChatService.saveMessage({
          sessionId,
          sender: 'coach',
          message: i18n.t(key),
          messageType: 'text',
          context,
        });
      }

      console.log('Seeded initial welcome messages for all contexts from Loggy');
    } else {
      console.log(`Skipping chat seeding: ${existingMessages.length} messages already exist`);
    }

    // 4. Migrate data from the old database if it exists (e.g. app upgrade)
    const migrationService = new MigrationService();
    if (await migrationService.checkOldDatabaseExists()) {
      const result = await migrationService.migrateAll({
        onProgress: (info: MigrationProgressInfo) =>
          onProgress?.({
            phase: 'migrating',
            step: info.step,
            current: info.current,
            total: info.total,
          }),
      });

      if (result.success) {
        console.log(
          `Migration completed: ${result.exercises} exercises, ${result.workouts} workouts, ${result.workoutLogs} workout logs, ${result.templateSets} template sets, ${result.workoutLogSets} log sets`
        );
      } else {
        console.warn('Migration from old database failed:', result.error);
      }
    } else {
      console.log('Old database not present, skip migration...');
    }

    // Detect device language and save it into the settings for language
    const systemLocales = Localization.getLocales();
    const deviceLanguage =
      systemLocales.find((locale) => AVAILABLE_LANGUAGES.includes(locale.languageTag as any))
        ?.languageTag || EN_US;

    await SettingsService.setLanguage(deviceLanguage);
    console.log(`Set language to: ${deviceLanguage}`);

    // 5. Seed USDA foundation foods from CSV
    await seedUSDAFoundationFoods();

    // Set the anonymousBugReport setting to true by default
    await SettingsService.setAnonymousBugReport(true);
    console.log('Set anonymous bug report to true by default');

    // Set default notification settings to false
    await SettingsService.setNotifications(false);
    await SettingsService.setNotificationsWorkoutReminders(false);
    await SettingsService.setNotificationsActiveWorkout(false);
    await SettingsService.setNotificationsNutritionOverview(false);
    await SettingsService.setNotificationsMenstrualCycle(false);
    await SettingsService.setNotificationsRestTimer(false);
    await SettingsService.setNotificationsWorkoutDuration(false);
    console.log('Set default notification settings to false');

    await SettingsService.setCoachConversationContext('general');
    console.log('Set default coach conversation context to general');

    // Set default navigation bar slots
    await SettingsService.setNavSlot(1, 'workouts');
    await SettingsService.setNavSlot(2, 'food');
    await SettingsService.setNavSlot(3, 'profile');
    console.log('Set default navigation bar slots: workouts, food, profile');

    // Set default food search source to both (Open Food Facts + USDA)
    await SettingsService.setFoodSearchSource('both');
    console.log('Set default food search source to both');

    await SettingsService.setSendFoundationFoodsToLlm(true);
    console.log('Set default send foundation foods to LLM to true');

    // Mark seeding as complete
    await AsyncStorage.setItem(SEEDING_COMPLETE_KEY, 'true');
    console.log('Production data seeding completed successfully');

    return true;
  } catch (error) {
    console.error('Error seeding production data:', error);
    throw error;
  }
}
