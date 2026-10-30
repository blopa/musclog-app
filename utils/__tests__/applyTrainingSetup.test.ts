import { SETTINGS } from '@/constants/settingDefinitions';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { type ComebackState, parseComebackState } from '@/utils/comeback/comebackState';
import { applyTrainingSetup } from '@/utils/applyTrainingSetup';

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock('@/utils/calendarDate', () => ({ localDayStartMs: () => 1_700_000_000_000 }));
jest.mock('@/database/services/GymService', () => ({
  GymService: { getGyms: jest.fn(), createGym: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { set: jest.fn(), getUnits: jest.fn(), updateComebackState: jest.fn() },
}));

const gyms = GymService as jest.Mocked<typeof GymService>;
const settings = SettingsService as jest.Mocked<typeof SettingsService>;

describe('applyTrainingSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gyms.getGyms.mockResolvedValue([]);
    settings.getUnits.mockResolvedValue('metric');
  });

  it('saves the load-suggestion choice and creates an active gym', async () => {
    await applyTrainingSetup({ location: 'gym', daysPerWeek: 3, autonomy: 'manual' });

    expect(settings.set).toHaveBeenCalledWith(SETTINGS.workoutAutonomy, 'manual');
    expect(gyms.createGym).toHaveBeenCalledTimes(1);
    const [input, options] = gyms.createGym.mock.calls[0];
    expect(options).toEqual({ makeActive: true });
    expect(input.name).toBe('onboarding.trainingSetup.gymNames.gym');
    expect(input.equipment).toContain('barbell');
    expect(input.barWeightKg).toBe(20);
    expect(input.plates.length).toBeGreaterThan(0);
    expect(input.weightUnit).toBeNull();
  });

  it('gives a minimal profile no bar or plates', async () => {
    await applyTrainingSetup({ location: 'minimal', daysPerWeek: 2, autonomy: 'suggest' });

    const [input] = gyms.createGym.mock.calls[0];
    expect(input.barWeightKg).toBe(0);
    expect(input.plates).toEqual([]);
    expect(input.equipment).not.toContain('barbell');
  });

  it('does not stack a second gym when the user already has one', async () => {
    gyms.getGyms.mockResolvedValue([{ id: 'g1' } as never]);

    await applyTrainingSetup({ location: 'gym', daysPerWeek: 3, autonomy: 'suggest' });

    expect(settings.set).toHaveBeenCalledWith(SETTINGS.workoutAutonomy, 'suggest');
    expect(gyms.createGym).not.toHaveBeenCalled();
  });

  describe('when the person is coming back', () => {
    const setup = {
      location: 'home' as const,
      daysPerWeek: 5,
      autonomy: 'suggest' as const,
      comingBack: { breakLength: '3to6m' as const },
    };
    const run = async (current: ComebackState) => {
      await applyTrainingSetup(setup);
      const updater = settings.updateComebackState.mock.calls[0][0] as (
        state: ComebackState
      ) => ComebackState;
      return updater(current);
    };

    it('starts comeback mode with no baseline, so no load is scaled', async () => {
      const state = await run(parseComebackState(null));
      expect(state).toMatchObject({
        status: 'active',
        track: 'both',
        baseBefore: null,
        answers: { breakLength: '3to6m', location: 'home', daysPerWeek: 4 },
      });
      expect(state.startedAt).toBe(1_700_000_000_000);
    });

    it('leaves a comeback that is already running alone', async () => {
      const running = { ...parseComebackState(null), status: 'active' as const, startedAt: 1 };
      expect(await run(running)).toBe(running);
    });

    it('starts nothing for someone who did not say so', async () => {
      await applyTrainingSetup({ location: 'gym', daysPerWeek: 3, autonomy: 'suggest' });
      expect(settings.updateComebackState).not.toHaveBeenCalled();
    });
  });
});
