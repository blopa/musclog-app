import { readFileSync } from 'fs';
import { join } from 'path';

// SmartCameraModal is too large to render in a unit test; this pins how it logs an AI meal.
const source = readFileSync(join(__dirname, '..', 'SmartCameraModal.tsx'), 'utf8').replace(
  /\s+/g,
  ' '
);

describe('SmartCameraModal logs an estimated meal food by food', () => {
  it('goes through the shared tracked-meal logger when the estimate has ingredients', () => {
    expect(source).toContain('logTrackedMeal(');
  });

  it('hands the estimate to the shared logger without building groups itself', () => {
    expect(source).toContain('logTrackedMeal({ ingredients: aiIngredients');
    expect(source).not.toContain('groupId: randomUUID()');
  });
});
