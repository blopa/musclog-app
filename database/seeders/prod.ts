import { FoodPortionService } from '../services';

/**
 * Seed production data
 * This seeds only the common food portions that will be available in the production app
 * Foods are NOT seeded in production - users will add them as needed via the app
 */
export async function seedProductionData(): Promise<boolean> {
  // TODO: see exercises too
  try {
    // Check if portions already exist
    const existingPortions = await FoodPortionService.getAllPortions();

    if (existingPortions.length > 0) {
      console.log(`Skipping portion seeding: ${existingPortions.length} portions already exist`);
      return false;
    }

    // Create common portions
    const createdPortions = await FoodPortionService.createCommonPortions();
    console.log(`Seeded ${createdPortions.length} common food portions`);

    return true;
  } catch (error) {
    console.error('Error seeding production data:', error);
    throw error;
  }
}
