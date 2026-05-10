import {
  inferCaloriesFromMacrosPer100g,
  resolveRoundedPer100gCaloriesForDisplay,
} from '../inferCaloriesFromMacros';

describe('inferCaloriesFromMacros', () => {
  describe('inferCaloriesFromMacrosPer100g', () => {
    it('should calculate calories correctly with positive values', () => {
      // 10g protein (40), 20g carbs (80), 5g fat (45), 2g fiber (4)
      // digestible carbs = 20 - 2 = 18.
      // 10*4 + 18*4 + 5*9 + 2*2 = 40 + 72 + 45 + 4 = 161
      expect(inferCaloriesFromMacrosPer100g(10, 20, 5, 2)).toBe(161);
    });

    it('should clamp negative macros to 0', () => {
      // -10g protein (0), -20g carbs (0), -5g fat (0), -2g fiber (0)
      expect(inferCaloriesFromMacrosPer100g(-10, -20, -5, -2)).toBe(0);
    });

    it('should handle digestible carbs clamping', () => {
      // 10g carbs, 20g fiber -> digestible carbs = max(0, 10-20) = 0
      // 0*4 (protein) + 0*4 (carbs) + 0*9 (fat) + 20*2 (fiber) = 40
      expect(inferCaloriesFromMacrosPer100g(0, 10, 0, 20)).toBe(40);
    });

    it('should handle alcohol', () => {
      // 10g alcohol (70)
      expect(inferCaloriesFromMacrosPer100g(0, 0, 0, 0, 10)).toBe(70);
    });

    it('should clamp negative alcohol to 0', () => {
      expect(inferCaloriesFromMacrosPer100g(0, 0, 0, 0, -10)).toBe(0);
    });
  });

  describe('resolveRoundedPer100gCaloriesForDisplay', () => {
    it('should return existing calories if positive', () => {
      expect(resolveRoundedPer100gCaloriesForDisplay({ calories: 150 })).toBe(150);
    });

    it('should infer calories if calories is 0 and macros exist', () => {
      // 10g protein, 20g carbs, 5g fat, 2g fiber -> 161
      expect(
        resolveRoundedPer100gCaloriesForDisplay({
          calories: 0,
          protein: 10,
          carbs: 20,
          fat: 5,
          fiber: 2,
        })
      ).toBe(161);
    });

    it('should clamp inferred calories to 0 even if macros are negative', () => {
      expect(
        resolveRoundedPer100gCaloriesForDisplay({
          calories: 0,
          protein: -10,
          carbs: -20,
          fat: -5,
          fiber: -2,
        })
      ).toBe(0);
    });
  });
});
