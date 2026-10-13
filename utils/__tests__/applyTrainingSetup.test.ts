import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { applyTrainingSetup } from '@/utils/applyTrainingSetup';

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock('@/database/services/GymService', () => ({
  GymService: { getGyms: jest.fn(), createGym: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { setWorkoutAutonomy: jest.fn(), getUnits: jest.fn() },
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

    expect(settings.setWorkoutAutonomy).toHaveBeenCalledWith('manual');
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

    expect(settings.setWorkoutAutonomy).toHaveBeenCalledWith('suggest');
    expect(gyms.createGym).not.toHaveBeenCalled();
  });
});
