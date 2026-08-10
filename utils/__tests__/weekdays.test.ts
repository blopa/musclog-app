import {
  dayNameToIndex,
  indexToDayName,
  jsDayToWeekdayIndex,
  toExpoWeekday,
  WEEKDAY_NAMES,
} from '@/utils/weekdays';

describe('utils/weekdays', () => {
  describe('WEEKDAY_NAMES', () => {
    it('should have 7 elements', () => {
      expect(WEEKDAY_NAMES).toHaveLength(7);
    });

    it('should have correct day names', () => {
      expect(WEEKDAY_NAMES).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]);
    });
  });

  describe('dayNameToIndex', () => {
    it('should return correct index for valid day names', () => {
      expect(dayNameToIndex('Monday')).toBe(0);
      expect(dayNameToIndex('Tuesday')).toBe(1);
      expect(dayNameToIndex('Wednesday')).toBe(2);
      expect(dayNameToIndex('Thursday')).toBe(3);
      expect(dayNameToIndex('Friday')).toBe(4);
      expect(dayNameToIndex('Saturday')).toBe(5);
      expect(dayNameToIndex('Sunday')).toBe(6);
    });

    it('should be case-sensitive', () => {
      expect(dayNameToIndex('monday')).toBe(-1);
      expect(dayNameToIndex('MONDAY')).toBe(-1);
      expect(dayNameToIndex('Monday')).toBe(0);
    });

    it('should return -1 for invalid day name', () => {
      expect(dayNameToIndex('InvalidDay')).toBe(-1);
    });

    it('should return -1 for empty string', () => {
      expect(dayNameToIndex('')).toBe(-1);
    });

    it('should return -1 for partial match', () => {
      expect(dayNameToIndex('Mon')).toBe(-1);
    });
  });

  describe('indexToDayName', () => {
    it('should return correct day name for valid indices', () => {
      expect(indexToDayName(0)).toBe('Monday');
      expect(indexToDayName(1)).toBe('Tuesday');
      expect(indexToDayName(2)).toBe('Wednesday');
      expect(indexToDayName(3)).toBe('Thursday');
      expect(indexToDayName(4)).toBe('Friday');
      expect(indexToDayName(5)).toBe('Saturday');
      expect(indexToDayName(6)).toBe('Sunday');
    });

    it('should return Monday (fallback) for negative index', () => {
      expect(indexToDayName(-1)).toBe('Monday');
      expect(indexToDayName(-10)).toBe('Monday');
    });

    it('should return Monday (fallback) for index too large', () => {
      expect(indexToDayName(7)).toBe('Monday');
      expect(indexToDayName(10)).toBe('Monday');
      expect(indexToDayName(100)).toBe('Monday');
    });

    it('should handle -0', () => {
      expect(indexToDayName(-0)).toBe('Monday');
    });

    it('should handle decimal indices', () => {
      expect(indexToDayName(0.5)).toBe('Monday');
      expect(indexToDayName(1.9)).toBe('Monday');
    });
  });

  describe('toExpoWeekday', () => {
    // Expo's WEEKLY trigger is 1 = Sunday … 7 = Saturday, which is neither our Monday-first
    // index nor JS `getDay`. Getting this wrong shifts every workout reminder by a day.
    it('maps a Monday-first index onto Expo weekdays', () => {
      expect(WEEKDAY_NAMES.map((_, index) => toExpoWeekday(index))).toEqual([2, 3, 4, 5, 6, 7, 1]);
    });
  });

  describe('jsDayToWeekdayIndex', () => {
    it('maps JS getDay onto a Monday-first index', () => {
      // JS: 0 = Sunday … 6 = Saturday.
      expect([0, 1, 2, 3, 4, 5, 6].map(jsDayToWeekdayIndex)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    });

    it('round-trips through indexToDayName', () => {
      // A Sunday `Date` must resolve to the 'Sunday' schedule row, not Saturday's.
      expect(indexToDayName(jsDayToWeekdayIndex(0))).toBe('Sunday');
      expect(indexToDayName(jsDayToWeekdayIndex(1))).toBe('Monday');
    });
  });
});
