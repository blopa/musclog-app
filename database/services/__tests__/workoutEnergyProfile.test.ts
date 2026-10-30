import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { loadWorkoutEnergyProfile } from '@/database/services/workoutEnergyProfile';

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatestWeightKg: jest.fn(), getLatestHeightCm: jest.fn() },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));

const given = (user: object | null, weightKg: number | null, heightCm: number | null) => {
  (UserService.getCurrentUser as jest.Mock).mockResolvedValue(user);
  (UserMetricService.getLatestWeightKg as jest.Mock).mockResolvedValue(weightKg);
  (UserMetricService.getLatestHeightCm as jest.Mock).mockResolvedValue(heightCm);
};

describe('loadWorkoutEnergyProfile', () => {
  it('describes the user from the latest weight and height', async () => {
    given({ gender: 'female' }, 62, 168);

    expect(await loadWorkoutEnergyProfile()).toEqual({
      weightKg: 62,
      heightCm: 168,
      gender: 'female',
    });
  });

  it('falls back to an average height and to "other" when they are missing', async () => {
    given({ gender: undefined }, 70, null);

    expect(await loadWorkoutEnergyProfile()).toEqual({
      weightKg: 70,
      heightCm: 175,
      gender: 'other',
    });
  });

  it('is null without a user or a weight', async () => {
    given(null, 70, 170);
    expect(await loadWorkoutEnergyProfile()).toBeNull();

    given({ gender: 'male' }, null, 170);
    expect(await loadWorkoutEnergyProfile()).toBeNull();

    given({ gender: 'male' }, 0, 170);
    expect(await loadWorkoutEnergyProfile()).toBeNull();
  });
});
