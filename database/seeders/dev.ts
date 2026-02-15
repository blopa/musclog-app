import { Q } from '@nozbe/watermelondb';

import exercisesData from '../../data/exercisesEnUS.json';
import { database } from '../index';
import Exercise, {
  type EquipmentType,
  type MechanicType,
  type MuscleGroup,
} from '../models/Exercise';
import Food from '../models/Food';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';
import UserMetric from '../models/UserMetric';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogSet from '../models/WorkoutLogSet';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutTemplateSet from '../models/WorkoutTemplateSet';

interface ExerciseJsonData {
  name: string;
  muscleGroup: string;
  type: 'compound' | 'isolation' | 'machine' | 'bodyweight' | 'cardio' | 'plyometric';
  description: string;
  targetMuscles?: string[];
  loadMultiplier?: number;
}

/**
 * Maps JSON exercise type to Exercise model fields
 */
function mapExerciseType(type: ExerciseJsonData['type']): {
  mechanicType: 'compound' | 'isolation';
  equipmentType: string;
} {
  let mechanicType: 'compound' | 'isolation' = 'compound';
  let equipmentType: string;

  switch (type) {
    case 'compound':
      mechanicType = 'compound';
      // Try to infer equipment from name (will default to barbell)
      equipmentType = 'barbell';
      break;
    case 'isolation':
      mechanicType = 'isolation';
      // Try to infer equipment from name (will default to dumbbell for isolation)
      equipmentType = 'dumbbell';
      break;
    case 'machine':
      mechanicType = 'compound'; // Machine exercises can be compound or isolation, default to compound
      equipmentType = 'machine';
      break;
    case 'bodyweight':
      mechanicType = 'compound'; // Bodyweight exercises can be compound or isolation, default to compound
      equipmentType = 'bodyweight';
      break;
    case 'cardio':
      mechanicType = 'compound';
      equipmentType = 'cardio';
      break;
    case 'plyometric':
      mechanicType = 'compound';
      equipmentType = 'other';
      break;
    default:
      mechanicType = 'compound';
      equipmentType = 'barbell';
  }

  return { mechanicType, equipmentType };
}

/**
 * Infers equipment type from exercise name
 * This is a helper to improve accuracy of equipment type mapping
 */
function inferEquipmentFromName(name: string, defaultEquipment: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('dumbbell') || lowerName.includes('db ')) {
    return 'dumbbell';
  }
  if (lowerName.includes('barbell') || lowerName.includes('bb ')) {
    return 'barbell';
  }
  if (lowerName.includes('cable')) {
    return 'cable';
  }
  if (lowerName.includes('kettlebell')) {
    return 'kettlebell';
  }
  if (lowerName.includes('machine') || lowerName.includes(' smith')) {
    return 'machine';
  }

  return defaultEquipment;
}

/**
 * Loads exercises from exercisesEnUS.json and populates the Exercise collection
 * Skips exercises that already exist (by name) to allow re-running without duplicates
 */
async function loadExercisesFromJson(): Promise<{ created: number; skipped: number }> {
  const exercises = exercisesData as ExerciseJsonData[];
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  await database.write(async () => {
    // Get all existing exercises to check for duplicates
    const existingExercises = await database.get<Exercise>('exercises').query().fetch();
    const existingNames = new Set(
      existingExercises.map((ex: Exercise) => (ex.name ?? '').toLowerCase())
    );

    // Prepare all new exercises
    const exercisesToCreate = exercises
      .filter((exerciseData) => {
        // Skip if exercise already exists
        if (existingNames.has(exerciseData.name.toLowerCase())) {
          skipped++;
          return false;
        }
        return true;
      })
      .map((exerciseData) => {
        const { mechanicType, equipmentType: defaultEquipment } = mapExerciseType(
          exerciseData.type
        );
        const equipmentType = inferEquipmentFromName(exerciseData.name, defaultEquipment);

        return database.get<Exercise>('exercises').prepareCreate((exercise) => {
          exercise.name = exerciseData.name;
          exercise.description = exerciseData.description;
          exercise.muscleGroup = exerciseData.muscleGroup as MuscleGroup;
          exercise.equipmentType = equipmentType as EquipmentType;
          exercise.mechanicType = mechanicType as MechanicType;
          exercise.loadMultiplier = exerciseData.loadMultiplier ?? 1.0; // Default to 1.0 if not specified
          exercise.imageUrl = undefined; // No image URLs in JSON
          exercise.createdAt = now;
          exercise.updatedAt = now;
          exercise.deletedAt = undefined;
        });
      });

    // Batch create all new exercises
    if (exercisesToCreate.length > 0) {
      await database.batch(...exercisesToCreate);
      created = exercisesToCreate.length;
    }
  });

  return { created, skipped };
}

/**
 * Seeds the exercises database if it's empty
 * Only runs if there are no exercises in the database
 * Returns true if seeding was performed, false if database already had exercises
 */
async function seedExercisesIfEmpty(): Promise<boolean> {
  try {
    // Check if there are any exercises in the database
    const existingExercises = await database.get<Exercise>('exercises').query().fetch();

    // If database already has exercises, skip seeding
    if (existingExercises.length > 0) {
      return false;
    }

    // Database is empty, seed it
    const result = await loadExercisesFromJson();
    console.log(`Seeded exercises database: ${result.created} created, ${result.skipped} skipped`);
    return true;
  } catch (error) {
    console.error('Error seeding exercises database:', error);
    throw error;
  }
}

/**
 * Seeds workout templates and workout history data with completed workouts across multiple months
 * Creates workout templates, then workout logs linked to those templates with varying volumes
 * Only runs if workout_templates or workout_logs tables are empty
 */
async function seedWorkoutTemplatesAndHistory(shouldSeedWorkoutHistory = false): Promise<{
  templatesCreated: number;
  workoutsCreated: number;
}> {
  const now = Date.now();
  let templatesCreated = 0;
  let workoutsCreated = 0;

  try {
    // Check if tables are empty
    const existingTemplates = await database
      .get<WorkoutTemplate>('workout_templates')
      .query()
      .fetch();
    const existingLogs = await database.get<WorkoutLog>('workout_logs').query().fetch();

    const templatesExist = existingTemplates.length > 0;
    const logsExist = existingLogs.length > 0;

    // If templates already exist and either logs already exist or the caller
    // explicitly disabled seeding workout history, there's nothing to do.
    if (templatesExist && (logsExist || !shouldSeedWorkoutHistory)) {
      console.log(
        `Skipping workout seeding: ${existingTemplates.length} templates and ${existingLogs.length} workout logs already exist or history seeding disabled`
      );

      return { templatesCreated: 0, workoutsCreated: 0 };
    }

    await database.write(async () => {
      // Get some exercises to use in workouts
      const exercises = await database.get<Exercise>('exercises').query().fetch();

      if (exercises.length === 0) {
        console.warn('No exercises found. Please seed exercises first.');
        return { templatesCreated: 0, workoutsCreated: 0 };
      }

      // Helper to find exercises by name
      const findExercise = (name: string): Exercise | undefined => {
        return exercises.find((ex) => (ex.name ?? '').toLowerCase().includes(name.toLowerCase()));
      };

      // Helper to get or create a default exercise
      const getOrCreateExercise = async (name: string, muscleGroup: string): Promise<Exercise> => {
        let exercise = findExercise(name);
        if (!exercise) {
          exercise = await database.get<Exercise>('exercises').create((ex) => {
            ex.name = name;
            ex.description = `Default ${name}`;
            ex.muscleGroup = muscleGroup as MuscleGroup;
            ex.equipmentType = 'dumbbell' as EquipmentType;
            ex.mechanicType = 'compound' as MechanicType;
            ex.loadMultiplier = 1.0; // Default load multiplier
            ex.createdAt = now;
            ex.updatedAt = now;
          });
        }
        return exercise;
      };

      // Get or create exercises for the seed data
      const benchPress = await getOrCreateExercise('Bench Press', 'Chest');
      const squat = await getOrCreateExercise('Squat', 'Legs');
      const deadlift = await getOrCreateExercise('Deadlift', 'Back');
      const overheadPress = await getOrCreateExercise('Overhead Press', 'Shoulders');
      const bicepCurl = await getOrCreateExercise('Bicep Curl', 'Arms');
      const tricepExtension = await getOrCreateExercise('Tricep Extension', 'Arms');
      const latPulldown = await getOrCreateExercise('Lat Pulldown', 'Back');
      const legPress = await getOrCreateExercise('Leg Press', 'Legs');

      // --- Grouped Test Workout (for groupId persistence testing) ---
      let groupedTestTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Grouped Test Workout'
      );

      if (!groupedTestTemplate) {
        groupedTestTemplate = await database
          .get<WorkoutTemplate>('workout_templates')
          .create((t) => {
            t.name = 'Grouped Test Workout';
            t.description = 'A workout with two exercises grouped together';
            t.createdAt = now;
            t.updatedAt = now;
          });
        templatesCreated++;

        // Use the same groupId for both exercises
        const groupId = 'seed-group-1';
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = groupedTestTemplate!.id;
          ts.exerciseId = benchPress.id;
          ts.targetReps = 8;
          ts.targetWeight = 70;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.groupId = groupId;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = groupedTestTemplate!.id;
          ts.exerciseId = overheadPress.id;
          ts.targetReps = 8;
          ts.targetWeight = 40;
          ts.restTimeAfter = 60;
          ts.setOrder = 2;
          ts.groupId = groupId;
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        // Add an ungrouped exercise (no groupId)
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = groupedTestTemplate!.id;
          ts.exerciseId = bicepCurl.id;
          ts.targetReps = 10;
          ts.targetWeight = 15;
          ts.restTimeAfter = 45;
          ts.setOrder = 3;
          // No groupId set here (ungrouped)
          ts.createdAt = now;
          ts.updatedAt = now;
        });

        // Add an ungrouped exercise (no groupId)
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = groupedTestTemplate!.id;
          ts.exerciseId = tricepExtension.id;
          ts.targetReps = 10;
          ts.targetWeight = 15;
          ts.restTimeAfter = 45;
          ts.setOrder = 3;
          // No groupId set here (ungrouped)
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      // Create or find workout templates
      let upperBodyTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Upper Body Power'
      );
      let legDayTemplate: WorkoutTemplate | undefined = existingTemplates.find(
        (t) => t.name === 'Leg Day / Squats'
      );

      if (!upperBodyTemplate) {
        upperBodyTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
          t.name = 'Upper Body Power';
          t.description = 'Upper body strength and power workout';
          t.createdAt = now;
          t.updatedAt = now;
        });
        templatesCreated++;

        // Create template sets for Upper Body Power
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = upperBodyTemplate!.id;
          ts.exerciseId = benchPress.id;
          ts.targetReps = 8;
          ts.targetWeight = 80;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = upperBodyTemplate!.id;
          ts.exerciseId = overheadPress.id;
          ts.targetReps = 10;
          ts.targetWeight = 50;
          ts.restTimeAfter = 60;
          ts.setOrder = 2;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = upperBodyTemplate!.id;
          ts.exerciseId = latPulldown.id;
          ts.targetReps = 10;
          ts.targetWeight = 70;
          ts.restTimeAfter = 60;
          ts.setOrder = 3;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = upperBodyTemplate!.id;
          ts.exerciseId = bicepCurl.id;
          ts.targetReps = 12;
          ts.targetWeight = 15;
          ts.restTimeAfter = 60;
          ts.setOrder = 4;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      if (!legDayTemplate) {
        legDayTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
          t.name = 'Leg Day / Squats';
          t.description = 'Lower body strength workout';
          t.createdAt = now;
          t.updatedAt = now;
        });
        templatesCreated++;

        // Create template sets for Leg Day
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = legDayTemplate!.id;
          ts.exerciseId = squat.id;
          ts.targetReps = 8;
          ts.targetWeight = 120;
          ts.restTimeAfter = 60;
          ts.setOrder = 1;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = legDayTemplate!.id;
          ts.exerciseId = legPress.id;
          ts.targetReps = 12;
          ts.restTimeAfter = 60;
          ts.targetWeight = 180;
          ts.setOrder = 2;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
        await database.get<WorkoutTemplateSet>('workout_template_sets').create((ts) => {
          ts.templateId = legDayTemplate!.id;
          ts.exerciseId = deadlift.id;
          ts.targetReps = 6;
          ts.targetWeight = 140;
          ts.restTimeAfter = 60;
          ts.setOrder = 3;
          ts.createdAt = now;
          ts.updatedAt = now;
        });
      }

      if (shouldSeedWorkoutHistory && !logsExist) {
        // Helper to create a workout log with sets
        const createWorkoutLog = async (
          templateId: string,
          workoutName: string,
          startedAt: number,
          durationMinutes: number,
          exerciseSets: { exercise: Exercise; sets: { weight: number; reps: number }[] }[],
          caloriesBurned?: number
        ): Promise<WorkoutLog> => {
          const completedAt = startedAt + durationMinutes * 60000;

          // Create workout log
          const workoutLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
            log.templateId = templateId;
            log.workoutName = workoutName;
            log.startedAt = startedAt;
            log.completedAt = completedAt;
            log.totalVolume = 0; // Will be calculated
            log.caloriesBurned = caloriesBurned;
            log.createdAt = now;
            log.updatedAt = now;
          });

          // Create sets and calculate total volume
          let totalVolume = 0;
          let setOrder = 1;

          for (const exerciseData of exerciseSets) {
            for (const set of exerciseData.sets) {
              const setVolume = set.weight * set.reps;
              totalVolume += setVolume;

              await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
                logSet.workoutLogId = workoutLog.id;
                logSet.exerciseId = exerciseData.exercise.id;
                logSet.reps = set.reps;
                logSet.weight = set.weight;
                logSet.restTimeAfter = 60; // 60 seconds rest
                logSet.difficultyLevel = 7; // RPE 7
                logSet.isDropSet = false;
                logSet.setOrder = setOrder;
                logSet.createdAt = now;
                logSet.updatedAt = now;
              });

              setOrder++;
            }
          }

          // Update workout log with total volume
          await workoutLog.update((log) => {
            log.totalVolume = totalVolume;
          });

          return workoutLog;
        };

        // Helper to create a date N days ago
        const daysAgo = (days: number): number => {
          const date = new Date();
          date.setDate(date.getDate() - days);
          date.setHours(18, 30, 0, 0); // 6:30 PM
          return date.getTime();
        };

        // Helper to create a date in a specific month
        const dateInMonth = (
          year: number,
          month: number,
          day: number,
          hour: number = 18,
          minute: number = 30
        ): number => {
          const date = new Date(year, month, day, hour, minute, 0, 0);
          return date.getTime();
        };

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        // Create workout logs with varying volumes to show progression
        // Upper Body Power workouts - showing volume progression
        const upperBodyWorkouts = [
          // Most recent (highest volume)
          {
            startedAt: daysAgo(2),
            durationMinutes: 70,
            caloriesBurned: 520,
            exerciseSets: [
              {
                exercise: benchPress,
                sets: [
                  { weight: 80, reps: 8 },
                  { weight: 80, reps: 8 },
                  { weight: 85, reps: 6 },
                ],
              },
              {
                exercise: overheadPress,
                sets: [
                  { weight: 50, reps: 10 },
                  { weight: 52.5, reps: 8 },
                  { weight: 55, reps: 6 },
                ],
              },
              {
                exercise: latPulldown,
                sets: [
                  { weight: 70, reps: 10 },
                  { weight: 72.5, reps: 8 },
                ],
              },
              {
                exercise: bicepCurl,
                sets: [
                  { weight: 15, reps: 12 },
                  { weight: 17.5, reps: 10 },
                ],
              },
            ],
          },
          // Previous month
          {
            startedAt: dateInMonth(currentYear, currentMonth - 1, 24, 18, 30),
            durationMinutes: 70,
            caloriesBurned: 500,
            exerciseSets: [
              {
                exercise: benchPress,
                sets: [
                  { weight: 78, reps: 8 },
                  { weight: 80, reps: 7 },
                  { weight: 82, reps: 6 },
                ],
              },
              {
                exercise: overheadPress,
                sets: [
                  { weight: 49, reps: 10 },
                  { weight: 51, reps: 8 },
                ],
              },
              {
                exercise: bicepCurl,
                sets: [
                  { weight: 14, reps: 12 },
                  { weight: 16, reps: 10 },
                ],
              },
            ],
          },
          // Two months ago
          {
            startedAt: dateInMonth(currentYear, currentMonth - 2, 26, 18, 0),
            durationMinutes: 65,
            caloriesBurned: 480,
            exerciseSets: [
              {
                exercise: benchPress,
                sets: [
                  { weight: 75, reps: 10 },
                  { weight: 78, reps: 8 },
                ],
              },
              {
                exercise: overheadPress,
                sets: [
                  { weight: 47, reps: 10 },
                  { weight: 49, reps: 8 },
                ],
              },
              {
                exercise: tricepExtension,
                sets: [
                  { weight: 18, reps: 12 },
                  { weight: 20, reps: 10 },
                ],
              },
            ],
          },
        ];

        // Leg Day workouts - showing volume progression
        const legDayWorkouts = [
          // Most recent
          {
            startedAt: daysAgo(4),
            durationMinutes: 55,
            caloriesBurned: 410,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 120, reps: 8 },
                  { weight: 125, reps: 6 },
                  { weight: 130, reps: 5 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 180, reps: 12 },
                  { weight: 200, reps: 10 },
                ],
              },
              {
                exercise: deadlift,
                sets: [
                  { weight: 140, reps: 6 },
                  { weight: 150, reps: 5 },
                ],
              },
            ],
          },
          // Previous month
          {
            startedAt: dateInMonth(currentYear, currentMonth - 1, 20, 17, 45),
            durationMinutes: 55,
            caloriesBurned: 420,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 118, reps: 8 },
                  { weight: 122, reps: 7 },
                  { weight: 125, reps: 6 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 175, reps: 12 },
                  { weight: 190, reps: 10 },
                ],
              },
            ],
          },
          // Two months ago
          {
            startedAt: dateInMonth(currentYear, currentMonth - 2, 15, 10, 0),
            durationMinutes: 50,
            caloriesBurned: 380,
            exerciseSets: [
              {
                exercise: squat,
                sets: [
                  { weight: 115, reps: 8 },
                  { weight: 120, reps: 7 },
                ],
              },
              {
                exercise: legPress,
                sets: [
                  { weight: 170, reps: 12 },
                  { weight: 180, reps: 10 },
                ],
              },
            ],
          },
        ];

        // Create all Upper Body Power workouts
        for (const workoutData of upperBodyWorkouts) {
          await createWorkoutLog(
            upperBodyTemplate!.id,
            'Upper Body Power',
            workoutData.startedAt,
            workoutData.durationMinutes,
            workoutData.exerciseSets,
            workoutData.caloriesBurned
          );
          workoutsCreated++;
        }

        // Create all Leg Day workouts
        for (const workoutData of legDayWorkouts) {
          await createWorkoutLog(
            legDayTemplate!.id,
            'Leg Day / Squats',
            workoutData.startedAt,
            workoutData.durationMinutes,
            workoutData.exerciseSets,
            workoutData.caloriesBurned
          );
          workoutsCreated++;
        }

        // Create a few more workouts without templates (ad-hoc workouts)
        const pushDayLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
          log.workoutName = 'Push Day';
          log.startedAt = daysAgo(7);
          log.completedAt = daysAgo(7) + 60 * 60000;
          log.totalVolume = 0;
          log.caloriesBurned = 450;
          log.createdAt = now;
          log.updatedAt = now;
        });

        let totalVolume = 0;
        let setOrder = 1;
        const pushDaySets = [
          {
            exercise: benchPress,
            sets: [
              { weight: 75, reps: 10 },
              { weight: 80, reps: 8 },
              { weight: 82.5, reps: 6 },
            ],
          },
          {
            exercise: overheadPress,
            sets: [
              { weight: 48, reps: 10 },
              { weight: 50, reps: 8 },
            ],
          },
          {
            exercise: tricepExtension,
            sets: [
              { weight: 20, reps: 12 },
              { weight: 22.5, reps: 10 },
            ],
          },
        ];

        for (const exerciseData of pushDaySets) {
          for (const set of exerciseData.sets) {
            totalVolume += set.weight * set.reps;
            await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
              logSet.workoutLogId = pushDayLog.id;
              logSet.exerciseId = exerciseData.exercise.id;
              logSet.reps = set.reps;
              logSet.weight = set.weight;
              logSet.restTimeAfter = 60;
              logSet.difficultyLevel = 7;
              logSet.isDropSet = false;
              logSet.setOrder = setOrder;
              logSet.createdAt = now;
              logSet.updatedAt = now;
            });
            setOrder++;
          }
        }

        await pushDayLog.update((log) => {
          log.totalVolume = totalVolume;
        });
        workoutsCreated++;
      }
    });

    console.log(
      `Seeded workout templates and history: ${templatesCreated} templates, ${workoutsCreated} workouts created`
    );
    return { templatesCreated, workoutsCreated };
  } catch (error) {
    console.error('Error seeding workout templates and history:', error);
    throw error;
  }
}

/**
 * Seeds workout history data with completed workouts across multiple months
 * Creates workout logs with different dates and associated workout log sets
 * @deprecated Use seedWorkoutTemplatesAndHistory instead
 */
async function seedWorkoutHistory(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    await database.write(async () => {
      // Get some exercises to use in workouts
      const exercises = await database.get<Exercise>('exercises').query().fetch();

      if (exercises.length === 0) {
        console.warn('No exercises found. Please seed exercises first.');
        return { created: 0 };
      }

      // Helper to find exercises by name
      const findExercise = (name: string): Exercise | undefined => {
        return exercises.find((ex) => (ex.name ?? '').toLowerCase().includes(name.toLowerCase()));
      };

      // Helper to get or create a default exercise
      const getOrCreateExercise = async (name: string, muscleGroup: string): Promise<Exercise> => {
        let exercise = findExercise(name);
        if (!exercise) {
          // Create a simple exercise if not found
          exercise = await database.get<Exercise>('exercises').create((ex) => {
            ex.name = name;
            ex.description = `Default ${name}`;
            ex.muscleGroup = muscleGroup as MuscleGroup;
            ex.equipmentType = 'dumbbell' as EquipmentType;
            ex.mechanicType = 'compound' as MechanicType;
            ex.loadMultiplier = 1.0; // Default load multiplier
            ex.createdAt = now;
            ex.updatedAt = now;
          });
        }
        return exercise;
      };

      // Helper to create a workout log with sets
      const createWorkoutLog = async (
        workoutName: string,
        startedAt: number,
        durationMinutes: number,
        exerciseSets: { exercise: Exercise; sets: { weight: number; reps: number }[] }[],
        caloriesBurned?: number
      ): Promise<WorkoutLog> => {
        const completedAt = startedAt + durationMinutes * 60000;

        // Create workout log
        const workoutLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
          log.workoutName = workoutName;
          log.startedAt = startedAt;
          log.completedAt = completedAt;
          log.totalVolume = 0; // Will be calculated
          log.caloriesBurned = caloriesBurned;
          log.createdAt = now;
          log.updatedAt = now;
        });

        // Create sets and calculate total volume
        let totalVolume = 0;
        let setOrder = 1;

        for (const exerciseData of exerciseSets) {
          for (const set of exerciseData.sets) {
            const setVolume = set.weight * set.reps;
            totalVolume += setVolume;

            await database.get<WorkoutLogSet>('workout_log_sets').create((logSet) => {
              logSet.workoutLogId = workoutLog.id;
              logSet.exerciseId = exerciseData.exercise.id;
              logSet.reps = set.reps;
              logSet.weight = set.weight;
              logSet.restTimeAfter = 60; // 60 seconds rest
              logSet.difficultyLevel = 7; // RPE 7
              logSet.isDropSet = false;
              logSet.setOrder = setOrder;
              logSet.createdAt = now;
              logSet.updatedAt = now;
            });

            setOrder++;
          }
        }

        // Update workout log with total volume
        await workoutLog.update((log) => {
          log.totalVolume = totalVolume;
        });

        return workoutLog;
      };

      // Get or create exercises for the seed data
      const benchPress = await getOrCreateExercise('Bench Press', 'Chest');
      const squat = await getOrCreateExercise('Squat', 'Legs');
      const deadlift = await getOrCreateExercise('Deadlift', 'Back');
      const overheadPress = await getOrCreateExercise('Overhead Press', 'Shoulders');
      const bicepCurl = await getOrCreateExercise('Bicep Curl', 'Arms');
      const tricepExtension = await getOrCreateExercise('Tricep Extension', 'Arms');
      const latPulldown = await getOrCreateExercise('Lat Pulldown', 'Back');
      const legPress = await getOrCreateExercise('Leg Press', 'Legs');

      // Create workouts across different months
      // Current month - August 2024 (adjust dates as needed)
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Helper to create a date N days ago
      const daysAgo = (days: number): number => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        // Set time to a specific hour for consistency
        date.setHours(18, 30, 0, 0); // 6:30 PM
        return date.getTime();
      };

      // Helper to create a date in a specific month
      const dateInMonth = (
        year: number,
        month: number,
        day: number,
        hour: number = 18,
        minute: number = 30
      ): number => {
        const date = new Date(year, month, day, hour, minute, 0, 0);
        return date.getTime();
      };

      const workouts: {
        name: string;
        startedAt: number;
        durationMinutes: number;
        exerciseSets: { exercise: Exercise; sets: { weight: number; reps: number }[] }[];
        caloriesBurned?: number;
      }[] = [
        // Current month - recent workouts
        {
          name: 'Upper Body Power',
          startedAt: daysAgo(2),
          durationMinutes: 70,
          caloriesBurned: 520,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 80, reps: 8 },
                { weight: 80, reps: 8 },
                { weight: 85, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 50, reps: 10 },
                { weight: 52.5, reps: 8 },
                { weight: 55, reps: 6 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 70, reps: 10 },
                { weight: 72.5, reps: 8 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 15, reps: 12 },
                { weight: 17.5, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Leg Day / Squats',
          startedAt: daysAgo(4),
          durationMinutes: 55,
          caloriesBurned: 410,
          exerciseSets: [
            {
              exercise: squat,
              sets: [
                { weight: 120, reps: 8 },
                { weight: 125, reps: 6 },
                { weight: 130, reps: 5 },
              ],
            },
            {
              exercise: legPress,
              sets: [
                { weight: 180, reps: 12 },
                { weight: 200, reps: 10 },
              ],
            },
            {
              exercise: deadlift,
              sets: [
                { weight: 140, reps: 6 },
                { weight: 150, reps: 5 },
              ],
            },
          ],
        },
        {
          name: 'Push Day',
          startedAt: daysAgo(7),
          durationMinutes: 60,
          caloriesBurned: 450,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 75, reps: 10 },
                { weight: 80, reps: 8 },
                { weight: 82.5, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 48, reps: 10 },
                { weight: 50, reps: 8 },
              ],
            },
            {
              exercise: tricepExtension,
              sets: [
                { weight: 20, reps: 12 },
                { weight: 22.5, reps: 10 },
              ],
            },
          ],
        },
        // Previous month
        {
          name: 'Full Body Blast',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 28, 12, 0),
          durationMinutes: 75,
          caloriesBurned: 550,
          exerciseSets: [
            {
              exercise: deadlift,
              sets: [
                { weight: 135, reps: 6 },
                { weight: 145, reps: 5 },
              ],
            },
            {
              exercise: benchPress,
              sets: [
                { weight: 77.5, reps: 8 },
                { weight: 80, reps: 7 },
              ],
            },
            {
              exercise: squat,
              sets: [
                { weight: 115, reps: 10 },
                { weight: 120, reps: 8 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 68, reps: 10 },
                { weight: 70, reps: 9 },
              ],
            },
          ],
        },
        {
          name: 'Upper Body Power',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 24, 18, 30),
          durationMinutes: 70,
          caloriesBurned: 500,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 78, reps: 8 },
                { weight: 80, reps: 7 },
                { weight: 82, reps: 6 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 49, reps: 10 },
                { weight: 51, reps: 8 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 14, reps: 12 },
                { weight: 16, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Leg Day / Squats',
          startedAt: dateInMonth(currentYear, currentMonth - 1, 20, 17, 45),
          durationMinutes: 55,
          caloriesBurned: 420,
          exerciseSets: [
            {
              exercise: squat,
              sets: [
                { weight: 118, reps: 8 },
                { weight: 122, reps: 7 },
                { weight: 125, reps: 6 },
              ],
            },
            {
              exercise: legPress,
              sets: [
                { weight: 175, reps: 12 },
                { weight: 190, reps: 10 },
              ],
            },
          ],
        },
        // Two months ago
        {
          name: 'Pull Day',
          startedAt: dateInMonth(currentYear, currentMonth - 2, 30, 10, 0),
          durationMinutes: 50,
          caloriesBurned: 380,
          exerciseSets: [
            {
              exercise: deadlift,
              sets: [
                { weight: 130, reps: 6 },
                { weight: 135, reps: 5 },
              ],
            },
            {
              exercise: latPulldown,
              sets: [
                { weight: 65, reps: 12 },
                { weight: 68, reps: 10 },
              ],
            },
            {
              exercise: bicepCurl,
              sets: [
                { weight: 13, reps: 12 },
                { weight: 15, reps: 10 },
              ],
            },
          ],
        },
        {
          name: 'Upper Body Power',
          startedAt: dateInMonth(currentYear, currentMonth - 2, 26, 18, 0),
          durationMinutes: 65,
          caloriesBurned: 480,
          exerciseSets: [
            {
              exercise: benchPress,
              sets: [
                { weight: 75, reps: 10 },
                { weight: 78, reps: 8 },
              ],
            },
            {
              exercise: overheadPress,
              sets: [
                { weight: 47, reps: 10 },
                { weight: 49, reps: 8 },
              ],
            },
            {
              exercise: tricepExtension,
              sets: [
                { weight: 18, reps: 12 },
                { weight: 20, reps: 10 },
              ],
            },
          ],
        },
      ];

      // Create all workouts
      for (const workoutData of workouts) {
        await createWorkoutLog(
          workoutData.name,
          workoutData.startedAt,
          workoutData.durationMinutes,
          workoutData.exerciseSets,
          workoutData.caloriesBurned
        );
        created++;
      }
    });

    console.log(`Seeded workout history: ${created} workouts created`);
    return { created };
  } catch (error) {
    console.error('Error seeding workout history:', error);
    throw error;
  }
}

async function seedUserMetrics(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    await database.write(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Helper to create a date N days ago
      const daysAgo = (days: number): number => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(8, 30, 0, 0); // 8:30 AM for consistency
        return new Date(date.setHours(0, 0, 0, 0)).getTime(); // Set to midnight for date tracking
      };

      // Helper to create a date in a specific month
      const dateInMonth = (year: number, month: number, day: number): number => {
        const date = new Date(year, month, day, 8, 30, 0, 0);
        return new Date(date.setHours(0, 0, 0, 0)).getTime();
      };

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Assume user height is 180cm (1.8m) for BMI/FFMI calculations
      const heightM = 1.8;
      const heightM2 = heightM * heightM;

      // Weight progression: Start at 79.5kg, gradual decrease to 78.5kg over 3 months
      const weightData: { date: number; weight: number; bodyFat: number }[] = [
        // Current month
        { date: daysAgo(0), weight: 78.5, bodyFat: 15.0 },
        { date: daysAgo(3), weight: 78.7, bodyFat: 15.2 },
        { date: daysAgo(7), weight: 78.9, bodyFat: 15.1 },
        { date: daysAgo(10), weight: 79.1, bodyFat: 15.3 },
        { date: daysAgo(14), weight: 79.0, bodyFat: 15.2 },
        { date: daysAgo(18), weight: 79.2, bodyFat: 15.4 },
        { date: daysAgo(21), weight: 79.3, bodyFat: 15.3 },

        // Previous month
        { date: dateInMonth(currentYear, currentMonth - 1, 28), weight: 79.2, bodyFat: 15.5 },
        { date: dateInMonth(currentYear, currentMonth - 1, 24), weight: 79.4, bodyFat: 15.6 },
        { date: dateInMonth(currentYear, currentMonth - 1, 20), weight: 79.3, bodyFat: 15.5 },
        { date: dateInMonth(currentYear, currentMonth - 1, 15), weight: 79.5, bodyFat: 15.7 },
        { date: dateInMonth(currentYear, currentMonth - 1, 10), weight: 79.4, bodyFat: 15.6 },
        { date: dateInMonth(currentYear, currentMonth - 1, 5), weight: 79.6, bodyFat: 15.8 },
        { date: dateInMonth(currentYear, currentMonth - 1, 1), weight: 79.5, bodyFat: 15.7 },

        // Two months ago
        { date: dateInMonth(currentYear, currentMonth - 2, 28), weight: 79.6, bodyFat: 15.9 },
        { date: dateInMonth(currentYear, currentMonth - 2, 24), weight: 79.7, bodyFat: 16.0 },
        { date: dateInMonth(currentYear, currentMonth - 2, 20), weight: 79.6, bodyFat: 15.9 },
        { date: dateInMonth(currentYear, currentMonth - 2, 15), weight: 79.8, bodyFat: 16.1 },
        { date: dateInMonth(currentYear, currentMonth - 2, 10), weight: 79.7, bodyFat: 16.0 },
        { date: dateInMonth(currentYear, currentMonth - 2, 5), weight: 79.9, bodyFat: 16.2 },
      ];

      // Create metrics for each date
      for (const data of weightData) {
        // Calculate BMI: BMI = weight (kg) / height (m)^2
        const bmi = data.weight / heightM2;

        // Calculate FFMI: FFMI = (weight * (1 - bodyFat/100)) / height (m)^2
        const fatFreeMass = data.weight * (1 - data.bodyFat / 100);
        const ffmi = fatFreeMass / heightM2;

        // Weight metric
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'weight';
          metric.value = data.weight;
          metric.unit = 'kg';
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        // Body Fat metric
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'body_fat';
          metric.value = data.bodyFat;
          metric.unit = '%';
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        // BMI metric
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'bmi';
          metric.value = bmi;
          metric.unit = '';
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;

        // FFMI metric
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = 'ffmi';
          metric.value = ffmi;
          metric.unit = '';
          metric.date = data.date;
          metric.timezone = timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        created++;
      }
    });

    console.log(`Seeded user metrics: ${created} metrics created`);
    return { created };
  } catch (error) {
    console.error('Error seeding user metrics:', error);
    throw error;
  }
}

/**
 * Seeds the foods database with test data for the unified search functionality
 * Only runs if the foods table is empty
 * Returns true if seeding was performed, false if database already had foods
 */
async function seedFoods(): Promise<{ created: number }> {
  const now = Date.now();
  let created = 0;

  try {
    // Check if there are any foods in the database
    const existingFoods = await database.get<Food>('foods').query().fetch();

    // If database already has foods, skip seeding
    if (existingFoods.length > 0) {
      console.log(`Skipping food seeding: ${existingFoods.length} foods already exist`);
      return { created: 0 };
    }

    await database.write(async () => {
      // Simple foods for easy testing
      const simpleFoods = [
        {
          name: 'Banana',
          brand: 'Nature',
          calories: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
          fiber: 2.6,
          isFavorite: true,
        },
        {
          name: 'Chicken Breast',
          brand: 'Farm Fresh',
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Brown Rice',
          brand: 'Organic Farms',
          calories: 111,
          protein: 2.6,
          carbs: 23,
          fat: 0.9,
          fiber: 1.8,
          isFavorite: false,
        },
        {
          name: 'Eggs',
          brand: 'Happy Hens',
          calories: 155,
          protein: 13,
          carbs: 1.1,
          fat: 11,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Greek Yogurt',
          brand: 'Dairy Fresh',
          calories: 100,
          protein: 17,
          carbs: 6,
          fat: 0.7,
          fiber: 0,
          isFavorite: false,
        },
        {
          name: 'Oatmeal',
          brand: 'Whole Grains',
          calories: 68,
          protein: 2.4,
          carbs: 12,
          fat: 1.4,
          fiber: 1.7,
          isFavorite: false,
        },
        {
          name: 'Salmon',
          brand: 'Ocean Fresh',
          calories: 208,
          protein: 20,
          carbs: 0,
          fat: 13,
          fiber: 0,
          isFavorite: true,
        },
        {
          name: 'Sweet Potato',
          brand: 'Root Vegetables',
          calories: 86,
          protein: 1.6,
          carbs: 20,
          fat: 0.1,
          fiber: 3,
          isFavorite: false,
        },
      ];

      // Complex foods for testing
      const complexFoods = [
        {
          name: 'Chinese Corn Noodles with Chicken Broth',
          brand: 'Asian Kitchen',
          calories: 320,
          protein: 18,
          carbs: 42,
          fat: 8,
          fiber: 3.5,
          isFavorite: false,
        },
        {
          name: 'Mediterranean Quinoa Bowl',
          brand: 'Healthy Bowls',
          calories: 380,
          protein: 14,
          carbs: 52,
          fat: 14,
          fiber: 8,
          isFavorite: true,
        },
        {
          name: 'Protein Power Smoothie',
          brand: 'Fitness Fuel',
          calories: 280,
          protein: 25,
          carbs: 35,
          fat: 6,
          fiber: 4,
          isFavorite: false,
        },
      ];

      const allFoods = [...simpleFoods, ...complexFoods];

      for (const foodData of allFoods) {
        const food = await database.get<Food>('foods').create((food) => {
          food.isAiGenerated = false;
          food.name = foodData.name;
          food.brand = foodData.brand;
          food.barcode = undefined;
          food.calories = foodData.calories;
          food.protein = foodData.protein;
          food.carbs = foodData.carbs;
          food.fat = foodData.fat;
          food.fiber = foodData.fiber;
          food.micros = {}; // Empty micros for now
          food.isFavorite = foodData.isFavorite;
          food.source = 'user';
          food.createdAt = now;
          food.updatedAt = now;
        });

        // Create or find the default 100g portion (global, reusable)
        const existingPortion = await database
          .get<FoodPortion>('food_portions')
          .query(Q.where('name', '100g'), Q.where('gram_weight', 100))
          .fetch();

        const defaultPortion =
          existingPortion.length > 0
            ? existingPortion[0]
            : await database.get<FoodPortion>('food_portions').create((portion) => {
                portion.name = '100g';
                portion.gramWeight = 100;
                portion.createdAt = now;
                portion.updatedAt = now;
              });

        // Link food to portion via junction table
        await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
          ffp.foodId = food.id;
          ffp.foodPortionId = defaultPortion.id;
          ffp.isDefault = true;
          ffp.createdAt = now;
          ffp.updatedAt = now;
        });

        created++;
      }

      // Seed a few nutrition logs referencing the foods we just created
      const seededFoods = await database.get<Food>('foods').query().fetch();
      const foodByName = new Map<string, Food>(
        seededFoods.map((f) => [(f.name ?? '').toLowerCase(), f])
      );

      const daysAgo = (days: number): number => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(0, 0, 0, 0); // midnight for the day
        return date.getTime();
      };

      const nutritionLogs = [
        { name: 'Banana', daysAgo: 0, type: 'breakfast', amount: 120 }, // 120g banana
        { name: 'Greek Yogurt', daysAgo: 0, type: 'snack', amount: 150 },
        { name: 'Chicken Breast', daysAgo: 0, type: 'lunch', amount: 200 },
        { name: 'Brown Rice', daysAgo: 0, type: 'lunch', amount: 150 },
        { name: 'Salmon', daysAgo: 0, type: 'dinner', amount: 180 },
        { name: 'Sweet Potato', daysAgo: 0, type: 'dinner', amount: 200 },
        { name: 'Protein Power Smoothie', daysAgo: 2, type: 'snack', amount: 250 }, // 250ml smoothie
        { name: 'Mediterranean Quinoa Bowl', daysAgo: 3, type: 'lunch', amount: 350 }, // 350g bowl
      ];

      for (const nl of nutritionLogs) {
        const f = foodByName.get(nl.name.toLowerCase());
        if (!f) continue;

        await database.get<any>('nutrition_logs').create((log: any) => {
          log.foodId = f.id;
          log.date = daysAgo(nl.daysAgo);
          log.type = nl.type;
          log.amount = nl.amount;
          log.portionId = undefined;
          log.createdAt = now;
          log.updatedAt = now;
        });
        created++;
      }

      // Seed a default nutrition goal if none exist
      const existingNutritionGoals = await database.get<any>('nutrition_goals').query().fetch();
      if (existingNutritionGoals.length === 0) {
        await database.get<any>('nutrition_goals').create((goal: any) => {
          goal.totalCalories = 2500;
          goal.protein = 180; // grams
          goal.carbs = 300; // grams
          goal.fats = 80; // grams
          goal.fiber = 30; // grams
          goal.eatingPhase = 'maintain';
          goal.targetWeight = 78.5; // kg
          goal.targetBodyFat = 15.0; // %
          goal.targetBmi = 24.2;
          goal.targetFfmi = 19.5;
          goal.targetDate = undefined;
          goal.effectiveUntil = undefined;
          goal.createdAt = now;
          goal.updatedAt = now;
        });
        created++;
      }
    });

    console.log(`Seeded foods database: ${created} foods created`);
    return { created };
  } catch (error) {
    console.error('Error seeding foods database:', error);
    throw error;
  }
}

export async function seedDevData(): Promise<boolean> {
  const exercisesSeeded = await seedExercisesIfEmpty();
  return false;
  const workoutData = await seedWorkoutTemplatesAndHistory();
  const userMetricsSeeded = await seedUserMetrics();
  const foodsSeeded = await seedFoods();
  // const foodsSeeded = { created: 10 };

  console.log(
    `Dev data seeding complete. Exercises: ${exercisesSeeded ? 'seeded' : 'skipped'}, Workout Templates: ${workoutData.templatesCreated}, Workout History: ${workoutData.workoutsCreated} workouts, User Metrics: ${userMetricsSeeded.created} metrics, Foods: ${foodsSeeded.created} foods`
  );

  return (
    exercisesSeeded ||
    workoutData.templatesCreated > 0 ||
    workoutData.workoutsCreated > 0 ||
    userMetricsSeeded.created > 0 ||
    foodsSeeded.created > 0
  );
}
