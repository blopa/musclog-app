import { UserMetricService } from '@/database/services/UserMetricService';

import { loadDayMood, saveDayMood } from '../dayMood';

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: {
    getMetricsHistory: jest.fn(),
    createMetric: jest.fn().mockResolvedValue(undefined),
    updateMetric: jest.fn().mockResolvedValue(undefined),
  },
}));

const day = new Date(2024, 5, 3);

describe('day mood', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the existing mood metric for the day', async () => {
    (UserMetricService.getMetricsHistory as jest.Mock).mockResolvedValue([
      { id: 'm1', getDecrypted: async () => ({ value: 3 }) },
    ]);
    expect(await loadDayMood(day)).toEqual({ id: 'm1', value: 3 });
  });

  it('returns null when nothing was logged', async () => {
    (UserMetricService.getMetricsHistory as jest.Mock).mockResolvedValue([]);
    expect(await loadDayMood(day)).toBeNull();
  });

  it('updates the existing metric instead of creating a second one', async () => {
    await saveDayMood(day, 4, 'm1');
    expect(UserMetricService.updateMetric).toHaveBeenCalledTimes(1);
    expect(UserMetricService.createMetric).not.toHaveBeenCalled();
  });

  it('creates a mood metric when there is none', async () => {
    await saveDayMood(day, 2, null);
    expect(UserMetricService.createMetric).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mood', value: 2 })
    );
  });
});
