import { ExerciseService, FoodPortionService } from '../services';

/**
 * Seed production data
 * This seeds only the common food portions and exercises that will be available in the production app
 * Foods are NOT seeded in production - users will add them as needed via the app
 */
export async function seedProductionData(): Promise<boolean> {
  try {
    // Check if portions already exist
    const existingPortions = await FoodPortionService.getAllPortions();

    if (existingPortions.length > 0) {
      console.log(`Skipping portion seeding: ${existingPortions.length} portions already exist`);
    } else {
      // Create common portions
      const createdPortions = await FoodPortionService.createCommonPortions();
      console.log(`Seeded ${createdPortions.length} common food portions`);
    }

    // Check if exercises already exist
    const existingExercises = await ExerciseService.getAllExercises();

    if (existingExercises.length > 0) {
      console.log(`Skipping exercise seeding: ${existingExercises.length} exercises already exist`);
    } else {
      // Create common exercises
      const createdExercises = await ExerciseService.createCommonExercises();
      console.log(`Seeded ${createdExercises.length} common exercises`);
    }

    return true;
  } catch (error) {
    console.error('Error seeding production data:', error);
    throw error;
  }
}
