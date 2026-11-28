import { readFileSync } from 'fs';
import { join } from 'path';

// SmartCameraModal is too large to render in a unit test; this pins that it logs nothing itself
// (`useMealCameraSession.dom.test.tsx` covers how the session writes a meal).
const source = readFileSync(join(__dirname, '..', 'SmartCameraModal.tsx'), 'utf8').replace(
  /\s+/g,
  ' '
);

describe('SmartCameraModal logs an estimated meal food by food', () => {
  it('goes through the camera session, never building the diary rows itself', () => {
    expect(source).toContain('meal.logReview(data)');
    expect(source).not.toContain('NutritionService.logCustomMeal');
    expect(source).not.toContain('groupId: randomUUID()');
  });

  it('rethrows a failed save, so the review modal stays open with the estimate', () => {
    expect(source).toMatch(
      /meal\.logReview\(data\);.*?t\('food\.aiCamera\.mealLoggingFailed'\)\);.*?throw error;/
    );
  });
});
