import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { UserService } from '@/database/services/UserService';
import { enforceCloudAiAge, isCloudAiBlockedForAge } from '@/services/aiAccess';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(),
    set: jest.fn(),
    getUseMusclogFreeTier: jest.fn(),
    setUseMusclogFreeTier: jest.fn(),
  },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));

const mockUser = UserService.getCurrentUser as jest.Mock;
const yearsAgo = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - 1);

  return date.getTime();
};

beforeEach(() => {
  jest.clearAllMocks();
  (SettingsService.getUseMusclogFreeTier as jest.Mock).mockResolvedValue(true);
  (SettingsService.get as jest.Mock).mockResolvedValue(true);
});

describe('cloud AI for adults', () => {
  it('switches the free tier and Musclog Iron off for a 17-year-old', async () => {
    mockUser.mockResolvedValue({ dateOfBirth: yearsAgo(17) });

    await expect(isCloudAiBlockedForAge()).resolves.toBe(true);
    await enforceCloudAiAge();

    expect(SettingsService.setUseMusclogFreeTier).toHaveBeenCalledWith(false);
    expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.useHostedAi, false);
  });

  it('changes nothing for an adult, or when no profile exists yet', async () => {
    for (const user of [{ dateOfBirth: yearsAgo(30) }, null]) {
      mockUser.mockResolvedValue(user);
      await enforceCloudAiAge();
    }

    expect(SettingsService.setUseMusclogFreeTier).not.toHaveBeenCalled();
    expect(SettingsService.set).not.toHaveBeenCalled();
  });
});
