import type { Gender } from '@/database/models/User';

import { getDefaultUsernameForGender } from '@/utils/usernameUtils';

const GENDERS: Gender[] = ['male', 'female', 'other'];
const NAMES = ['StrongLifter', 'PowerBuilder', 'IronAthlete'];
const USERNAME_PATTERN = /^(StrongLifter|PowerBuilder|IronAthlete)\d{4}$/;

describe('usernameUtils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(GENDERS)('produces a known name plus a 4-digit suffix for %s', (gender) => {
    for (let i = 0; i < 50; i += 1) {
      expect(getDefaultUsernameForGender(gender)).toMatch(USERNAME_PATTERN);
    }
  });

  it('keeps the suffix inside 1000-9999 so it is always exactly 4 digits', () => {
    // Math.floor(1000 + random * 9000) can never reach 10000, so the name is never
    // 5 digits and never collides with a 3-digit shape.
    for (let i = 0; i < 500; i += 1) {
      const username = getDefaultUsernameForGender('other');
      const suffix = Number(username.slice(-4));
      expect(suffix).toBeGreaterThanOrEqual(1000);
      expect(suffix).toBeLessThanOrEqual(9999);
    }
  });

  it('produces the lowest name/suffix at the bottom of the random range', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(getDefaultUsernameForGender('male')).toBe('StrongLifter1000');
  });

  it('produces the highest name/suffix at the top of the random range', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999999999);
    expect(getDefaultUsernameForGender('female')).toBe('IronAthlete9999');
  });

  it('gives every gender the same neutral name pool', () => {
    // The pools are intentionally identical today; a divergence should be a deliberate
    // product decision, not an accident.
    for (const name of NAMES) {
      const index = NAMES.indexOf(name);
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(index / NAMES.length)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(index / NAMES.length)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(index / NAMES.length)
        .mockReturnValueOnce(0);

      expect(getDefaultUsernameForGender('male')).toBe(`${name}1000`);
      expect(getDefaultUsernameForGender('female')).toBe(`${name}1000`);
      expect(getDefaultUsernameForGender('other')).toBe(`${name}1000`);
      jest.restoreAllMocks();
    }
  });

  it("falls back to the 'other' pool for an unrecognised gender instead of throwing", () => {
    expect(getDefaultUsernameForGender('non_binary' as Gender)).toMatch(USERNAME_PATTERN);
    expect(getDefaultUsernameForGender(undefined as unknown as Gender)).toMatch(USERNAME_PATTERN);
  });

  it('varies across calls (the suffix is what makes it unique)', () => {
    const generated = new Set(
      Array.from({ length: 200 }, () => getDefaultUsernameForGender('other'))
    );
    expect(generated.size).toBeGreaterThan(1);
  });
});
