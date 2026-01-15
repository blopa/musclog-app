import { database } from './index';
import Exercise from './models/Exercise';
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
