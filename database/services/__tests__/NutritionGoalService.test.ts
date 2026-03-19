import { database } from '../../../database';
import { NutritionGoalService } from '../NutritionGoalService';
import { NutritionCheckinService } from '../NutritionCheckinService';
import NutritionGoal from '../../models/NutritionGoal';

jest.mock('../../../lang/lang', () => ({
  t: (key: string) => key,
  language: 'en-US',
  use: () => ({ init: () => {} }),
}));

describe('NutritionGoalService', () => {
  beforeEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  it('should save goals and generate check-ins', async () => {
    const goalsData = {
      totalCalories: 2500,
      protein: 200,
      carbs: 250,
      fats: 70,
      fiber: 30,
      eatingPhase: 'bulking',
      targetWeight: 90,
      targetBodyFat: 15,
      targetBMI: 25,
      targetFFMI: 22,
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };

    const newGoal = await NutritionGoalService.saveGoals(goalsData);
    expect(newGoal).toBeDefined();
    expect(newGoal.totalCalories).toBe(2500);

    const checkins = await NutritionCheckinService.getByGoalId(newGoal.id);
    expect(checkins.length).toBe(12);
    expect(checkins[0].status).toBe('pending');
  });

  it('should archive previous goals when saving new ones', async () => {
    const goalsData1 = {
      totalCalories: 2000,
      protein: 150,
      carbs: 200,
      fats: 60,
      fiber: 25,
      eatingPhase: 'maintenance',
      targetWeight: 80,
      targetBodyFat: 15,
    };

    const goal1 = await NutritionGoalService.saveGoals(goalsData1);
    expect(goal1.effectiveUntil).toBeNull();

    const goalsData2 = { ...goalsData1, totalCalories: 2200 };
    const goal2 = await NutritionGoalService.saveGoals(goalsData2);

    const fetchedGoal1 = await database.get<NutritionGoal>('nutrition_goals').find(goal1.id);
    expect(fetchedGoal1.effectiveUntil).not.toBeNull();
    expect(goal2.effectiveUntil).toBeNull();
  });
});
