import { kgToDisplay, displayToKg, cmToDisplay, displayToCm, gramsToDisplay, displayToGrams } from '../unitConversion';

describe('unitConversion', () => {
  describe('Weight (kg <-> lb)', () => {
    it('kgToDisplay: returns same value for metric', () => {
      expect(kgToDisplay(70, 'metric')).toBe(70);
    });

    it('kgToDisplay: converts kg to lb for imperial', () => {
      // 1 kg is approx 2.20462 lbs
      expect(kgToDisplay(1, 'imperial')).toBeCloseTo(2.20462);
      expect(kgToDisplay(70, 'imperial')).toBeCloseTo(154.324);
    });

    it('displayToKg: returns same value for metric', () => {
      expect(displayToKg(70, 'metric')).toBe(70);
    });

    it('displayToKg: converts lb to kg for imperial', () => {
      expect(displayToKg(2.20462, 'imperial')).toBeCloseTo(1);
      expect(displayToKg(154.324, 'imperial')).toBeCloseTo(70);
    });
  });

  describe('Height (cm <-> in)', () => {
    it('cmToDisplay: returns same value for metric', () => {
      expect(cmToDisplay(170, 'metric')).toBe(170);
    });

    it('cmToDisplay: converts cm to in for imperial', () => {
      // 1 cm is approx 0.393701 inches
      expect(cmToDisplay(1, 'imperial')).toBeCloseTo(0.393701);
      expect(cmToDisplay(170, 'imperial')).toBeCloseTo(66.9291);
    });

    it('displayToCm: returns same value for metric', () => {
      expect(displayToCm(170, 'metric')).toBe(170);
    });

    it('displayToCm: converts in to cm for imperial', () => {
      expect(displayToCm(0.393701, 'imperial')).toBeCloseTo(1);
      expect(displayToCm(66.9291, 'imperial')).toBeCloseTo(170);
    });
  });

  describe('Mass (g <-> oz)', () => {
    it('gramsToDisplay: returns same value for metric', () => {
      expect(gramsToDisplay(100, 'metric')).toBe(100);
    });

    it('gramsToDisplay: converts g to oz for imperial', () => {
      // 1 g is approx 0.035274 oz
      expect(gramsToDisplay(1, 'imperial')).toBeCloseTo(0.035274);
      expect(gramsToDisplay(100, 'imperial')).toBeCloseTo(3.5274);
    });

    it('displayToGrams: returns same value for metric', () => {
      expect(displayToGrams(100, 'metric')).toBe(100);
    });

    it('displayToGrams: converts oz to g for imperial', () => {
      expect(displayToGrams(0.035274, 'imperial')).toBeCloseTo(1);
      expect(displayToGrams(3.5274, 'imperial')).toBeCloseTo(100);
    });
  });
});
