import { Q } from '@nozbe/watermelondb';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { database } from '../database-instance';
import {
  type EquipmentType,
  Exercise,
  Food,
  NutritionGoal,
  NutritionLog,
  User,
  UserMetric,
  WorkoutLog,
  WorkoutLogSet,
  WorkoutTemplate,
  WorkoutTemplateSet,
} from '../models';

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

export class MigrationService {
  private oldDB: SQLiteDatabase | null = null;

  /** Old Exercise id (number) → new exercise id (string). Populated during migrateExercises(). */
  private exerciseIdMap: Map<number, string> = new Map();
  /** Old Workout id (number) → new workout_templates id (string). Populated during migrateWorkouts(). */
  private workoutIdToTemplateId: Map<number, string> = new Map();
  /** Old WorkoutEvent id (number) → new workout_logs id (string). Populated during migrateWorkoutLogs(). */
  private workoutEventIdToLogId: Map<number, string> = new Map();

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
   * Get table schema for a specific table
   */
  async getTableSchema(
    tableName: string
  ): Promise<{ name: string; type: string; notnull: boolean; pk: boolean }[]> {
    if (!this.oldDB) throw new Error('Old database not available');

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

    const oldGoals = (await this.oldDB.getAllAsync(`
      SELECT * FROM FitnessGoals 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

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
  private async migrateUserMetrics(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldMetrics = (await this.oldDB.getAllAsync(`
      SELECT * FROM UserMetrics 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    let migratedCount = 0;

    for (const oldMetric of oldMetrics) {
      const baseTimestamp = this.convertTimestamp(oldMetric.createdAt);
      const dateTimestamp = this.convertTimestamp(oldMetric.date);

      // Create separate records for each metric type
      const metricTypes = [
        { field: 'weight', type: 'weight' as const, unit: 'kg' },
        { field: 'height', type: 'height' as const, unit: 'cm' },
        { field: 'fatPercentage', type: 'body_fat' as const, unit: '%' },
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
                newMetric.deletedAt = oldMetric.deletedAt
                  ? this.convertTimestamp(oldMetric.deletedAt)
                  : undefined;
              });
            });
            migratedCount++;
          } catch (error) {
            console.error(
              `Error migrating user metric ${metricType.type}:`,
              error,
              'Data:',
              oldMetric
            );
            throw new Error(
              `Failed to migrate user metric ${metricType.type}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    }

    return migratedCount;
  }

  /**
   * Migrate user profiles from old User table to new users table
   */
  private async migrateUsers(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldUsers = (await this.oldDB.getAllAsync(`
      SELECT * FROM User 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    let migratedCount = 0;

    for (const oldUser of oldUsers) {
      try {
        await database.write(async () => {
          await database.get<User>('users').create((newUser) => {
            newUser.fullName = oldUser.name || '';
            newUser.email = undefined; // Old schema doesn't have email, set to undefined as it's optional
            newUser.dateOfBirth = this.convertTimestamp(oldUser.birthday);
            newUser.gender = oldUser.gender || 'other';
            newUser.fitnessGoal = oldUser.fitnessGoals || 'maintain';
            newUser.weightGoal = this.mapFitnessGoalToWeightGoal(oldUser.fitnessGoals);
            newUser.activityLevel = Number(oldUser.activityLevel) || 3; // Default to moderate
            newUser.liftingExperience = oldUser.liftingExperience || 'beginner';
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
  private async migrateFoods(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldFoods = (await this.oldDB.getAllAsync(`
      SELECT * FROM Food 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

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

        await database.write(async () => {
          await database.get<Food>('foods').create((newFood) => {
            newFood.isAiGenerated = false; // Old foods are not AI generated
            newFood.name = oldFood.name || '';
            newFood.brand = oldFood.brand || null;
            newFood.barcode = oldFood.productCode || null; // Map productCode to barcode
            newFood.calories = Number(oldFood.calories) || 0;
            newFood.protein = Number(oldFood.protein) || 0;
            newFood.carbs = Number(oldFood.totalCarbohydrate) || 0; // Map totalCarbohydrate to carbs
            newFood.fat = Number(oldFood.totalFat) || 0; // Map totalFat to fat
            newFood.fiber = Number(oldFood.fiber) || 0;
            newFood.micros = Object.keys(micros).length > 0 ? micros : undefined;
            newFood.isFavorite = Boolean(oldFood.isFavorite) || false;
            newFood.source = oldFood.source || 'user'; // Default to user if not specified
            newFood.imageUrl = undefined; // Not present in old schema
            newFood.createdAt = this.convertTimestamp(oldFood.createdAt);
            newFood.updatedAt = this.convertTimestamp(oldFood.createdAt);
            newFood.deletedAt = oldFood.deletedAt
              ? this.convertTimestamp(oldFood.deletedAt)
              : undefined;
          });
        });
        migratedCount++;
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
   * Migrate nutrition logs from old UserNutrition table to new nutrition_logs table
   */
  private async migrateNutritionLogs(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldNutritionLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM UserNutrition 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    let migratedCount = 0;

    for (const oldLog of oldNutritionLogs) {
      try {
        // Build micros JSON object from old micro fields
        const micros: Record<string, any> = {};

        // Add micro nutrients if they exist and are not null
        const microFields = [
          'alcohol',
          'monounsaturatedFat',
          'polyunsaturatedFat',
          'saturatedFat',
          'transFat',
          'unsaturatedFat',
        ];

        for (const field of microFields) {
          if (oldLog[field] !== null && oldLog[field] !== undefined) {
            micros[field] = oldLog[field];
          }
        }

        await database.write(async () => {
          await database.get<NutritionLog>('nutrition_logs').create((newLog) => {
            newLog.foodId = oldLog.dataId || ''; // Use dataId as food_id
            newLog.date = this.convertTimestamp(oldLog.date);
            newLog.type = this.mapMealType(oldLog.mealType);
            newLog.amount = Number(oldLog.grams) || 1; // Default to 1 if grams is null
            newLog.portionId = undefined; // Not present in old schema
            newLog.loggedFoodName = oldLog.name || '';
            newLog.loggedCalories = Number(oldLog.calories) || 0;
            newLog.loggedProtein = Number(oldLog.protein) || 0;
            newLog.loggedCarbs = Number(oldLog.carbohydrate) || 0;
            newLog.loggedFat = Number(oldLog.fat) || 0;
            newLog.loggedFiber = Number(oldLog.fiber) || 0;
            newLog.loggedMicros = Object.keys(micros).length > 0 ? micros : undefined;
            newLog.createdAt = this.convertTimestamp(oldLog.createdAt);
            newLog.updatedAt = this.convertTimestamp(oldLog.createdAt);
            newLog.deletedAt = oldLog.deletedAt
              ? this.convertTimestamp(oldLog.deletedAt)
              : undefined;
          });
        });
        migratedCount++;
      } catch (error) {
        console.error('Error migrating nutrition log:', error, 'Data:', oldLog);
        throw new Error(
          `Failed to migrate nutrition log: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return migratedCount;
  }

  /**
   * Migrate exercises from old Exercise table to new exercises table
   */
  private async migrateExercises(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldExercises = (await this.oldDB.getAllAsync(`
      SELECT * FROM Exercise 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

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
          continue;
        }

        const newEx = await database.write(async () =>
          database.get<Exercise>('exercises').create((newExercise) => {
            newExercise.name = name || '';
            newExercise.description = oldExercise.description || '';
            newExercise.imageUrl = oldExercise.image || null; // Map image to image_url
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
    if (!type) return 'bodyweight';

    const lowerType = type.toLowerCase();
    if (lowerType.includes('dumbbell') || lowerType.includes('dumbell')) return 'dumbbell';
    if (lowerType.includes('barbell') || lowerType.includes('bar')) return 'barbell';
    if (lowerType.includes('machine')) return 'machine';
    if (lowerType.includes('cable')) return 'cable';
    if (lowerType.includes('kettlebell') || lowerType.includes('kettle')) return 'kettlebell';
    if (lowerType.includes('band') || lowerType.includes('resistance')) return 'resistance_band';
    if (lowerType.includes('bodyweight') || lowerType.includes('body')) return 'bodyweight';

    return 'other';
  }

  /**
   * Determine mechanic type based on exercise type and muscle group
   */
  private determineMechanicType(type: string, muscleGroup: string): 'compound' | 'isolation' {
    if (!type || !muscleGroup) return 'isolation';

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
    if (!type || !muscleGroup) return 1.0;

    const lowerType = type.toLowerCase();
    const lowerMuscleGroup = muscleGroup.toLowerCase();

    // Higher multipliers for heavy compound movements
    if (lowerType.includes('squat') || lowerType.includes('deadlift')) return 1.5;
    if (lowerType.includes('bench') || lowerType.includes('press')) return 1.3;
    if (lowerType.includes('row') || lowerType.includes('pull')) return 1.2;

    // Lower multipliers for isolation exercises
    if (lowerMuscleGroup.includes('biceps') || lowerMuscleGroup.includes('triceps')) return 0.8;
    if (lowerMuscleGroup.includes('abs') || lowerMuscleGroup.includes('core')) return 0.7;
    if (lowerMuscleGroup.includes('calves') || lowerMuscleGroup.includes('forearms')) return 0.6;

    return 1.0; // Default multiplier
  }

  /**
   * Map old meal type to new meal type format
   */
  private mapMealType(mealType: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' {
    if (!mealType) return 'other';

    const lowerMealType = mealType.toLowerCase();
    if (lowerMealType.includes('breakfast')) return 'breakfast';
    if (lowerMealType.includes('lunch')) return 'lunch';
    if (lowerMealType.includes('dinner')) return 'dinner';
    if (lowerMealType.includes('snack')) return 'snack';

    return 'other';
  }

  /**
   * Migrate workouts from old Workout table to new workout_templates table
   */
  private async migrateWorkouts(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldWorkouts = (await this.oldDB.getAllAsync(`
      SELECT * FROM Workout 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

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
    if (!recurringOnWeek) return [];

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
  private async migrateWorkoutLogs(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldWorkoutLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM WorkoutEvent 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

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
   */
  private async migrateWorkoutTemplateSets(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldWorkouts = (await this.oldDB.getAllAsync(`
      SELECT * FROM Workout 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    let migratedCount = 0;

    for (const oldWorkout of oldWorkouts) {
      const newTemplateId = this.workoutIdToTemplateId.get(Number(oldWorkout.id));
      if (!newTemplateId) continue;

      const oldSets = (await this.oldDB.getAllAsync(
        `SELECT * FROM "Set" WHERE workoutId = ? AND (deletedAt IS NULL OR deletedAt = '') ORDER BY setOrder, id`,
        [oldWorkout.id]
      )) as Record<string, any>[];

      for (const oldSet of oldSets) {
        const newExerciseId = this.exerciseIdMap.get(Number(oldSet.exerciseId));
        if (!newExerciseId) continue;

        try {
          await database.write(async () => {
            await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
              ts.templateId = newTemplateId;
              ts.exerciseId = newExerciseId;
              ts.targetReps = Number(oldSet.reps) ?? 0;
              ts.targetWeight = Number(oldSet.weight) ?? 0;
              ts.restTimeAfter =
                oldSet.restTime != null && oldSet.restTime !== ''
                  ? Number(oldSet.restTime)
                  : undefined;
              ts.setOrder = Number(oldSet.setOrder) ?? 0;
              ts.groupId = oldSet.supersetName || undefined;
              ts.isDropSet = Boolean(oldSet.isDropSet);
              const createdAt = this.convertTimestamp(oldSet.createdAt);
              ts.createdAt = createdAt;
              ts.updatedAt = createdAt;
              ts.deletedAt = oldSet.deletedAt ? this.convertTimestamp(oldSet.deletedAt) : undefined;
            });
          });
          migratedCount++;
        } catch (error) {
          console.error('Error migrating template set:', error, 'Data:', oldSet);
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
   */
  private async migrateWorkoutLogSets(): Promise<number> {
    if (!this.oldDB) throw new Error('Old database not available');

    const oldWorkoutLogs = (await this.oldDB.getAllAsync(`
      SELECT * FROM WorkoutEvent 
      WHERE deletedAt IS NULL OR deletedAt = ''
    `)) as Record<string, any>[];

    let migratedCount = 0;

    for (const oldEvent of oldWorkoutLogs) {
      const newLogId = this.workoutEventIdToLogId.get(Number(oldEvent.id));
      if (!newLogId) continue;

      const oldSets = (await this.oldDB.getAllAsync(
        `SELECT * FROM "Set" WHERE workoutId = ? AND (deletedAt IS NULL OR deletedAt = '') ORDER BY setOrder, id`,
        [oldEvent.id]
      )) as Record<string, any>[];

      for (const oldSet of oldSets) {
        const newExerciseId = this.exerciseIdMap.get(Number(oldSet.exerciseId));
        if (!newExerciseId) continue;

        const difficultyLevel = Math.min(10, Math.max(1, Number(oldSet.difficultyLevel) ?? 0));

        try {
          await database.write(async () => {
            await database.get<WorkoutLogSet>('workout_log_sets').create((ls) => {
              ls.workoutLogId = newLogId;
              ls.exerciseId = newExerciseId;
              ls.reps = Number(oldSet.reps) ?? 0;
              ls.weight = Number(oldSet.weight) ?? 0;
              ls.partials = undefined;
              ls.restTimeAfter = Number(oldSet.restTime) ?? 0;
              ls.repsInReserve = 0;
              ls.difficultyLevel = difficultyLevel;
              ls.groupId = oldSet.supersetName || undefined;
              ls.isDropSet = Boolean(oldSet.isDropSet);
              ls.setOrder = Number(oldSet.setOrder) ?? 0;
              const createdAt = this.convertTimestamp(oldSet.createdAt);
              ls.createdAt = createdAt;
              ls.updatedAt = createdAt;
              ls.deletedAt = oldSet.deletedAt ? this.convertTimestamp(oldSet.deletedAt) : undefined;
              ls.isSkipped = undefined;
            });
          });
          migratedCount++;
        } catch (error) {
          console.error('Error migrating log set:', error, 'Data:', oldSet);
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
    if (!workoutVolume) return 0;

    // Try to parse as JSON first (if it's stored as JSON)
    try {
      const parsed = JSON.parse(workoutVolume);
      if (typeof parsed === 'number') return parsed;
      if (typeof parsed === 'object' && parsed.total) return parsed.total;
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
    if (!fitnessGoals) return 'maintain';

    const lowerGoals = fitnessGoals.toLowerCase();
    if (lowerGoals.includes('lose') || lowerGoals.includes('cut')) {
      return 'lose';
    } else if (lowerGoals.includes('gain') || lowerGoals.includes('bulk')) {
      return 'gain';
    }
    return 'maintain';
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
  async migrateAll(): Promise<MigrationResult> {
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

      console.log('Starting migration from old database...');

      this.exerciseIdMap.clear();
      this.workoutIdToTemplateId.clear();
      this.workoutEventIdToLogId.clear();

      // Step 2: Migrate Fitness Goals
      console.log('Migrating fitness goals...');
      result.details.fitnessGoalsMigrated = await this.migrateFitnessGoals();
      result.fitnessGoals = result.details.fitnessGoalsMigrated;

      // Step 3: Migrate User Metrics
      console.log('Migrating user metrics...');
      result.details.userMetricsMigrated = await this.migrateUserMetrics();
      result.userMetrics = result.details.userMetricsMigrated;

      // Step 4: Migrate Users
      console.log('Migrating users...');
      result.details.usersMigrated = await this.migrateUsers();
      result.users = result.details.usersMigrated;

      // Step 5: Migrate Foods
      console.log('Migrating foods...');
      result.details.foodsMigrated = await this.migrateFoods();
      result.foods = result.details.foodsMigrated;

      // Step 6: Migrate Nutrition Logs
      console.log('Migrating nutrition logs...');
      result.details.nutritionLogsMigrated = await this.migrateNutritionLogs();
      result.nutritionLogs = result.details.nutritionLogsMigrated;

      // Step 7: Migrate Exercises
      console.log('Migrating exercises...');
      result.details.exercisesMigrated = await this.migrateExercises();
      result.exercises = result.details.exercisesMigrated;

      // Step 8: Migrate Workouts
      console.log('Migrating workouts...');
      result.details.workoutsMigrated = await this.migrateWorkouts();
      result.workouts = result.details.workoutsMigrated;

      // Step 9: Migrate Workout Logs
      console.log('Migrating workout logs...');
      result.details.workoutLogsMigrated = await this.migrateWorkoutLogs();
      result.workoutLogs = result.details.workoutLogsMigrated;

      // Step 10: Migrate template sets
      console.log('Migrating workout template sets...');
      result.details.templateSetsMigrated = await this.migrateWorkoutTemplateSets();
      result.templateSets = result.details.templateSetsMigrated;

      // Step 11: Migrate log sets
      console.log('Migrating workout log sets...');
      result.details.logSetsMigrated = await this.migrateWorkoutLogSets();
      result.workoutLogSets = result.details.logSetsMigrated;

      // Step 12: Validate migration
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
}
