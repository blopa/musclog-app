import { SettingsService, UserMetricService, UserService } from '@/database/services';
import type { FitnessDetails } from '@/types/fitnessDetails';
import {
  defaultAdultDobDisplayString,
  defaultAdultDobLocalDayStartMs,
  formatDateOfBirthFromTimestamp,
  loadFitnessDetailsInitialData,
  parseDobDisplayStringToPickerDate,
  parseDobStringToLocalDayStartMs,
  parseMmDdYyyyDateOfBirthToLocalDayStartMs,
  persistFitnessDetails,
} from '@/utils/fitnessProfilePersistence';

jest.mock('@/database/services', () => ({
  SettingsService: { setUnits: jest.fn() },
  UserMetricService: {
    createMetric: jest.fn(),
    getLatest: jest.fn(),
    getMetricsHistory: jest.fn(),
    updateMetric: jest.fn(),
  },
  UserService: { getCurrentUser: jest.fn(), initializeUser: jest.fn() },
}));

const mockGetCurrentUser = UserService.getCurrentUser as jest.MockedFunction<any>;
const mockInitializeUser = UserService.initializeUser as jest.MockedFunction<any>;
const mockGetLatest = UserMetricService.getLatest as jest.MockedFunction<any>;
const mockGetMetricsHistory = UserMetricService.getMetricsHistory as jest.MockedFunction<any>;
const mockCreateMetric = UserMetricService.createMetric as jest.MockedFunction<any>;
const mockUpdateMetric = UserMetricService.updateMetric as jest.MockedFunction<any>;
const mockSetUnits = SettingsService.setUnits as jest.MockedFunction<any>;

const metric = (value: number, unit: string) => ({
  getDecrypted: jest.fn(async () => ({ value, unit })),
});

const details = (overrides: Partial<FitnessDetails> = {}): FitnessDetails => ({
  dob: '1990-06-15',
  units: 'metric',
  weight: '80',
  height: '180',
  weightGoal: 'maintain',
  fitnessGoal: 'general',
  activityLevel: 2,
  gender: 'male',
  experience: 'intermediate',
  ...(overrides as any),
});

describe('date-of-birth parsing and formatting', () => {
  it('formats a stored timestamp with the requested locale', () => {
    const ms = new Date(1990, 5, 15).getTime();

    expect(formatDateOfBirthFromTimestamp(ms, 'en-US')).toBe('6/15/1990');
    expect(formatDateOfBirthFromTimestamp(ms, 'de-DE')).toBe('15.6.1990');
  });

  it('parses the unambiguous yyyy-MM-dd form to local midnight', () => {
    const ms = parseDobStringToLocalDayStartMs('1990-06-15');
    const parsed = new Date(ms);

    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual([1990, 5, 15]);
    expect(parsed.getHours()).toBe(0);
  });

  // Legacy stored values are US-ordered; parsing them as ISO would silently shift the DOB.
  it('parses the legacy MM/DD/YYYY form to local midnight', () => {
    const parsed = new Date(parseDobStringToLocalDayStartMs('06/15/1990'));

    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual([1990, 5, 15]);
    expect(parsed.getHours()).toBe(0);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDobStringToLocalDayStartMs('  1990-06-15  ')).toBe(
      parseDobStringToLocalDayStartMs('1990-06-15')
    );
  });

  it('throws a explanatory error for a malformed date', () => {
    expect(() => parseMmDdYyyyDateOfBirthToLocalDayStartMs('15-06-1990')).toThrow(
      'Invalid date format. Please use MM/DD/YYYY'
    );
    expect(() => parseDobStringToLocalDayStartMs('')).toThrow('Invalid date format');
  });

  describe('parseDobDisplayStringToPickerDate', () => {
    it('accepts both the ISO and the legacy US form', () => {
      const iso = parseDobDisplayStringToPickerDate('1990-06-15');
      const us = parseDobDisplayStringToPickerDate('06/15/1990');

      expect(iso.getTime()).toBe(us.getTime());
      expect(iso.getHours()).toBe(0);
    });

    // The picker must always get a usable Date; an empty or unrecognised string falls back to
    // today rather than an Invalid Date that would blank the control.
    it('falls back to today (local midnight) for empty or unrecognised input', () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      expect(parseDobDisplayStringToPickerDate('').getTime()).toBe(todayStart.getTime());
      expect(parseDobDisplayStringToPickerDate('   ').getTime()).toBe(todayStart.getTime());
      expect(parseDobDisplayStringToPickerDate('nonsense').getTime()).toBe(todayStart.getTime());
    });
  });

  describe('default adult DOB', () => {
    it('defaults to local midnight 25 years ago', () => {
      const parsed = new Date(defaultAdultDobLocalDayStartMs());
      const now = new Date();

      expect(parsed.getFullYear()).toBe(now.getFullYear() - 25);
      expect(parsed.getHours()).toBe(0);
    });

    it('honours an explicit age and renders it through the same formatter', () => {
      expect(defaultAdultDobDisplayString(30, 'en-US')).toBe(
        formatDateOfBirthFromTimestamp(defaultAdultDobLocalDayStartMs(30), 'en-US')
      );
      expect(new Date(defaultAdultDobLocalDayStartMs(30)).getFullYear()).toBe(
        new Date().getFullYear() - 30
      );
    });
  });
});

describe('loadFitnessDetailsInitialData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLatest.mockResolvedValue(null);
  });

  it('falls back to 70 kg / 170 cm and a neutral profile when there is no user or metrics', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(loadFitnessDetailsInitialData('metric')).resolves.toEqual({
      dob: '',
      units: 'metric',
      weight: '70',
      height: '170',
      fatPercentage: undefined,
      weightGoal: 'maintain',
      fitnessGoal: 'general',
      activityLevel: 2,
      gender: 'other',
      experience: 'intermediate',
    });
  });

  // Metrics are stored in metric units; the form must show them in the user's chosen system.
  it('converts stored metric values into the requested display units', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetLatest.mockImplementation(async (type: string) => {
      if (type === 'weight') return metric(80, 'kg');
      if (type === 'height') return metric(180, 'cm');
      return metric(18, '%');
    });

    const metricUnits = await loadFitnessDetailsInitialData('metric');
    expect(metricUnits.weight).toBe('80');
    expect(metricUnits.height).toBe('180');
    expect(metricUnits.fatPercentage).toBe(18);

    const imperial = await loadFitnessDetailsInitialData('imperial');
    expect(Number(imperial.weight)).toBeCloseTo(176.4, 1);
    expect(Number(imperial.height)).toBeCloseTo(70.87, 1);
  });

  // Legacy rows can carry a non-canonical stored unit; they must be normalised before display,
  // otherwise a lbs-stored weight would be shown as if it were kg.
  it('normalizes legacy lbs/in stored units before converting for display', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetLatest.mockImplementation(async (type: string) => {
      if (type === 'weight') return metric(176.37, 'lbs');
      if (type === 'height') return metric(70.87, 'in');
      return null;
    });

    const result = await loadFitnessDetailsInitialData('metric');

    expect(Number(result.weight)).toBeCloseTo(80, 1);
    expect(Number(result.height)).toBeCloseTo(180, 1);
  });

  it('reads the profile fields from the current user and formats the DOB with the locale', async () => {
    mockGetCurrentUser.mockResolvedValue({
      dateOfBirth: new Date(1990, 5, 15).getTime(),
      getAge: () => 36,
      gender: 'female',
      fitnessGoal: 'strength',
      weightGoal: 'lose',
      activityLevel: 4,
      liftingExperience: 'advanced',
    });

    const result = await loadFitnessDetailsInitialData('metric', 'de-DE');

    expect(result.dob).toBe('15.6.1990');
    expect(result.gender).toBe('female');
    expect(result.fitnessGoal).toBe('strength');
    expect(result.weightGoal).toBe('lose');
    expect(result.activityLevel).toBe(4);
    expect(result.experience).toBe('advanced');
  });

  // A user record with no real DOB reports age 0; showing "1/1/1970" would look like real data.
  it('leaves the DOB blank when the user has no usable date of birth', async () => {
    mockGetCurrentUser.mockResolvedValue({
      dateOfBirth: 0,
      getAge: () => 0,
      gender: 'other',
      fitnessGoal: 'general',
    });

    await expect(loadFitnessDetailsInitialData('metric')).resolves.toMatchObject({ dob: '' });
  });

  it('defaults a user’s missing weightGoal / activityLevel / experience', async () => {
    mockGetCurrentUser.mockResolvedValue({
      dateOfBirth: new Date(1990, 5, 15).getTime(),
      getAge: () => 36,
      gender: 'male',
      fitnessGoal: 'general',
      weightGoal: null,
      activityLevel: null,
      liftingExperience: null,
    });

    await expect(loadFitnessDetailsInitialData('metric')).resolves.toMatchObject({
      weightGoal: 'maintain',
      activityLevel: 2,
      experience: 'intermediate',
    });
  });
});

describe('persistFitnessDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMetricsHistory.mockResolvedValue([]);
    mockGetCurrentUser.mockResolvedValue({ updateProfile: jest.fn() });
    mockInitializeUser.mockResolvedValue({ updateProfile: jest.fn() });
  });

  it('updates an existing user’s profile rather than creating a second one', async () => {
    const updateProfile = jest.fn();
    mockGetCurrentUser.mockResolvedValue({ updateProfile });

    await persistFitnessDetails(details());

    expect(mockInitializeUser).not.toHaveBeenCalled();
    expect(updateProfile).toHaveBeenCalledWith({
      dateOfBirth: parseDobStringToLocalDayStartMs('1990-06-15'),
      gender: 'male',
      fitnessGoal: 'general',
      weightGoal: 'maintain',
      activityLevel: 2,
      liftingExperience: 'intermediate',
    });
  });

  // Omitting the key (rather than sending undefined) is what stops an empty DOB field from
  // wiping a date of birth the user already has.
  it('omits dateOfBirth entirely when the DOB field is blank', async () => {
    const updateProfile = jest.fn();
    mockGetCurrentUser.mockResolvedValue({ updateProfile });

    await persistFitnessDetails(details({ dob: '   ' }));

    expect(updateProfile).toHaveBeenCalledWith(
      expect.not.objectContaining({ dateOfBirth: expect.anything() })
    );
  });

  it('creates a user with a generated name and a default adult DOB when none exists', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await persistFitnessDetails(details({ dob: '' }));

    expect(mockInitializeUser).toHaveBeenCalledTimes(1);
    const arg = mockInitializeUser.mock.calls[0][0];
    expect(arg.fullName).toEqual(expect.any(String));
    expect(arg.fullName.length).toBeGreaterThan(0);
    expect(new Date(arg.dateOfBirth).getFullYear()).toBe(new Date().getFullYear() - 25);
    expect(arg.gender).toBe('male');
  });

  // The DB always stores metric; an imperial form entry must be converted on the way in.
  it('converts imperial input to kg / cm before storing', async () => {
    await persistFitnessDetails(
      details({ units: 'imperial', weight: '176.37', height: '70.87', fatPercentage: 18 })
    );

    const created = mockCreateMetric.mock.calls.map(([arg]: any[]) => arg);
    const weight = created.find((m: any) => m.type === 'weight');
    const height = created.find((m: any) => m.type === 'height');

    expect(weight.unit).toBe('kg');
    expect(weight.value).toBeCloseTo(80, 1);
    expect(height.unit).toBe('cm');
    expect(height.value).toBeCloseTo(180, 1);
    // Body fat is a percentage, so it is unit-system independent and stored verbatim.
    expect(created.find((m: any) => m.type === 'body_fat')).toMatchObject({ value: 18, unit: '%' });
  });

  // One metric row per day: re-saving the profile the same day must overwrite, not append,
  // or the weight chart grows a spike of duplicate points.
  it('updates today’s existing metric row instead of creating a duplicate', async () => {
    mockGetMetricsHistory.mockImplementation(async (type: string) =>
      type === 'weight' ? [{ id: 'metric-1' }] : []
    );

    await persistFitnessDetails(details({ fatPercentage: 20 }));

    expect(mockUpdateMetric).toHaveBeenCalledWith('metric-1', {
      value: 80,
      unit: 'kg',
      date: expect.any(Number),
    });
    expect(mockCreateMetric.mock.calls.map(([m]: any[]) => m.type)).toEqual(['height', 'body_fat']);
  });

  it('looks for the existing row within today’s local day only', async () => {
    await persistFitnessDetails(details());

    const [, range] = mockGetMetricsHistory.mock.calls[0];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    expect(range.startDate).toBe(dayStart.getTime());
    expect(range.endDate).toBe(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  });

  it('skips metrics that are blank or non-positive', async () => {
    await persistFitnessDetails(
      details({ weight: '', height: '0', fatPercentage: 0 } as Partial<FitnessDetails>)
    );

    expect(mockCreateMetric).not.toHaveBeenCalled();
    expect(mockUpdateMetric).not.toHaveBeenCalled();
  });

  it('stamps new metrics with the current timezone so day keys can be re-derived', async () => {
    await persistFitnessDetails(details());

    for (const [arg] of mockCreateMetric.mock.calls as any[][]) {
      expect(typeof arg.timezone).toBe('string');
      expect(arg.timezone.length).toBeGreaterThan(0);
    }
  });

  it('persists the chosen unit system last so the form and settings agree', async () => {
    await persistFitnessDetails(details({ units: 'imperial' }));

    expect(mockSetUnits).toHaveBeenCalledWith('imperial');
  });
});
