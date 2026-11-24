import { type CoachAIConfig, sendCoachMessage } from '../coachAI';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock });
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../prompts', () => ({
  getNutritionInsightsPrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getChatMessagePromptContent: jest.fn().mockResolvedValue('SYSTEM'),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getUseThinkingMode: jest.fn().mockResolvedValue(false) },
}));

const reply = { choices: [{ message: { content: '{"msg4User":"hi","remember_me":""}' } }] };

const config = (provider: 'local' | 'openai'): CoachAIConfig => ({
  provider,
  model: 'm',
  apiKey: 'k',
  baseUrl: 'http://localhost:1234/v1',
  language: 'en-US',
});

// Alternating turns, oldest first.
const history = Array.from({ length: 10 }, (_, i) => ({
  role: i % 2 === 0 ? ('user' as const) : ('coach' as const),
  content: `turn ${i}`,
  at: 1_700_000_000_000 + i * 1000,
}));

describe('local chat request', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply);
  });

  it('penalises repetition and sends only the latest turns', async () => {
    await sendCoachMessage(config('local'), history, 'thanks');

    const body = mockCreate.mock.calls[0][0];
    expect(body.frequency_penalty).toBeGreaterThan(0);
    expect(body.presence_penalty).toBeGreaterThan(0);
    // system + 6 history turns + the new message
    expect(body.messages).toHaveLength(8);
    expect(body.messages[1].content).toContain('turn 4');
    expect(body.messages.at(-1).content).toContain('thanks');
  });

  it('leaves other OpenAI-protocol providers alone', async () => {
    await sendCoachMessage(config('openai'), history, 'thanks');

    const body = mockCreate.mock.calls[0][0];
    expect(body.frequency_penalty).toBeUndefined();
    expect(body.presence_penalty).toBeUndefined();
    expect(body.messages).toHaveLength(12);
  });
});
