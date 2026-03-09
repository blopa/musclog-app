import { MenstrualService } from '../MenstrualService';
import MenstrualCycle from '../../models/MenstrualCycle';

describe('MenstrualService', () => {
  const mockCycle = {
    lastPeriodStartDate: new Date('2024-01-01').getTime(),
    avgCycleLength: 28,
    avgPeriodDuration: 5,
    syncGoal: 'performance',
  } as unknown as MenstrualCycle;

  describe('getCycleDay', () => {
    it('should return 1 on the start date', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01'));
      expect(MenstrualService.getCycleDay(mockCycle)).toBe(1);
    });

    it('should return 15 for mid-cycle', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-15'));
      expect(MenstrualService.getCycleDay(mockCycle)).toBe(15);
    });

    it('should wrap around the cycle length', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-29'));
      expect(MenstrualService.getCycleDay(mockCycle)).toBe(1);
    });
  });

  describe('calculateCurrentPhase', () => {
    it('should return menstrual for day 1-5', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-03'));
      expect(MenstrualService.calculateCurrentPhase(mockCycle)).toBe('menstrual');
    });

    it('should return follicular for day 6-13', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-10'));
      expect(MenstrualService.calculateCurrentPhase(mockCycle)).toBe('follicular');
    });

    it('should return ovulation for day 14-16', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-14'));
      expect(MenstrualService.calculateCurrentPhase(mockCycle)).toBe('ovulation');
    });

    it('should return luteal for day 17-28', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-20'));
      expect(MenstrualService.calculateCurrentPhase(mockCycle)).toBe('luteal');
    });
  });

  describe('getEnergyLevel', () => {
    it('should return low for menstrual', () => {
      expect(MenstrualService.getEnergyLevel('menstrual')).toBe('low');
    });

    it('should return peak for ovulation', () => {
      expect(MenstrualService.getEnergyLevel('ovulation')).toBe('peak');
    });
  });

  describe('getIntensityMultiplier', () => {
    it('should return higher multiplier for ovulation with performance goal', () => {
      expect(MenstrualService.getIntensityMultiplier('ovulation', 'performance')).toBe(1.15);
    });

    it('should return lower multiplier for menstrual with symptoms goal', () => {
      expect(MenstrualService.getIntensityMultiplier('menstrual', 'symptoms')).toBe(0.75);
    });
  });
});
