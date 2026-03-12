import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { ENCRYPTION_KEY } from '../../constants/database';
import i18n from '../../lang/lang';
import { decryptDatabaseValue } from '../../utils/encryption';
import { database } from '../database-instance';
import { encryptNutritionLogSnapshot, encryptUserMetricFields } from '../encryptionHelpers';
import {
  type EquipmentType,
  Exercise,
  Food,
  FoodFoodPortion,
  MealFood,
  NutritionGoal,
  NutritionLog,
  User,
  UserMetric,
  WorkoutLog,
  WorkoutLogExercise,
  WorkoutLogSet,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutTemplateSet,
} from '../models';

/** Step keys for progress reporting during migration (for landing screen copy). */
export type MigrationStepKey =
  | 'fitness_goals'
  | 'user_metrics'
  | 'users'
  | 'foods'
  | 'nutrition_logs'
  | 'exercises'
  | 'workouts'
  | 'workout_logs'
  | 'workout_template_sets'
  | 'workout_log_sets'
  | 'validating';

export interface MigrationProgressInfo {
  step: MigrationStepKey;
  current?: number;
  total?: number;
}

export interface MigrateAllOptions {
  onProgress?: (info: MigrationProgressInfo) => void;
}

export interface MigrationResult {
  success: boolean;
  error?: string;
  fitnessGoals: number;
  userMetrics: number;
  users: number;
  foods: number;
  nutritionLogs: number;
  exercises: number;
  workouts: number;
  workoutLogs: number;
  templateSets: number;
  workoutLogSets: number;
  details: {
    fitnessGoalsMigrated: number;
    userMetricsMigrated: number;
    usersMigrated: number;
    foodsMigrated: number;
    nutritionLogsMigrated: number;
    exercisesMigrated: number;
    workoutsMigrated: number;
    workoutLogsMigrated: number;
    templateSetsMigrated: number;
    logSetsMigrated: number;
    errors: string[];
  };
}

const getOldEncryptionKey = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(ENCRYPTION_KEY);
  } catch (error) {
    console.warn('Could not retrieve encryption key:', error);
    return null;
  }
};

export class MigrationService {
  private oldDB: SQLiteDatabase | null = null;

  /** Old Exercise id (number) → new exercise id (string). Populated during migrateExercises(). */
  private exerciseIdMap: Map<number, string> = new Map();
  /** Old Workout id (number) → new workout_templates id (string). Populated during migrateWorkouts(). */
  private workoutIdToTemplateId: Map<number, string> = new Map();
  /** Old WorkoutEvent id (number) → new workout_logs id (string). Populated during migrateWorkoutLogs(). */
  private workoutEventIdToLogId: Map<number, string> = new Map();
  /** Old Food id (number) → new foods id (string). Populated during migrateFoods(). */
  private foodIdMap: Map<number, string> = new Map();

  constructor() {
    try {
      console.log('Opening old database...');

      this.oldDB = openDatabaseSync('workoutLoggerDatabase.db', {
        enableChangeListener: true,
        useNewConnection: true,
      });
    } catch (error) {
      console.log('Old database not found or not accessible:', error);
    }
  }

  /**
   * Returns a progress callback that throttles updates to ~every 1% (or at 0 and total)
   * so we don't flood the UI on large tables.
   */
  private createProgressReporter(
    step: MigrationStepKey,
    onProgress: ((info: MigrationProgressInfo) => void) | undefined
  ): (current: number, total: number) => void {
    if (!onProgress) {
      return () => {};
    }
    let lastPercent = -1;
    return (current: number, total: number) => {
      if (total <= 0) {
        onProgress({ step, current: 0, total: 0 });
        return;
      }
      const percent = Math.floor((current / total) * 100);
      if (current === 0 || current === total || percent !== lastPercent) {
        lastPercent = percent;
        onProgress({ step, current, total });
      }
    };
  }

  /**
   * Check if old database exists and is accessible
   */
  async checkOldDatabaseExists(): Promise<boolean> {
    if (!this.oldDB) {
      return false;
    }

    try {
      // openDatabaseSync creates an empty DB if none exists, so querying sqlite_master always
      // succeeds. Instead, verify that at least one of the expected old-app tables is present.
      const expectedTables = [
        'FitnessGoals',
        'UserMetrics',
        'User',
        'Food',
        'UserNutrition',
        'Exercise',
        'Workout',
        'WorkoutEvent',
        'Set',
      ];

      const placeholders = expectedTables.map(() => '?').join(',');
      const result = (await this.oldDB.getAllAsync(
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`,
        expectedTables
      )) as { count: number }[];
      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      console.error('Error accessing old database:', error);
      return false;
    }
  }

  /**
   * Get table names from old database
   */
  async getOldDatabaseTables(): Promise<string[]> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    const result = await this.oldDB.getAllAsync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    return result.map((row: any) => row.name);
  }

  /**
   * Check if a table exists in the old database
   */
  private async tableExists(tableName: string): Promise<boolean> {
    if (!this.oldDB) {
      return false;
    }

    try {
      const result = await this.oldDB.getAllAsync(
        `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name = ?
      `,
        [tableName]
      );

      return result.length > 0;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Get table schema for a specific table
   */
  async getTableSchema(
    tableName: string
  ): Promise<{ name: string; type: string; notnull: boolean; pk: boolean }[]> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    const pragmaResult = await this.oldDB.getAllAsync(`PRAGMA table_info(${tableName})`);
    return pragmaResult.map((row: any) => ({
      name: row.name,
      type: row.type,
      notnull: Boolean(row.notnull),
      pk: Boolean(row.pk),
    }));
  }

  /**
   * Convert TEXT timestamp to Unix timestamp (number)
   */
  private convertTimestamp(textTimestamp: string | null): number {
    if (!textTimestamp) {
      return Date.now();
    }

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
  private async migrateFitnessGoals(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if FitnessGoals table exists
    const tableExists = await this.tableExists('FitnessGoals');
    if (!tableExists) {
      console.log('FitnessGoals table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldGoals = (await this.oldDB.getAllAsync(`
      SELECT * FROM FitnessGoals 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldGoals.length;
    reportProgress?.(0, total);
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
            newGoal.deletedAt = oldGoal.deletedAt
              ? this.convertTimestamp(oldGoal.deletedAt)
              : undefined;
          });
        });
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating fitness goal:', error, 'Data:', oldGoal);
        throw new Error(
          `Failed to migrate fitness goal: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Migrate user metrics from old UserMetrics table to new user_metrics table
   */
  private async migrateUserMetrics(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if UserMetrics table exists
    const tableExists = await this.tableExists('UserMetrics');
    if (!tableExists) {
      console.log('UserMetrics table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const encKey = await getOldEncryptionKey();
    if (encKey) {
      console.log('MUSCLOG: The encryption key is ', encKey);
    }

    const oldMetrics = (await this.oldDB.getAllAsync(`
      SELECT * FROM UserMetrics 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldMetrics.length;
    reportProgress?.(0, total);
    let migratedCount = 0;
    let processedRows = 0;

    for (const oldMetric of oldMetrics) {
      const baseTimestamp = this.convertTimestamp(oldMetric.createdAt);
      const dateTimestamp = this.convertTimestamp(oldMetric.date);

      // Create separate records for each metric type
      const metricTypes = [
        { field: 'weight', type: 'weight' as const, unit: 'kg', convert: (value: number) => value },
        {
          field: 'height',
          type: 'height' as const,
          unit: 'cm',
          convert: (value: number) =>
            value < 3 ? (convert(value, 'm').to('cm') as number) : value, // height might be in cm or m
        },
        {
          field: 'fatPercentage',
          type: 'body_fat' as const,
          unit: '%',
          convert: (value: number) => value,
        },
      ];

      for (const metricType of metricTypes) {
        const encryptedValue = oldMetric[metricType.field];
        if (encryptedValue && encryptedValue !== '' && encryptedValue !== null) {
          try {
            // Try to decrypt the value
            const decryptedValue = await decryptDatabaseValue(encryptedValue);
            const numericValue = parseFloat(decryptedValue);

            if (!isNaN(numericValue)) {
              const finalValue = metricType.convert(numericValue);
              // console.log(
              //   `Migrating ${metricType.type}: ${finalValue} ${metricType.unit} from date ${oldMetric.date}`
              // );
              const encrypted = await encryptUserMetricFields({
                value: finalValue,
                unit: metricType.unit,
                date: dateTimestamp,
              });
              await database.write(async () => {
                await database.get<UserMetric>('user_metrics').create((newMetric) => {
                  newMetric.type = metricType.type;
                  newMetric.valueRaw = encrypted.value;
                  newMetric.unitRaw = encrypted.unit;
                  newMetric.date = dateTimestamp;
                  newMetric.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                  newMetric.createdAt = baseTimestamp;
                  newMetric.updatedAt = baseTimestamp;
                  newMetric.deletedAt = oldMetric.deletedAt
                    ? this.convertTimestamp(oldMetric.deletedAt)
                    : undefined;
                });
              });
              migratedCount++;
            } else {
              console.warn(`Could not parse ${metricType.type} value: ${decryptedValue}`);
            }
          } catch (error) {
            console.error(
              `Error decrypting/migrating user metric ${metricType.type}:`,
              error,
              'Encrypted value:',
              encryptedValue
            );
            // Continue with other metrics instead of failing completely
          }
        }
      }
      processedRows++;
      reportProgress?.(processedRows, total);
    }

    return migratedCount;
  }

  /**
   * Migrate user profiles from old User table to new users table
   */
  private async migrateUsers(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if User table exists
    const tableExists = await this.tableExists('User');
    if (!tableExists) {
      console.log('User table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldUsers = (await this.oldDB.getAllAsync(`
      SELECT * FROM User 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldUsers.length;
    reportProgress?.(0, total);
    let migratedCount = 0;

    for (const oldUser of oldUsers) {
      try {
        await database.write(async () => {
          await database.get<User>('users').create((newUser) => {
            newUser.fullName = oldUser.name || '';
            newUser.email = undefined; // Old schema doesn't have email, set to undefined as it's optional
            newUser.dateOfBirth = this.convertTimestamp(oldUser.birthday);
            newUser.gender = this.mapGender(oldUser.gender);
            newUser.fitnessGoal = this.mapFitnessGoal(oldUser.fitnessGoals);
            newUser.weightGoal = this.mapFitnessGoalToWeightGoal(oldUser.fitnessGoals);
            newUser.activityLevel = this.mapActivityLevel(oldUser.activityLevel); // Map text to number
            newUser.liftingExperience = this.mapLiftingExperience(oldUser.liftingExperience); // Map text to enum
            newUser.avatarIcon = undefined; // Not present in old schema
            newUser.avatarColor = undefined; // Not present in old schema
            newUser.syncId = this.generateUUID(); // Generate new sync ID
            newUser.externalAccountId = undefined; // Not present in old schema
            newUser.externalAccountProvider = undefined; // Not present in old schema
            newUser.createdAt = this.convertTimestamp(oldUser.createdAt);
            newUser.updatedAt = this.convertTimestamp(oldUser.createdAt);
            newUser.deletedAt = oldUser.deletedAt
              ? this.convertTimestamp(oldUser.deletedAt)
              : undefined;
          });
        });
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating user:', error, 'Data:', oldUser);
        throw new Error(
          `Failed to migrate user: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Migrate food items from old Food table to new foods table
   */
  private async migrateFoods(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if Food table exists
    const tableExists = await this.tableExists('Food');
    if (!tableExists) {
      console.log('Food table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldFoods = (await this.oldDB.getAllAsync(`
      SELECT * FROM Food 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldFoods.length;
    reportProgress?.(0, total);
    let migratedCount = 0;

    for (const oldFood of oldFoods) {
      try {
        // Build micros JSON object from old micro fields
        const micros: Record<string, any> = {};

        // Add micro nutrients if they exist and are not null
        const microFields = [
          'zinc',
          'vitaminK',
          'vitaminC',
          'vitaminB12',
          'vitaminA',
          'vitaminE',
          'thiamin',
          'selenium',
          'vitaminB6',
          'pantothenicAcid',
          'niacin',
          'calcium',
          'iodine',
          'molybdenum',
          'vitaminD',
          'manganese',
          'magnesium',
          'folicAcid',
          'copper',
          'iron',
          'chromium',
          'caffeine',
          'cholesterol',
          'phosphorus',
          'chloride',
          'folate',
          'biotin',
          'sodium',
          'riboflavin',
          'potassium',
        ];

        for (const field of microFields) {
          if (oldFood[field] !== null && oldFood[field] !== undefined) {
            micros[field] = oldFood[field];
          }
        }

        const newFood = await database.write(async () =>
          database.get<Food>('foods').create((newFoodRecord) => {
            newFoodRecord.isAiGenerated = false; // Old foods are not AI generated
            newFoodRecord.name = oldFood.name || '';
            newFoodRecord.brand = oldFood.brand || null;
            newFoodRecord.barcode = oldFood.productCode || null; // Map productCode to barcode
            newFoodRecord.calories = Number(oldFood.calories) || 0;
            newFoodRecord.protein = Number(oldFood.protein) || 0;
            newFoodRecord.carbs = Number(oldFood.totalCarbohydrate) || 0; // Map totalCarbohydrate to carbs
            newFoodRecord.fat = Number(oldFood.totalFat) || 0; // Map totalFat to fat
            newFoodRecord.fiber = Number(oldFood.fiber) || 0;
            newFoodRecord.micros = Object.keys(micros).length > 0 ? micros : undefined;
            newFoodRecord.isFavorite = Boolean(oldFood.isFavorite) || false;
            newFoodRecord.source = oldFood.source || 'user'; // Default to user if not specified
            newFoodRecord.imageUrl = undefined; // Not present in old schema
            newFoodRecord.createdAt = this.convertTimestamp(oldFood.createdAt);
            newFoodRecord.updatedAt = this.convertTimestamp(oldFood.createdAt);
            newFoodRecord.deletedAt = oldFood.deletedAt
              ? this.convertTimestamp(oldFood.deletedAt)
              : undefined;
          })
        );
        this.foodIdMap.set(Number(oldFood.id), newFood.id);
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating food:', error, 'Data:', oldFood);
        throw new Error(
          `Failed to migrate food: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Find a food with similar nutritional profile (by macro percentages) when exact name match fails.
   * Compares % of calories from protein/carbs/fat so total vs per-100g values can match.
   */
  private async findFoodByNutritionalProfile(
    calories: number,
    protein: number,
    carbs: number,
    fat: number
  ): Promise<string | null> {
    try {
      if (calories <= 0) {
        return null;
      }

      const allFoods = await database
        .get<Food>('foods')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch();

      const logCalFromProtein = protein * 4;
      const logCalFromCarbs = carbs * 4;
      const logCalFromFat = fat * 9;
      const logPctProtein = calories > 0 ? logCalFromProtein / calories : 0;
      const logPctCarbs = calories > 0 ? logCalFromCarbs / calories : 0;
      const logPctFat = calories > 0 ? logCalFromFat / calories : 0;

      let bestMatch: Food | null = null;
      let bestScore = Infinity;

      for (const food of allFoods) {
        if (food.calories <= 0) {
          continue;
        }
        const foodCalFromProtein = food.protein * 4;
        const foodCalFromCarbs = food.carbs * 4;
        const foodCalFromFat = food.fat * 9;
        const foodPctProtein = foodCalFromProtein / food.calories;
        const foodPctCarbs = foodCalFromCarbs / food.calories;
        const foodPctFat = foodCalFromFat / food.calories;

        const score =
          Math.abs(foodPctProtein - logPctProtein) +
          Math.abs(foodPctCarbs - logPctCarbs) +
          Math.abs(foodPctFat - logPctFat);

        if (score < bestScore) {
          bestScore = score;
          bestMatch = food;
        }
      }

      return bestMatch?.id || null;
    } catch (error) {
      console.error('Error finding food by nutritional profile:', error);
      return null;
    }
  }

  /**
   * Migrate nutrition logs from old UserNutrition table to new nutrition_logs table
   */
  private async migrateNutritionLogs(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if UserNutrition table exists
    const tableExists = await this.tableExists('UserNutrition');
    if (!tableExists) {
      console.log('UserNutrition table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldNutritionLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM UserNutrition 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldNutritionLogs.length;
    reportProgress?.(0, total);
    let migratedCount = 0;
    let processedRows = 0;

    for (const oldLog of oldNutritionLogs) {
      try {
        // Decrypt all the encrypted fields
        const name = await decryptDatabaseValue(oldLog.name);
        const calories = await decryptDatabaseValue(oldLog.calories);
        const protein = await decryptDatabaseValue(oldLog.protein);
        const carbohydrate = await decryptDatabaseValue(oldLog.carbohydrate);
        const sugar = await decryptDatabaseValue(oldLog.sugar);
        const fiber = await decryptDatabaseValue(oldLog.fiber);
        const fat = await decryptDatabaseValue(oldLog.fat);
        const monounsaturatedFat = await decryptDatabaseValue(oldLog.monounsaturatedFat);
        const polyunsaturatedFat = await decryptDatabaseValue(oldLog.polyunsaturatedFat);
        const saturatedFat = await decryptDatabaseValue(oldLog.saturatedFat);
        const transFat = await decryptDatabaseValue(oldLog.transFat);
        const unsaturatedFat = await decryptDatabaseValue(oldLog.unsaturatedFat);
        const alcohol = await decryptDatabaseValue(oldLog.alcohol);
        const grams = await decryptDatabaseValue(oldLog.grams);
        const mealType = await decryptDatabaseValue(oldLog.mealType);

        // Build micros JSON object from old micro fields
        const micros: Record<string, any> = {};

        // Add micro nutrients if they exist and are not null after decryption
        const microFields = [
          { field: 'alcohol', value: alcohol },
          { field: 'sugar', value: sugar },
          { field: 'monounsaturatedFat', value: monounsaturatedFat },
          { field: 'polyunsaturatedFat', value: polyunsaturatedFat },
          { field: 'saturatedFat', value: saturatedFat },
          { field: 'transFat', value: transFat },
          { field: 'unsaturatedFat', value: unsaturatedFat },
        ];

        for (const { field, value } of microFields) {
          if (value !== null && value !== undefined && value !== '') {
            micros[field] = parseFloat(value) || 0;
          }
        }

        // Find the food by looking at the exact same name
        let newFoodId = '';
        let foodMatchMethod = '';

        if (name) {
          try {
            const matchingFoods = await database
              .get<Food>('foods')
              .query(Q.where('name', name.trim()), Q.where('deleted_at', Q.eq(null)))
              .fetch();

            if (matchingFoods.length > 0) {
              newFoodId = matchingFoods[0].id;
              foodMatchMethod = 'name';
            } else {
              // Fallback: find a food with the same nutritional profile
              const caloriesNum = parseFloat(calories) || 0;
              const proteinNum = parseFloat(protein) || 0;
              const carbsNum = parseFloat(carbohydrate) || 0;
              const fatNum = parseFloat(fat) || 0;

              newFoodId =
                (await this.findFoodByNutritionalProfile(
                  caloriesNum,
                  proteinNum,
                  carbsNum,
                  fatNum
                )) || '';
              foodMatchMethod = newFoodId ? 'nutritional_profile' : 'none';
            }
          } catch (error) {
            // Fallback: find a food with the same nutritional profile
            const caloriesNum = parseFloat(calories) || 0;
            const proteinNum = parseFloat(protein) || 0;
            const carbsNum = parseFloat(carbohydrate) || 0;
            const fatNum = parseFloat(fat) || 0;

            newFoodId =
              (await this.findFoodByNutritionalProfile(
                caloriesNum,
                proteinNum,
                carbsNum,
                fatNum
              )) || '';
            foodMatchMethod = newFoodId ? 'nutritional_profile' : 'none';
          }
        } else {
          // Fallback: find a food with the same nutritional profile
          const caloriesNum = parseFloat(calories) || 0;
          const proteinNum = parseFloat(protein) || 0;
          const carbsNum = parseFloat(carbohydrate) || 0;
          const fatNum = parseFloat(fat) || 0;

          newFoodId =
            (await this.findFoodByNutritionalProfile(caloriesNum, proteinNum, carbsNum, fatNum)) ||
            '';
          foodMatchMethod = newFoodId ? 'nutritional_profile' : 'none';
        }

        // Log nutrition entries that couldn't be matched to foods
        // if (!newFoodId) {
        //   console.log('Nutrition log not migrated - no matching food found:', {
        //     name: name || 'unnamed',
        //     calories: parseFloat(calories) || 0,
        //     protein: parseFloat(protein) || 0,
        //     carbs: parseFloat(carbohydrate) || 0,
        //     fat: parseFloat(fat) || 0,
        //     date: oldLog.date,
        //     mealType: mealType,
        //     matchMethod: foodMatchMethod
        //   });
        // } else {
        //   console.log('Food found!!!', newFoodId);
        // }

        if (!newFoodId) {
          processedRows++;
          reportProgress?.(processedRows, total);
          continue;
        }

        let gramsConsumed = parseFloat(grams) || 0;

        // When grams is null in the old DB, infer from the linked food's calories per 100g (if we found a food)
        if (gramsConsumed === 0 && newFoodId) {
          const loggedCalories = parseFloat(calories) || 0;
          if (loggedCalories > 0) {
            try {
              const food = await database.get<Food>('foods').find(newFoodId);
              if (food?.calories > 0) {
                gramsConsumed = (loggedCalories * 100) / food.calories;
              }
            } catch {
              // Food missing or not found; keep gramsConsumed 0
            }
          }
        }

        // When we still have no grams (e.g. no matching food found), store totals as "per 100g" with amount 100
        // so the snapshot displays correctly (scale = 1 in getNutrients). Otherwise we'd store zeros.
        const useUnknownGramsConvention = gramsConsumed === 0;
        const effectiveGrams = useUnknownGramsConvention ? 100 : gramsConsumed;

        // Convert macros from actual consumed values to per-100g values for the new system
        const caloriesPer100g =
          effectiveGrams > 0 ? ((parseFloat(calories) || 0) * 100) / effectiveGrams : 0;
        const proteinPer100g =
          effectiveGrams > 0 ? ((parseFloat(protein) || 0) * 100) / effectiveGrams : 0;
        const carbsPer100g =
          effectiveGrams > 0 ? ((parseFloat(carbohydrate) || 0) * 100) / effectiveGrams : 0;
        const fatPer100g = effectiveGrams > 0 ? ((parseFloat(fat) || 0) * 100) / effectiveGrams : 0;
        const fiberPer100g =
          effectiveGrams > 0 ? ((parseFloat(fiber) || 0) * 100) / effectiveGrams : 0;

        const encrypted = await encryptNutritionLogSnapshot({
          loggedFoodName: name || undefined,
          loggedCalories: caloriesPer100g,
          loggedProtein: proteinPer100g,
          loggedCarbs: carbsPer100g,
          loggedFat: fatPer100g,
          loggedFiber: fiberPer100g,
          loggedMicros: Object.keys(micros).length > 0 ? micros : undefined,
        });

        const amountToStore =
          gramsConsumed > 0 ? gramsConsumed : useUnknownGramsConvention ? 100 : 1;

        await database.write(async () => {
          await database.get<NutritionLog>('nutrition_logs').create((newLog) => {
            const createdAt = this.convertTimestamp(oldLog.createdAt);
            newLog.foodId = newFoodId;
            const rawDate = new Date(this.convertTimestamp(oldLog.date));
            newLog.date = new Date(
              rawDate.getFullYear(),
              rawDate.getMonth(),
              rawDate.getDate()
            ).getTime();
            newLog.type = this.mapMealType(mealType, createdAt);
            newLog.amount = amountToStore;
            newLog.portionId = undefined; // Not present in old schema
            newLog.loggedFoodNameRaw = encrypted.loggedFoodName;
            newLog.loggedCaloriesRaw = encrypted.loggedCalories;
            newLog.loggedProteinRaw = encrypted.loggedProtein;
            newLog.loggedCarbsRaw = encrypted.loggedCarbs;
            newLog.loggedFatRaw = encrypted.loggedFat;
            newLog.loggedFiberRaw = encrypted.loggedFiber;
            newLog.loggedMicrosRaw = encrypted.loggedMicrosJson;
            newLog.createdAt = createdAt;
            newLog.updatedAt = this.convertTimestamp(oldLog.createdAt);
            newLog.deletedAt = oldLog.deletedAt
              ? this.convertTimestamp(oldLog.deletedAt)
              : undefined;
          });
        });
        migratedCount++;
      } catch (error) {
        console.error('Error migrating nutrition log:', error, 'Data:', oldLog);
        // Continue with other logs instead of failing completely
      }
      processedRows++;
      reportProgress?.(processedRows, total);
    }

    console.log('Migrated', migratedCount, ' out of', oldNutritionLogs.length, 'nutrition logs');
    return migratedCount;
  }

  /**
   * Migrate exercises from old Exercise table to new exercises table
   */
  private async migrateExercises(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if Exercise table exists
    const tableExists = await this.tableExists('Exercise');
    if (!tableExists) {
      console.log('Exercise table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldExercises = (await this.oldDB.getAllAsync(`
      SELECT * FROM Exercise 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldExercises.length;
    reportProgress?.(0, total);
    let migratedCount = 0;

    for (const oldExercise of oldExercises) {
      const name = (oldExercise.name || '').trim();
      try {
        // If an exercise with the same name already exists (e.g. from prod seed), reuse it so we only add the missing ones
        const existing = await database
          .get<Exercise>('exercises')
          .query(Q.where('name', name), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        if (existing.length > 0) {
          this.exerciseIdMap.set(Number(oldExercise.id), existing[0].id);
          migratedCount++;
          reportProgress?.(migratedCount, total);
          continue;
        }

        const newEx = await database.write(async () =>
          database.get<Exercise>('exercises').create((newExercise) => {
            newExercise.name = name || '';
            newExercise.description = oldExercise.description || '';
            newExercise.imageUrl = undefined; // dont map image
            newExercise.muscleGroup = oldExercise.muscleGroup || 'other'; // Map muscleGroup to muscle_group
            newExercise.equipmentType = this.mapExerciseType(oldExercise.type); // Map type to equipment_type
            newExercise.mechanicType = this.determineMechanicType(
              oldExercise.type,
              oldExercise.muscleGroup
            );
            newExercise.loadMultiplier = this.determineLoadMultiplier(
              oldExercise.type,
              oldExercise.muscleGroup
            );
            newExercise.createdAt = this.convertTimestamp(oldExercise.createdAt);
            newExercise.updatedAt = this.convertTimestamp(oldExercise.createdAt);
            newExercise.deletedAt = oldExercise.deletedAt
              ? this.convertTimestamp(oldExercise.deletedAt)
              : undefined;
          })
        );
        this.exerciseIdMap.set(Number(oldExercise.id), newEx.id);
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating exercise:', error, 'Data:', oldExercise);
        throw new Error(
          `Failed to migrate exercise: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Map old exercise type to new equipment type
   */
  private mapExerciseType(type: string): EquipmentType {
    if (!type) {
      return 'bodyweight';
    }

    const lowerType = type.toLowerCase();
    if (lowerType.includes('dumbbell') || lowerType.includes('dumbell')) {
      return 'dumbbell';
    }
    if (lowerType.includes('barbell') || lowerType.includes('bar')) {
      return 'barbell';
    }
    if (lowerType.includes('machine')) {
      return 'machine';
    }
    if (lowerType.includes('cable')) {
      return 'cable';
    }
    if (lowerType.includes('kettlebell') || lowerType.includes('kettle')) {
      return 'kettlebell';
    }
    if (lowerType.includes('band') || lowerType.includes('resistance')) {
      return 'resistance_band';
    }
    if (lowerType.includes('bodyweight') || lowerType.includes('body')) {
      return 'bodyweight';
    }

    return 'other';
  }

  /**
   * Determine mechanic type based on exercise type and muscle group
   */
  private determineMechanicType(type: string, muscleGroup: string): 'compound' | 'isolation' {
    if (!type || !muscleGroup) {
      return 'isolation';
    }

    const lowerType = type.toLowerCase();
    const lowerMuscleGroup = muscleGroup.toLowerCase();

    // Compound movements typically involve multiple muscle groups
    const compoundKeywords = [
      'squat',
      'deadlift',
      'bench',
      'press',
      'row',
      'pull',
      'clean',
      'snatch',
    ];
    const compoundMuscleGroups = ['legs', 'chest', 'back', 'shoulders'];

    const isCompoundType = compoundKeywords.some((keyword) => lowerType.includes(keyword));
    const isCompoundMuscle = compoundMuscleGroups.some((group) => lowerMuscleGroup.includes(group));

    return isCompoundType || isCompoundMuscle ? 'compound' : 'isolation';
  }

  /**
   * Determine load multiplier based on exercise type and muscle group
   */
  private determineLoadMultiplier(type: string, muscleGroup: string): number {
    if (!type || !muscleGroup) {
      return 1.0;
    }

    const lowerType = type.toLowerCase();
    const lowerMuscleGroup = muscleGroup.toLowerCase();

    // Higher multipliers for heavy compound movements
    if (lowerType.includes('squat') || lowerType.includes('deadlift')) {
      return 1.5;
    }
    if (lowerType.includes('bench') || lowerType.includes('press')) {
      return 1.3;
    }
    if (lowerType.includes('row') || lowerType.includes('pull')) {
      return 1.2;
    }

    // Lower multipliers for isolation exercises
    if (lowerMuscleGroup.includes('biceps') || lowerMuscleGroup.includes('triceps')) {
      return 0.8;
    }
    if (lowerMuscleGroup.includes('abs') || lowerMuscleGroup.includes('core')) {
      return 0.7;
    }
    if (lowerMuscleGroup.includes('calves') || lowerMuscleGroup.includes('forearms')) {
      return 0.6;
    }

    return 1.0; // Default multiplier
  }

  /**
   * Map old meal type to new meal type format
   */
  private mapMealType(
    mealType: string | number,
    createdAt?: number
  ): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' {
    if (!mealType) {
      if (createdAt != null) {
        const hour = new Date(createdAt).getHours();
        if (hour >= 5 && hour < 11) {
          return 'breakfast';
        }
        if (hour >= 11 && hour < 14) {
          return 'lunch';
        }
        if (hour >= 14 && hour < 21) {
          return 'dinner';
        }
        if (hour >= 21 || hour < 5) {
          return 'snack';
        }
      }
      return 'other';
    }

    // Handle numeric values from old database
    const numericMealType = typeof mealType === 'string' ? parseInt(mealType, 10) : mealType;

    if (!isNaN(numericMealType)) {
      switch (numericMealType) {
        case 1:
          return 'breakfast';
        case 2:
          return 'lunch';
        case 3:
          return 'dinner';
        case 4:
          return 'snack';
        case 0:
        default:
          return 'other';
      }
    }

    // Fallback to string matching for any non-numeric values
    const lowerMealType = mealType.toString().toLowerCase();

    if (lowerMealType.includes('breakfast')) {
      return 'breakfast';
    }
    if (lowerMealType.includes('lunch')) {
      return 'lunch';
    }
    if (lowerMealType.includes('dinner')) {
      return 'dinner';
    }
    if (lowerMealType.includes('snack')) {
      return 'snack';
    }

    return 'other';
  }

  /**
   * Migrate workouts from old Workout table to new workout_templates table
   */
  private async migrateWorkouts(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if Workout table exists
    const tableExists = await this.tableExists('Workout');
    if (!tableExists) {
      console.log('Workout table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldWorkouts = (await this.oldDB.getAllAsync(`
      SELECT * FROM Workout 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldWorkouts.length;
    reportProgress?.(0, total);
    let migratedCount = 0;

    for (const oldWorkout of oldWorkouts) {
      try {
        const newTemplate = await database.write(async () =>
          database.get<WorkoutTemplate>('workout_templates').create((newWorkout) => {
            newWorkout.name = oldWorkout.title || '';
            newWorkout.description = oldWorkout.description || '';
            newWorkout.volumeCalculationType = oldWorkout.volumeCalculationType || 'standard';
            newWorkout.weekDaysJson = this.mapRecurringOnWeek(oldWorkout.recurringOnWeek);
            newWorkout.isArchived = false; // Default to false for old workouts
            newWorkout.createdAt = this.convertTimestamp(oldWorkout.createdAt);
            newWorkout.updatedAt = this.convertTimestamp(oldWorkout.createdAt);
            newWorkout.deletedAt = oldWorkout.deletedAt
              ? this.convertTimestamp(oldWorkout.deletedAt)
              : undefined;
          })
        );
        this.workoutIdToTemplateId.set(Number(oldWorkout.id), newTemplate.id);
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating workout:', error, 'Data:', oldWorkout);
        throw new Error(
          `Failed to migrate workout: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Map old recurringOnWeek string to new weekDaysJson array
   */
  private mapRecurringOnWeek(recurringOnWeek: string): number[] {
    if (!recurringOnWeek) {
      return [];
    }

    const dayMap: Record<string, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6,
    };

    const lowerDay = recurringOnWeek.toLowerCase().trim();
    const dayIndex = dayMap[lowerDay];

    return dayIndex !== undefined ? [dayIndex] : [];
  }

  /**
   * Migrate workout logs from old WorkoutEvent table to new workout_logs table
   */
  private async migrateWorkoutLogs(
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if WorkoutEvent table exists
    const tableExists = await this.tableExists('WorkoutEvent');
    if (!tableExists) {
      console.log('WorkoutEvent table does not exist - skipping migration');
      reportProgress?.(0, 0);
      return 0;
    }

    const oldWorkoutLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM WorkoutEvent 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    const total = oldWorkoutLogs.length;
    reportProgress?.(0, total);
    let migratedCount = 0;

    for (const oldWorkoutLog of oldWorkoutLogs) {
      try {
        const newLog = await database.write(async () =>
          database.get<WorkoutLog>('workout_logs').create((newWorkoutLog) => {
            newWorkoutLog.templateId = oldWorkoutLog.workoutId?.toString() || '';
            newWorkoutLog.workoutName = oldWorkoutLog.title || '';
            newWorkoutLog.startedAt = this.convertTimestamp(oldWorkoutLog.date);
            newWorkoutLog.completedAt = this.convertTimestamp(oldWorkoutLog.date); // Same as startedAt for old logs
            newWorkoutLog.totalVolume = this.parseWorkoutVolume(oldWorkoutLog.workoutVolume);
            newWorkoutLog.caloriesBurned = 0; // Not present in old schema, default to 0
            newWorkoutLog.exhaustionLevel = oldWorkoutLog.exhaustionLevel || 0;
            newWorkoutLog.workoutScore = oldWorkoutLog.workoutScore || 0;
            newWorkoutLog.createdAt = this.convertTimestamp(oldWorkoutLog.createdAt);
            newWorkoutLog.updatedAt = this.convertTimestamp(oldWorkoutLog.createdAt);
            newWorkoutLog.deletedAt = oldWorkoutLog.deletedAt
              ? this.convertTimestamp(oldWorkoutLog.deletedAt)
              : undefined;
          })
        );
        this.workoutEventIdToLogId.set(Number(oldWorkoutLog.id), newLog.id);
        migratedCount++;
        reportProgress?.(migratedCount, total);
      } catch (error) {
        console.error('Error migrating workout log:', error, 'Data:', oldWorkoutLog);
        throw new Error(
          `Failed to migrate workout log: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Migrate sets from old Set table (where workoutId points to Workout) to workout_template_sets
   * @param totalForProgress Total count from getMigrationSummary() for progress display
   * @param reportProgress
   */
  private async migrateWorkoutTemplateSets(
    totalForProgress: number,
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if Workout table exists (needed for template sets)
    const workoutTableExists = await this.tableExists('Workout');
    const setTableExists = await this.tableExists('Set');

    if (!workoutTableExists || !setTableExists) {
      console.log('Workout or Set table does not exist - skipping template sets migration');
      reportProgress?.(0, totalForProgress);
      return 0;
    }

    const oldWorkouts = (await this.oldDB.getAllAsync(`
      SELECT * FROM Workout 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    reportProgress?.(0, totalForProgress);
    let migratedCount = 0;

    for (const oldWorkout of oldWorkouts) {
      const newTemplateId = this.workoutIdToTemplateId.get(Number(oldWorkout.id));
      if (!newTemplateId) {
        continue;
      }

      const oldSets = (await this.oldDB.getAllAsync(
        `SELECT * FROM "Set" WHERE workoutId = ? AND (deletedAt IS NULL OR deletedAt = '') ORDER BY setOrder, id`,
        [oldWorkout.id]
      )) as Record<string, any>[];

      // Group sets by exerciseId to create exercise blocks
      const setsByExercise = new Map<string, Record<string, any>[]>();
      const exerciseOrder: string[] = [];

      for (const oldSet of oldSets) {
        const newExerciseId = this.exerciseIdMap.get(Number(oldSet.exerciseId));
        if (!newExerciseId) {
          continue;
        }

        if (!setsByExercise.has(newExerciseId)) {
          setsByExercise.set(newExerciseId, []);
          exerciseOrder.push(newExerciseId);
        }
        setsByExercise.get(newExerciseId)!.push(oldSet);
      }

      // Create exercise blocks and their sets
      let exerciseIdx = 1;
      for (const exerciseId of exerciseOrder) {
        const exerciseSets = setsByExercise.get(exerciseId)!;
        const firstSet = exerciseSets[0];

        try {
          // Create template exercise block
          const templateExercise = await database.write(async () =>
            database.get<WorkoutTemplateExercise>('workout_template_exercises').create((te) => {
              te.templateId = newTemplateId;
              te.exerciseId = exerciseId;
              te.exerciseOrder = exerciseIdx++;
              te.groupId = firstSet.supersetName || undefined;
              const createdAt = this.convertTimestamp(firstSet.createdAt);
              te.createdAt = createdAt;
              te.updatedAt = createdAt;
            })
          );

          // Create sets linked to the exercise block
          for (const oldSet of exerciseSets) {
            await database.write(async () => {
              await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
                ts.templateExerciseId = templateExercise.id;
                ts.targetReps = Number(oldSet.reps) ?? 0;
                ts.targetWeight = Number(oldSet.weight) ?? 0;
                ts.restTimeAfter =
                  oldSet.restTime != null && oldSet.restTime !== ''
                    ? Number(oldSet.restTime)
                    : undefined;
                ts.setOrder = Number(oldSet.setOrder) ?? 0;
                ts.isDropSet = Boolean(oldSet.isDropSet);
                const createdAt = this.convertTimestamp(oldSet.createdAt);
                ts.createdAt = createdAt;
                ts.updatedAt = createdAt;
                ts.deletedAt = oldSet.deletedAt
                  ? this.convertTimestamp(oldSet.deletedAt)
                  : undefined;
              });
            });
            migratedCount++;
            reportProgress?.(migratedCount, totalForProgress);
          }
        } catch (error) {
          console.error('Error migrating template exercise/set:', error, 'Data:', firstSet);
          throw new Error(
            `Failed to migrate template set: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return migratedCount;
  }

  /**
   * Migrate sets from old Set table (where workoutId points to WorkoutEvent) to workout_log_sets
   * @param totalForProgress Total count from getMigrationSummary() for progress display
   * @param reportProgress
   */
  private async migrateWorkoutLogSets(
    totalForProgress: number,
    reportProgress?: (current: number, total: number) => void
  ): Promise<number> {
    if (!this.oldDB) {
      throw new Error('Old database not available');
    }

    // Check if WorkoutEvent table exists (needed for log sets)
    const workoutEventTableExists = await this.tableExists('WorkoutEvent');
    const setTableExists = await this.tableExists('Set');

    if (!workoutEventTableExists || !setTableExists) {
      console.log('WorkoutEvent or Set table does not exist - skipping log sets migration');
      reportProgress?.(0, totalForProgress);
      return 0;
    }

    const oldWorkoutLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM WorkoutEvent 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    reportProgress?.(0, totalForProgress);
    let migratedCount = 0;

    for (const oldEvent of oldWorkoutLogs) {
      const newLogId = this.workoutEventIdToLogId.get(Number(oldEvent.id));
      if (!newLogId) {
        continue;
      }

      const oldSets = (await this.oldDB.getAllAsync(
        `SELECT * FROM "Set" WHERE workoutId = ? AND (deletedAt IS NULL OR deletedAt = '') ORDER BY setOrder, id`,
        [oldEvent.id]
      )) as Record<string, any>[];

      // Group sets by exerciseId to create exercise blocks
      const setsByExercise = new Map<string, Record<string, any>[]>();
      const exerciseOrder: string[] = [];

      for (const oldSet of oldSets) {
        const newExerciseId = this.exerciseIdMap.get(Number(oldSet.exerciseId));
        if (!newExerciseId) {
          continue;
        }

        if (!setsByExercise.has(newExerciseId)) {
          setsByExercise.set(newExerciseId, []);
          exerciseOrder.push(newExerciseId);
        }
        setsByExercise.get(newExerciseId)!.push(oldSet);
      }

      // Create exercise blocks and their sets
      let exerciseIdx = 1;
      for (const exerciseId of exerciseOrder) {
        const exerciseSets = setsByExercise.get(exerciseId)!;
        const firstSet = exerciseSets[0];

        try {
          // Create log exercise block
          const logExercise = await database.write(async () =>
            database.get<WorkoutLogExercise>('workout_log_exercises').create((le) => {
              le.workoutLogId = newLogId;
              le.exerciseId = exerciseId;
              le.exerciseOrder = exerciseIdx++;
              le.groupId = firstSet.supersetName || undefined;
              const createdAt = this.convertTimestamp(firstSet.createdAt);
              le.createdAt = createdAt;
              le.updatedAt = createdAt;
            })
          );

          // Create sets linked to the exercise block
          for (const oldSet of exerciseSets) {
            const difficultyLevel = Math.min(10, Math.max(1, Number(oldSet.difficultyLevel) ?? 0));

            await database.write(async () => {
              await database.get<WorkoutLogSet>('workout_log_sets').create((ls) => {
                ls.logExerciseId = logExercise.id;
                ls.reps = Number(oldSet.reps) ?? 0;
                ls.weight = Number(oldSet.weight) ?? 0;
                ls.partials = undefined;
                ls.restTimeAfter = Number(oldSet.restTime) ?? 0;
                ls.repsInReserve = 0;
                ls.difficultyLevel = difficultyLevel;
                ls.isDropSet = Boolean(oldSet.isDropSet);
                ls.setOrder = Number(oldSet.setOrder) ?? 0;
                const createdAt = this.convertTimestamp(oldSet.createdAt);
                ls.createdAt = createdAt;
                ls.updatedAt = createdAt;
                ls.deletedAt = oldSet.deletedAt
                  ? this.convertTimestamp(oldSet.deletedAt)
                  : undefined;
                ls.isSkipped = undefined;
              });
            });
            migratedCount++;
            reportProgress?.(migratedCount, totalForProgress);
          }
        } catch (error) {
          console.error('Error migrating log exercise/set:', error, 'Data:', firstSet);
          throw new Error(
            `Failed to migrate log set: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return migratedCount;
  }

  /**
   * Parse workout volume from old workoutVolume text field
   */
  private parseWorkoutVolume(workoutVolume: string): number {
    if (!workoutVolume) {
      return 0;
    }

    // Try to parse as JSON first (if it's stored as JSON)
    try {
      const parsed = JSON.parse(workoutVolume);
      if (typeof parsed === 'number') {
        return parsed;
      }
      if (typeof parsed === 'object' && parsed.total) {
        return parsed.total;
      }
    } catch {
      // If not JSON, try to parse as number
      const num = parseFloat(workoutVolume);
      return isNaN(num) ? 0 : num;
    }

    return 0;
  }

  /**
   * Map old fitness goals string to new weight goal format
   */
  private mapFitnessGoalToWeightGoal(fitnessGoals: string): 'lose' | 'gain' | 'maintain' {
    if (!fitnessGoals) {
      return 'maintain';
    }

    const lowerGoals = fitnessGoals.toLowerCase();
    if (lowerGoals.includes('lose') || lowerGoals.includes('cut')) {
      return 'lose';
    } else if (lowerGoals.includes('gain') || lowerGoals.includes('bulk')) {
      return 'gain';
    }

    return 'maintain';
  }

  /**
   * Map old fitness goals string to new fitness goal format
   */
  private mapFitnessGoal(
    fitnessGoals: string
  ): 'hypertrophy' | 'strength' | 'endurance' | 'weight_loss' | 'general' {
    if (!fitnessGoals) {
      return 'general';
    }

    const lowerGoals = fitnessGoals.toLowerCase();

    // Check for weight loss related terms
    if (lowerGoals.includes('lose') && lowerGoals.includes('weight')) {
      return 'weight_loss';
    }
    if (lowerGoals.includes('cut') || lowerGoals.includes('shred') || lowerGoals.includes('lean')) {
      return 'weight_loss';
    }

    // Check for muscle building/hypertrophy related terms
    if (
      lowerGoals.includes('gain') &&
      (lowerGoals.includes('muscle') || lowerGoals.includes('mass'))
    ) {
      return 'hypertrophy';
    }

    if (
      lowerGoals.includes('bulk') ||
      lowerGoals.includes('hypertrophy') ||
      lowerGoals.includes('build')
    ) {
      return 'hypertrophy';
    }

    // Check for strength related terms
    if (
      lowerGoals.includes('strength') ||
      lowerGoals.includes('power') ||
      lowerGoals.includes('strong')
    ) {
      return 'strength';
    }

    // Check for endurance related terms
    if (
      lowerGoals.includes('endurance') ||
      lowerGoals.includes('cardio') ||
      lowerGoals.includes('stamina')
    ) {
      return 'endurance';
    }

    // Check for general fitness terms
    if (lowerGoals.includes('maintain') && lowerGoals.includes('weight')) {
      return 'general';
    }
    if (
      lowerGoals.includes('fitness') ||
      lowerGoals.includes('health') ||
      lowerGoals.includes('active')
    ) {
      return 'general';
    }

    // Default fallback
    return 'general';
  }

  /** Lazy-built map: normalized translation string → canonical 'male' | 'female' | 'other'. */
  private genderReverseMap: Map<string, 'male' | 'female' | 'other'> | null = null;

  private getGenderReverseMap(): Map<string, 'male' | 'female' | 'other'> {
    if (this.genderReverseMap) {
      return this.genderReverseMap;
    }
    const map = new Map<string, 'male' | 'female' | 'other'>();
    const genderKeys: [string, 'male' | 'female' | 'other'][] = [
      ['onboarding.personalInfo.gender.male', 'male'],
      ['onboarding.personalInfo.gender.female', 'female'],
      ['onboarding.personalInfo.gender.other', 'other'],
      ['editPersonalInfo.male', 'male'],
      ['editPersonalInfo.female', 'female'],
      ['editPersonalInfo.other', 'other'],
    ];

    const locales = Object.keys(i18n.options.resources || {});
    for (const lng of locales) {
      for (const [key, canonical] of genderKeys) {
        try {
          const value = i18n.t(key, { lng });
          if (value && typeof value === 'string' && value !== key) {
            const normalized = value.trim().toLowerCase();
            if (normalized) {
              map.set(normalized, canonical);
            }
          }
        } catch {
          // Skip missing keys
        }
      }
    }
    this.genderReverseMap = map;
    return map;
  }

  /**
   * Map old gender text to new gender format (supports any locale via translation lookup).
   */
  private mapGender(gender: string): 'male' | 'female' | 'other' {
    if (!gender) {
      return 'other';
    }

    const normalized = gender.trim().toLowerCase();
    const canonical = this.getGenderReverseMap().get(normalized);
    if (canonical) {
      return canonical;
    }

    return 'other';
  }

  /**
   * Map old activity level text to new activity level number
   */
  private mapActivityLevel(activityLevel: string): number {
    if (!activityLevel) {
      return 3;
    } // Default to moderate

    const lowerLevel = activityLevel.toLowerCase().trim();
    if (lowerLevel === 'sedentary') {
      return 1;
    } else if (lowerLevel === 'lightly_active') {
      return 2;
    } else if (lowerLevel === 'moderately_active') {
      return 3;
    } else if (lowerLevel === 'very_active') {
      return 4;
    } else if (lowerLevel === 'super_active') {
      return 5;
    }

    // Try to parse as number if no text match
    const num = parseInt(activityLevel, 10);
    return isNaN(num) ? 3 : Math.min(5, Math.max(1, num));
  }

  /**
   * Map old lifting experience text to new lifting experience enum
   */
  private mapLiftingExperience(
    liftingExperience: string
  ): 'beginner' | 'intermediate' | 'advanced' {
    if (!liftingExperience) {
      return 'beginner';
    }

    const lowerExperience = liftingExperience.toLowerCase().trim();
    if (lowerExperience === 'beginner') {
      return 'beginner';
    } else if (lowerExperience === 'intermediate') {
      return 'intermediate';
    } else if (lowerExperience === 'advanced') {
      return 'advanced';
    }

    return 'beginner'; // Default fallback
  }

  /**
   * Generate a simple UUID for sync ID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Validate migration integrity
   */
  private async validateMigration(result: MigrationResult): Promise<void> {
    // Check that we have the expected number of records
    const nutritionGoalsCount = await database
      .get<NutritionGoal>('nutrition_goals')
      .query()
      .fetchCount();
    const userMetricsCount = await database.get<UserMetric>('user_metrics').query().fetchCount();
    const usersCount = await database.get<User>('users').query().fetchCount();
    const foodsCount = await database.get<Food>('foods').query().fetchCount();
    const nutritionLogsCount = await database
      .get<NutritionLog>('nutrition_logs')
      .query()
      .fetchCount();
    const exercisesCount = await database.get<Exercise>('exercises').query().fetchCount();
    const workoutsCount = await database
      .get<WorkoutTemplate>('workout_templates')
      .query()
      .fetchCount();
    const workoutLogsCount = await database.get<WorkoutLog>('workout_logs').query().fetchCount();
    const templateSetsCount = await database
      .get<WorkoutTemplateSet>('workout_template_sets')
      .query()
      .fetchCount();
    const logSetsCount = await database.get<WorkoutLogSet>('workout_log_sets').query().fetchCount();

    console.log(
      `Migration validation: ${nutritionGoalsCount} nutrition goals, ${userMetricsCount} user metrics, ${usersCount} users, ${foodsCount} foods, ${nutritionLogsCount} nutrition logs, ${exercisesCount} exercises, ${workoutsCount} workouts, ${workoutLogsCount} workout logs, ${templateSetsCount} template sets, ${logSetsCount} log sets`
    );

    // Basic validation - ensure we have some data if migration succeeded
    if (result.details.fitnessGoalsMigrated > 0 && nutritionGoalsCount === 0) {
      throw new Error('Fitness goals migration validation failed');
    }

    if (result.details.userMetricsMigrated > 0 && userMetricsCount === 0) {
      throw new Error('User metrics migration validation failed');
    }

    if (result.details.usersMigrated > 0 && usersCount === 0) {
      throw new Error('Users migration validation failed');
    }

    if (result.details.foodsMigrated > 0 && foodsCount === 0) {
      throw new Error('Foods migration validation failed');
    }

    if (result.details.nutritionLogsMigrated > 0 && nutritionLogsCount === 0) {
      throw new Error('Nutrition logs migration validation failed');
    }

    if (result.details.exercisesMigrated > 0 && exercisesCount === 0) {
      throw new Error('Exercises migration validation failed');
    }

    if (result.details.workoutsMigrated > 0 && workoutsCount === 0) {
      throw new Error('Workouts migration validation failed');
    }

    if (result.details.workoutLogsMigrated > 0 && workoutLogsCount === 0) {
      throw new Error('Workout logs migration validation failed');
    }

    if (
      result.details.templateSetsMigrated > 0 &&
      templateSetsCount < result.details.templateSetsMigrated
    ) {
      throw new Error('Workout template sets migration validation failed');
    }

    if (result.details.logSetsMigrated > 0 && logSetsCount < result.details.logSetsMigrated) {
      throw new Error('Workout log sets migration validation failed');
    }
  }

  /**
   * Execute complete migration
   */
  async migrateAll(options?: MigrateAllOptions): Promise<MigrationResult> {
    const onProgress = options?.onProgress;
    const result: MigrationResult = {
      success: false,
      fitnessGoals: 0,
      userMetrics: 0,
      users: 0,
      foods: 0,
      nutritionLogs: 0,
      exercises: 0,
      workouts: 0,
      workoutLogs: 0,
      templateSets: 0,
      workoutLogSets: 0,
      details: {
        fitnessGoalsMigrated: 0,
        userMetricsMigrated: 0,
        usersMigrated: 0,
        foodsMigrated: 0,
        nutritionLogsMigrated: 0,
        exercisesMigrated: 0,
        workoutsMigrated: 0,
        workoutLogsMigrated: 0,
        templateSetsMigrated: 0,
        logSetsMigrated: 0,
        errors: [],
      },
    };

    try {
      // Step 1: Check if old database exists
      if (!(await this.checkOldDatabaseExists())) {
        throw new Error('Old database not found or not accessible');
      }

      console.log('Database exists... Starting migration from old database...');

      // Debug: List all tables in development mode
      if (__DEV__) {
        try {
          const tables = await this.getOldDatabaseTables();
          console.log('🔍 Old database tables:', tables);
        } catch (error) {
          console.log('🔍 Could not retrieve old database tables:', error);
        }
      }

      const summary = await this.getMigrationSummary();

      this.exerciseIdMap.clear();
      this.workoutIdToTemplateId.clear();
      this.workoutEventIdToLogId.clear();
      this.foodIdMap.clear();

      const report = (step: MigrationStepKey) => this.createProgressReporter(step, onProgress);

      // Step 2: Migrate Fitness Goals
      console.log('Migrating fitness goals...');
      result.details.fitnessGoalsMigrated = await this.migrateFitnessGoals(report('fitness_goals'));
      result.fitnessGoals = result.details.fitnessGoalsMigrated;

      // Step 3: Migrate User Metrics
      console.log('Migrating user metrics...');
      result.details.userMetricsMigrated = await this.migrateUserMetrics(report('user_metrics'));
      result.userMetrics = result.details.userMetricsMigrated;

      // Step 4: Migrate Users
      console.log('Migrating users...');
      result.details.usersMigrated = await this.migrateUsers(report('users'));
      result.users = result.details.usersMigrated;

      // Step 5: Migrate Foods
      console.log('Migrating foods...');
      result.details.foodsMigrated = await this.migrateFoods(report('foods'));
      result.foods = result.details.foodsMigrated;

      // Step 6: Migrate Nutrition Logs
      console.log('Migrating nutrition logs...');
      result.details.nutritionLogsMigrated = await this.migrateNutritionLogs(
        report('nutrition_logs')
      );
      result.nutritionLogs = result.details.nutritionLogsMigrated;

      // Step 7: Migrate Exercises
      console.log('Migrating exercises...');
      result.details.exercisesMigrated = await this.migrateExercises(report('exercises'));
      result.exercises = result.details.exercisesMigrated;

      // Step 8: Migrate Workouts
      console.log('Migrating workouts...');
      result.details.workoutsMigrated = await this.migrateWorkouts(report('workouts'));
      result.workouts = result.details.workoutsMigrated;

      // Step 9: Migrate Workout Logs
      console.log('Migrating workout logs...');
      result.details.workoutLogsMigrated = await this.migrateWorkoutLogs(report('workout_logs'));
      result.workoutLogs = result.details.workoutLogsMigrated;

      // Step 10: Migrate template sets
      console.log('Migrating workout template sets...');
      result.details.templateSetsMigrated = await this.migrateWorkoutTemplateSets(
        summary.templateSetsCount,
        report('workout_template_sets')
      );
      result.templateSets = result.details.templateSetsMigrated;

      // Step 11: Migrate log sets
      console.log('Migrating workout log sets...');
      result.details.logSetsMigrated = await this.migrateWorkoutLogSets(
        summary.logSetsCount,
        report('workout_log_sets')
      );
      result.workoutLogSets = result.details.logSetsMigrated;

      // Step 11: Deduplicate food entries
      console.log('Deduplicating food entries...');
      const deduplicationResult = await this.deduplicateFoods();
      console.log(`Deduplicated ${deduplicationResult.duplicatesRemoved} duplicate food entries`);

      // Step 12: Validate migration
      onProgress?.({ step: 'validating' });
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
    usersCount: number;
    foodsCount: number;
    nutritionLogsCount: number;
    exercisesCount: number;
    workoutsCount: number;
    workoutLogsCount: number;
    templateSetsCount: number;
    logSetsCount: number;
    tables: string[];
  }> {
    if (!this.oldDB) {
      return {
        fitnessGoalsCount: 0,
        userMetricsCount: 0,
        usersCount: 0,
        foodsCount: 0,
        nutritionLogsCount: 0,
        exercisesCount: 0,
        workoutsCount: 0,
        workoutLogsCount: 0,
        templateSetsCount: 0,
        logSetsCount: 0,
        tables: [],
      };
    }

    const tables = await this.getOldDatabaseTables();

    let fitnessGoalsCount = 0;
    let userMetricsCount = 0;
    let usersCount = 0;
    let foodsCount = 0;
    let nutritionLogsCount = 0;
    let exercisesCount = 0;
    let workoutsCount = 0;
    let workoutLogsCount = 0;
    let templateSetsCount = 0;
    let logSetsCount = 0;

    try {
      if (tables.includes('FitnessGoals')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM FitnessGoals 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        fitnessGoalsCount = result[0]?.count || 0;
      }

      if (tables.includes('UserMetrics')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM UserMetrics 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        userMetricsCount = result[0]?.count || 0;
      }

      if (tables.includes('User')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM User 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        usersCount = result[0]?.count || 0;
      }

      if (tables.includes('Food')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM Food 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        foodsCount = result[0]?.count || 0;
      }

      if (tables.includes('UserNutrition')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM UserNutrition 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        nutritionLogsCount = result[0]?.count || 0;
      }

      if (tables.includes('Exercise')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM Exercise 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        exercisesCount = result[0]?.count || 0;
      }

      if (tables.includes('Workout')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM Workout 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        workoutsCount = result[0]?.count || 0;
      }

      if (tables.includes('WorkoutEvent')) {
        const result = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM WorkoutEvent 
          WHERE deletedAt IS NULL OR deletedAt = ''
        `)) as { count: number }[];
        workoutLogsCount = result[0]?.count || 0;
      }

      if (tables.includes('Set')) {
        const templateResult = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM "Set" s
          INNER JOIN Workout w ON s.workoutId = w.id
          WHERE (s.deletedAt IS NULL OR s.deletedAt = '') AND (w.deletedAt IS NULL OR w.deletedAt = '')
        `)) as { count: number }[];
        templateSetsCount = templateResult[0]?.count || 0;

        const logResult = (await this.oldDB.getAllAsync(`
          SELECT COUNT(*) as count FROM "Set" s
          INNER JOIN WorkoutEvent w ON s.workoutId = w.id
          WHERE (s.deletedAt IS NULL OR s.deletedAt = '') AND (w.deletedAt IS NULL OR w.deletedAt = '')
        `)) as { count: number }[];
        logSetsCount = logResult[0]?.count || 0;
      }
    } catch (error) {
      console.error('Error getting migration summary:', error);
    }

    return {
      fitnessGoalsCount,
      userMetricsCount,
      usersCount,
      foodsCount,
      nutritionLogsCount,
      exercisesCount,
      workoutsCount,
      workoutLogsCount,
      templateSetsCount,
      logSetsCount,
      tables,
    };
  }

  /**
   * Find and remove duplicate food entries after migration
   */
  private async deduplicateFoods(): Promise<{ duplicatesRemoved: number }> {
    const allFoods = await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const processedGroups = new Set<string>();
    const foodIdMap = new Map<string, string>(); // oldFoodId -> newFoodId to keep

    // First pass: find duplicates by barcode (highest priority)
    const foodsByBarcode = new Map<string, Food[]>();
    for (const food of allFoods) {
      if (food.barcode) {
        if (!foodsByBarcode.has(food.barcode)) {
          foodsByBarcode.set(food.barcode, []);
        }

        foodsByBarcode.get(food.barcode)!.push(food);
      }
    }

    // Process barcode duplicates
    for (const [barcode, duplicateFoods] of foodsByBarcode) {
      if (duplicateFoods.length > 1) {
        const foodToKeep = this.selectBestFoodToKeep(duplicateFoods);
        const foodsToDelete = duplicateFoods.filter((f) => f.id !== foodToKeep.id);

        for (const foodToDelete of foodsToDelete) {
          foodIdMap.set(foodToDelete.id, foodToKeep.id);
        }

        processedGroups.add(`barcode:${barcode}`);
      }
    }

    // Second pass: find duplicates by nutritional profile (name + macros + calories)
    const foodsByProfile = new Map<string, Food[]>();
    for (const food of allFoods) {
      // Skip foods already processed by barcode
      if (food.barcode && processedGroups.has(`barcode:${food.barcode}`)) {
        continue;
      }

      const profileKey = this.createFoodProfileKey(food);
      if (!foodsByProfile.has(profileKey)) {
        foodsByProfile.set(profileKey, []);
      }

      foodsByProfile.get(profileKey)!.push(food);
    }

    // Process nutritional profile duplicates
    for (const [profile, duplicateFoods] of foodsByProfile) {
      if (duplicateFoods.length > 1) {
        const foodToKeep = this.selectBestFoodToKeep(duplicateFoods);
        const foodsToDelete = duplicateFoods.filter((f) => f.id !== foodToKeep.id);

        for (const foodToDelete of foodsToDelete) {
          foodIdMap.set(foodToDelete.id, foodToKeep.id);
        }

        processedGroups.add(`profile:${profile}`);
      }
    }

    // Update all references and delete duplicates
    let totalRemoved = 0;
    for (const [oldFoodId, newFoodId] of foodIdMap) {
      await database.write(async () => {
        // Update nutrition_logs
        const nutritionLogs = await database
          .get<NutritionLog>('nutrition_logs')
          .query(Q.where('food_id', oldFoodId))
          .fetch();

        for (const log of nutritionLogs) {
          await log.update((l) => {
            l.foodId = newFoodId;
          });
        }

        // Update meal_foods
        const mealFoods = await database
          .get<MealFood>('meal_foods')
          .query(Q.where('food_id', oldFoodId))
          .fetch();

        for (const mealFood of mealFoods) {
          await mealFood.update((mf) => {
            mf.foodId = newFoodId;
          });
        }

        // Update food_food_portions
        const foodFoodPortions = await database
          .get<FoodFoodPortion>('food_food_portions')
          .query(Q.where('food_id', oldFoodId))
          .fetch();

        for (const foodFoodPortion of foodFoodPortions) {
          await foodFoodPortion.update((ffp) => {
            ffp.foodId = newFoodId;
          });
        }

        // Delete the duplicate food
        const foodToDelete = await database.get<Food>('foods').find(oldFoodId);
        await foodToDelete.markAsDeleted();
        totalRemoved++;
      });
    }

    return { duplicatesRemoved: totalRemoved };
  }

  /**
   * Create a unique key for food based on name and nutritional profile
   */
  private createFoodProfileKey(food: Food): string {
    const normalizedName = (food.name || '').toLowerCase().trim();
    const calories = Math.round(food.calories);
    const protein = Math.round(food.protein * 10) / 10; // Round to 1 decimal
    const carbs = Math.round(food.carbs * 10) / 10;
    const fat = Math.round(food.fat * 10) / 10;

    return `${normalizedName}|${calories}|${protein}|${carbs}|${fat}`;
  }

  /**
   * Select the best food to keep from a group of duplicates
   * Priority: AI-generated > user-created with more complete data > older entry
   */
  private selectBestFoodToKeep(duplicateFoods: Food[]): Food {
    // Sort by priority: AI-generated first, then by completeness, then by creation date
    const sorted = [...duplicateFoods].sort((a, b) => {
      // AI-generated foods take priority
      if (a.isAiGenerated && !b.isAiGenerated) {
        return -1;
      }
      if (!a.isAiGenerated && b.isAiGenerated) {
        return 1;
      }

      // Prefer foods with more complete data (brand, micros, etc.)
      const aScore = this.calculateFoodCompletenessScore(a);
      const bScore = this.calculateFoodCompletenessScore(b);
      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // Prefer older entries (original)
      return a.createdAt - b.createdAt;
    });

    return sorted[0];
  }

  /**
   * Calculate a score for food completeness
   */
  private calculateFoodCompletenessScore(food: Food): number {
    let score = 0;

    if (food.brand) {
      score += 2;
    }
    if (food.barcode) {
      score += 3;
    }
    if (food.micros && Object.keys(food.micros).length > 0) {
      score += 2;
    }
    if (food.fiber > 0) {
      score += 1;
    }
    if (food.source === 'user') {
      score += 1;
    } // Prefer user-entered over unknown

    return score;
  }
}
