import { database } from './index';
import Exercise from './models/Exercise';
import WorkoutLog from './models/WorkoutLog';
import WorkoutLogSet from './models/WorkoutLogSet';
import exercisesData from '../data/exercisesEnUS.json';

interface ExerciseJsonData {
  name: string;
  muscleGroup: string;
  type: 'compound' | 'isolation' | 'machine' | 'bodyweight' | 'cardio' | 'plyometric';
  description: string;
  targetMuscles?: string[];
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
      // Try to infer equipment from name (will default to Barbell)
      equipmentType = 'Barbell';
      break;
    case 'isolation':
      mechanicType = 'isolation';
      // Try to infer equipment from name (will default to Dumbbell for isolation)
      equipmentType = 'Dumbbell';
      break;
    case 'machine':
      mechanicType = 'compound'; // Machine exercises can be compound or isolation, default to compound
      equipmentType = 'Machine';
      break;
    case 'bodyweight':
      mechanicType = 'compound'; // Bodyweight exercises can be compound or isolation, default to compound
      equipmentType = 'Bodyweight';
      break;
    case 'cardio':
      mechanicType = 'compound';
      equipmentType = 'Cardio';
      break;
    case 'plyometric':
      mechanicType = 'compound';
      equipmentType = 'Plyometric';
      break;
    default:
      mechanicType = 'compound';
      equipmentType = 'Barbell';
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
    return 'Dumbbell';
  }
  if (lowerName.includes('barbell') || lowerName.includes('bb ')) {
    return 'Barbell';
  }
  if (lowerName.includes('cable')) {
    return 'Cable';
  }
  if (lowerName.includes('kettlebell')) {
    return 'Kettlebell';
  }
  if (lowerName.includes('machine') || lowerName.includes(' smith')) {
    return 'Machine';
  }

  return defaultEquipment;
}

/**
 * Loads exercises from exercisesEnUS.json and populates the Exercise collection
 * Skips exercises that already exist (by name) to allow re-running without duplicates
 */
export async function loadExercisesFromJson(): Promise<{ created: number; skipped: number }> {
  const exercises = exercisesData as ExerciseJsonData[];
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  await database.write(async () => {
    // Get all existing exercises to check for duplicates
    const existingExercises = await database.get<Exercise>('exercises').query().fetch();
    const existingNames = new Set(existingExercises.map((ex: Exercise) => ex.name.toLowerCase()));

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
          exercise.muscleGroup = exerciseData.muscleGroup;
          exercise.equipmentType = equipmentType;
          exercise.mechanicType = mechanicType;
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
export async function seedExercisesIfEmpty(): Promise<boolean> {
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
 * Seeds workout history data with completed workouts across multiple months
 * Creates workout logs with different dates and associated workout log sets
 */
export async function seedWorkoutHistory(): Promise<{ created: number }> {
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
        return exercises.find((ex) => ex.name.toLowerCase().includes(name.toLowerCase()));
      };

      // Helper to get or create a default exercise
      const getOrCreateExercise = async (name: string, muscleGroup: string): Promise<Exercise> => {
        let exercise = findExercise(name);
        if (!exercise) {
          // Create a simple exercise if not found
          exercise = await database.get<Exercise>('exercises').create((ex) => {
            ex.name = name;
            ex.description = `Default ${name}`;
            ex.muscleGroup = muscleGroup;
            ex.equipmentType = 'Dumbbell';
            ex.mechanicType = 'compound';
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
        exerciseSets: { exercise: Exercise; sets: { weight: number; reps: number }[] }[]
      ): Promise<WorkoutLog> => {
        const completedAt = startedAt + durationMinutes * 60000;

        // Create workout log
        const workoutLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
          log.workoutName = workoutName;
          log.startedAt = startedAt;
          log.completedAt = completedAt;
          log.totalVolume = 0; // Will be calculated
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
              logSet.restTime = 60; // 60 seconds rest
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
      }[] = [
        // Current month - recent workouts
        {
          name: 'Upper Body Power',
          startedAt: daysAgo(2),
          durationMinutes: 70,
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
          workoutData.exerciseSets
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

export async function seedDevData(): Promise<boolean> {
  const exercisesSeeded = await seedExercisesIfEmpty();
  const workoutHistorySeeded = await seedWorkoutHistory();

  console.log(
    `Dev data seeding complete. Exercises: ${exercisesSeeded ? 'seeded' : 'skipped'}, Workout History: ${workoutHistorySeeded.created} workouts`
  );

  return exercisesSeeded || workoutHistorySeeded.created > 0;
}
