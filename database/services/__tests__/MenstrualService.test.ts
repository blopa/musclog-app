import PeriodLog from '@/database/models/PeriodLog';
import { MenstrualService } from '@/database/services/MenstrualService';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

const makePeriodLog = (startDate: number, endDate: number | null = null): PeriodLog => {
  const log = {
    startDate,
    endDate,
    deletedAt: null,
    get isActive() {
      return this.endDate == null && this.deletedAt == null;
    },
    getDurationDays() {
      if (this.endDate == null) return null;
      return Math.max(1, Math.round((this.endDate - this.startDate) / MS_PER_SOLAR_DAY) + 1);
    },
  } as unknown as PeriodLog;
  return log;
};

describe('MenstrualService', () => {
  const periodStart = new Date('2024-01-01').getTime();
  const periodEnd = new Date('2024-01-05').getTime();
  const mockLogs = [makePeriodLog(periodStart, periodEnd)];
  const mockStats = MenstrualService.calculateCycleStats(mockLogs);

  describe('getCycleDay', () => {
    it('should return 1 on the start date', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01'));
      expect(MenstrualService.getCycleDay(mockLogs, mockStats)).toBe(1);
    });

    it('should return 15 for mid-cycle', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-15'));
      expect(MenstrualService.getCycleDay(mockLogs, mockStats)).toBe(15);
    });

    it('should wrap around the cycle length', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-29'));
      expect(MenstrualService.getCycleDay(mockLogs, mockStats)).toBe(1);
    });

    it('should return null when no logs exist', () => {
      expect(MenstrualService.getCycleDay([], MenstrualService.calculateCycleStats([]))).toBeNull();
    });
  });

  describe('calculateCurrentPhase', () => {
    it('should return menstrual while period is active', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-03'));
      expect(MenstrualService.calculateCurrentPhase(mockLogs, mockStats)).toBe('menstrual');
    });

    it('should keep the period active through the full logged end day', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-05T23:59:00'));
      expect(MenstrualService.calculateCurrentPhase(mockLogs, mockStats)).toBe('menstrual');
    });

    it('should return follicular after period ends, before ovulation', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-10'));
      expect(MenstrualService.calculateCurrentPhase(mockLogs, mockStats)).toBe('follicular');
    });

    it('should return ovulation around the ovulation window', () => {
      // Ovulation ≈ next period (Jan 29) − 14 days = Jan 15
      jest.useFakeTimers().setSystemTime(new Date('2024-01-15'));
      expect(MenstrualService.calculateCurrentPhase(mockLogs, mockStats)).toBe('ovulation');
    });

    it('should return luteal after ovulation window', () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-20'));
      expect(MenstrualService.calculateCurrentPhase(mockLogs, mockStats)).toBe('luteal');
    });

    it('should return null when no logs exist', () => {
      expect(
        MenstrualService.calculateCurrentPhase([], MenstrualService.calculateCycleStats([]))
      ).toBeNull();
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

  describe('calculateCycleStats', () => {
    it('should return confidence none for empty logs', () => {
      expect(MenstrualService.calculateCycleStats([]).confidence).toBe('none');
    });

    it('should return confidence low for a single log', () => {
      expect(MenstrualService.calculateCycleStats([makePeriodLog(periodStart)]).confidence).toBe(
        'low'
      );
    });
  });
});
