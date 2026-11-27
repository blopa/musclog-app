import {
  ageInYears,
  isUnderCloudAiAge,
  isUnderMinimumAppAge,
  MINIMUM_APP_AGE,
  MINIMUM_CLOUD_AI_AGE,
} from '@/utils/ageGate';

const NOW = new Date(2026, 10, 27);
const born = (yearsAgo: number, dayOffset = 0) =>
  new Date(2026 - yearsAgo, 10, 27 + dayOffset).getTime();

describe('ageGate', () => {
  it('states the ages the Terms and the privacy policy state', () => {
    expect(MINIMUM_APP_AGE).toBe(16);
    expect(MINIMUM_CLOUD_AI_AGE).toBe(18);
  });

  it('counts whole years, with the birthday itself counting', () => {
    expect(ageInYears(born(16), NOW)).toBe(16);
    expect(ageInYears(born(16, 1), NOW)).toBe(15);
  });

  it('lets a person in on their sixteenth birthday and not the day before', () => {
    expect(isUnderMinimumAppAge(born(16), NOW)).toBe(false);
    expect(isUnderMinimumAppAge(born(16, 1), NOW)).toBe(true);
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
