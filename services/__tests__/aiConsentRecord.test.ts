import { SettingsService } from '@/database/services/SettingsService';
import { recordAiConsent } from '@/services/aiConsentRecord';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn(), set: jest.fn() },
}));

// A store whose reads and writes take a tick, so two unqueued calls would both read the old map.
let stored: Record<string, unknown> = {};
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(() => {
  stored = {};
  (SettingsService.get as jest.Mock).mockImplementation(async () => {
    await tick();
    return stored;
  });
  (SettingsService.set as jest.Mock).mockImplementation(
    async (_setting: unknown, value: unknown) => {
      await tick();
      stored = value as Record<string, unknown>;
    }
  );
});

describe('recordAiConsent', () => {
  it('keeps both records when two providers are recorded at the same time', async () => {
    await Promise.all([recordAiConsent('openai'), recordAiConsent('claude')]);

    expect(Object.keys(stored).sort()).toEqual(['claude', 'openai']);
  });
});
