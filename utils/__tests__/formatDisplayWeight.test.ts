import {
  displayWeightKgNumeric,
  formatDisplayGrams,
  formatDisplayWeightKg,
} from '@/utils/formatDisplayWeight';

const G_PER_OZ = 28.349523125;

describe('formatDisplayWeight', () => {
  describe('displayWeightKgNumeric', () => {
    it('keeps whole kg values whole in metric (no phantom ".0")', () => {
      expect(displayWeightKgNumeric(80, 'metric')).toBe(80);
      expect(Number.isInteger(displayWeightKgNumeric(80, 'metric'))).toBe(true);
    });

    it('rounds a fractional metric weight to one decimal', () => {
      expect(displayWeightKgNumeric(82.44, 'metric')).toBe(82.4);
      expect(displayWeightKgNumeric(82.46, 'metric')).toBe(82.5);
    });

    it('converts to lb and rounds to one decimal in imperial', () => {
      // 100 kg = 220.4622... lb
      expect(displayWeightKgNumeric(100, 'imperial')).toBe(220.5);
    });

    it('keeps an exactly-whole converted value whole', () => {
      expect(displayWeightKgNumeric(0, 'imperial')).toBe(0);
    });
  });

  describe('formatDisplayWeightKg', () => {
    it('renders whole weights without a decimal separator', () => {
      expect(formatDisplayWeightKg('en-US', 'metric', 80)).toBe('80');
      expect(formatDisplayWeightKg('de-DE', 'metric', 80)).toBe('80');
    });

    it('uses the locale decimal separator for fractional weights', () => {
      expect(formatDisplayWeightKg('en-US', 'metric', 82.4)).toBe('82.4');
      expect(formatDisplayWeightKg('de-DE', 'metric', 82.4)).toBe('82,4');
      expect(formatDisplayWeightKg('pt-BR', 'metric', 82.4)).toBe('82,4');
    });

    it('converts to lb before formatting in imperial', () => {
      expect(formatDisplayWeightKg('en-US', 'imperial', 100)).toBe('220.5');
      expect(formatDisplayWeightKg('de-DE', 'imperial', 100)).toBe('220,5');
    });

    it('never emits a thousands separator (grouping is off app-wide)', () => {
      // A grouped "1.000" in de-DE would read as 1 kg to a German user.
      expect(formatDisplayWeightKg('de-DE', 'metric', 1000)).toBe('1000');
      expect(formatDisplayWeightKg('en-US', 'metric', 12345.6)).toBe('12345.6');
    });

    it('caps the output at one decimal place', () => {
      expect(formatDisplayWeightKg('en-US', 'metric', 82.4567)).toBe('82.5');
    });
  });

  describe('formatDisplayGrams', () => {
    it('shows grams verbatim in metric', () => {
      expect(formatDisplayGrams('en-US', 'metric', 150)).toBe('150');
      expect(formatDisplayGrams('de-DE', 'metric', 150)).toBe('150');
    });

    it('converts grams to oz in imperial, to one decimal', () => {
      // 100 g = 3.5274 oz
      expect(formatDisplayGrams('en-US', 'imperial', 100)).toBe('3.5');
      expect(formatDisplayGrams('de-DE', 'imperial', 100)).toBe('3,5');
    });

    it('drops the decimal when the converted mass is a whole number of ounces', () => {
      expect(formatDisplayGrams('en-US', 'imperial', G_PER_OZ)).toBe('1');
      expect(formatDisplayGrams('en-US', 'imperial', 0)).toBe('0');
    });

    it('never emits a thousands separator', () => {
      expect(formatDisplayGrams('en-US', 'metric', 1500)).toBe('1500');
      expect(formatDisplayGrams('de-DE', 'metric', 1234.5)).toBe('1234,5');
    });

    it('rounds a fractional gram amount to one decimal', () => {
      expect(formatDisplayGrams('en-US', 'metric', 12.34)).toBe('12.3');
      expect(formatDisplayGrams('en-US', 'metric', 12.36)).toBe('12.4');
    });
  });
});
