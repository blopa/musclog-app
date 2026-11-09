import { parseEnergyUnit } from '@/constants/settings';
import { SETTINGS } from '@/constants/settingDefinitions';

import {
  displayToEnergyKcal,
  energyKcalAfterEdit,
  energyToDisplay,
  formatEnergyAmount,
  kcalToKj,
  kjToKcal,
} from '../energyUnit';

describe('energy unit', () => {
  it('converts with the thermochemical calorie', () => {
    expect(kcalToKj(1)).toBeCloseTo(4.184, 6);
    expect(kcalToKj(2000)).toBeCloseTo(8368, 6);
    expect(kjToKcal(8368)).toBeCloseTo(2000, 6);
  });

  it('leaves kilocalories untouched', () => {
    expect(energyToDisplay(1850, 'kcal')).toBe(1850);
    expect(displayToEnergyKcal(1850, 'kcal')).toBe(1850);
  });

  it('formats a rounded whole-number amount, ungrouped like every other kcal count', () => {
    expect(formatEnergyAmount('en-US', 2000, 'kj')).toBe('8368');
    expect(formatEnergyAmount('en-US', 2000, 'kcal')).toBe('2000');
    expect(formatEnergyAmount('de-DE', 2000, 'kj')).toBe('8368');
    expect(formatEnergyAmount('en-US', 0.4, 'kcal')).toBe('0');
  });

  it('does not drift a stored value that was only displayed and saved again', () => {
    // 1913 kcal shows as 8,004 kJ; typing nothing must keep 1913, not 8004 / 4.184 = 1913.0 ± 1.
    for (let kcal = 800; kcal <= 6000; kcal += 1) {
      const shown = Math.round(energyToDisplay(kcal, 'kj'));
      expect(energyKcalAfterEdit(kcal, shown, 'kj')).toBe(kcal);
    }
  });

  it('converts a changed entry back to whole kilocalories', () => {
    expect(energyKcalAfterEdit(2000, 9000, 'kj')).toBe(2151);
    expect(energyKcalAfterEdit(2000, 2100, 'kcal')).toBe(2100);
  });
});

describe('energyUnit setting', () => {
  it('defaults to kilocalories and ignores unknown stored values', () => {
    expect(SETTINGS.energyUnit.defaultValue).toBe('kcal');
    expect(parseEnergyUnit('kj')).toBe('kj');
    expect(parseEnergyUnit('kcal')).toBe('kcal');
    expect(parseEnergyUnit('joule')).toBe('kcal');
    expect(parseEnergyUnit(null)).toBe('kcal');
    expect(parseEnergyUnit(undefined)).toBe('kcal');
    expect(SETTINGS.energyUnit.parse('kj')).toBe('kj');
    expect(SETTINGS.energyUnit.serialize('kj')).toBe('kj');
  });
});
