import {
  ageForCalculations,
  ageInYears,
  asBirthday,
  ASSUMED_AGE,
  birthdayPickerDate,
  isUnderCloudAiAge,
  isUnderMinimumAppAge,
  MINIMUM_APP_AGE,
  MINIMUM_CLOUD_AI_AGE,
  MINIMUM_PLAUSIBLE_AGE,
} from '@/utils/ageGate';

const NOW = new Date(2026, 10, 27);
const born = (yearsAgo: number, dayOffset = 0) =>
  new Date(2026 - yearsAgo, 10, 27 + dayOffset).getTime();

describe('ageGate', () => {
  it('states the ages the Terms and the privacy policy state', () => {
    expect(MINIMUM_APP_AGE).toBe(16);
    expect(MINIMUM_CLOUD_AI_AGE).toBe(18);
  });

  it('assumes 30 for calculations and treats anything under 5 as a slip', () => {
    expect(ASSUMED_AGE).toBe(30);
    expect(MINIMUM_PLAUSIBLE_AGE).toBe(5);
  });

  describe('asBirthday', () => {
    it('gives no answer for null or undefined', () => {
      expect(asBirthday(null, NOW)).toBeNull();
      expect(asBirthday(undefined, NOW)).toBeNull();
    });

    it('gives no answer for an invalid date', () => {
      expect(asBirthday(new Date('not a date'), NOW)).toBeNull();
      expect(asBirthday(Number.NaN, NOW)).toBeNull();
    });

    it('gives no answer for today or a future date', () => {
      expect(asBirthday(new Date(NOW), NOW)).toBeNull();
      expect(asBirthday(new Date(2030, 0, 1), NOW)).toBeNull();
    });

    it('gives no answer for an age under 5, and keeps age 5', () => {
      expect(asBirthday(born(4), NOW)).toBeNull();
      expect(asBirthday(born(5), NOW)).toBe(born(5));
    });

    it('returns a Date or a number unchanged', () => {
      const date = new Date(born(30));

      expect(asBirthday(date, NOW)).toBe(date);
      expect(asBirthday(born(30), NOW)).toBe(born(30));
    });

    it('keeps a birthday under 16: the app tells the person, it does not block', () => {
      expect(asBirthday(born(12), NOW)).toBe(born(12));
    });

    it('accepts 1970 (timestamp 0) as a real birthday', () => {
      expect(asBirthday(0, NOW)).toBe(0);
    });
  });

  describe('ageForCalculations', () => {
    it('is the real age with a birthday', () => {
      expect(ageForCalculations(born(40), NOW)).toBe(40);
    });

    it('is the assumed age without a birthday', () => {
      expect(ageForCalculations(null, NOW)).toBe(ASSUMED_AGE);
      expect(ageForCalculations(undefined, NOW)).toBe(ASSUMED_AGE);
      expect(ageForCalculations(NOW, NOW)).toBe(ASSUMED_AGE);
    });
  });

  it('counts whole years, with the birthday itself counting', () => {
    expect(ageInYears(born(16), NOW)).toBe(16);
    expect(ageInYears(born(16, 1), NOW)).toBe(15);
  });

  it('lets a person in on their sixteenth birthday and not the day before', () => {
    expect(isUnderMinimumAppAge(born(16), NOW)).toBe(false);
    expect(isUnderMinimumAppAge(born(16, 1), NOW)).toBe(true);
  });

  it('opens an unanswered birthday calendar on a day that fails the age check', () => {
    const opened = birthdayPickerDate(null, new Date(2026, 10, 27, 15, 30));

    expect(opened).toEqual(NOW);
    expect(isUnderMinimumAppAge(opened, NOW)).toBe(true);
  });

  it('opens an answered birthday calendar on that answer', () => {
    const answer = new Date(born(30));

    expect(birthdayPickerDate(answer, NOW)).toBe(answer);
  });

  it('keeps cloud AI to adults', () => {
    expect(isUnderCloudAiAge(born(18), NOW)).toBe(false);
    expect(isUnderCloudAiAge(born(18, 1), NOW)).toBe(true);
    expect(isUnderCloudAiAge(born(40), NOW)).toBe(false);
  });

  it('treats a missing or unreadable birthday as unknown, not as under age', () => {
    expect(isUnderCloudAiAge(null, NOW)).toBe(false);
    expect(isUnderCloudAiAge(undefined, NOW)).toBe(false);
    expect(isUnderCloudAiAge(Number.NaN, NOW)).toBe(false);
  });
});
