import { runOnboardingTurn } from '@/services/aiOnboardingTurn';
import { AiService } from '@/services/AiService';
import { sendStructuredChatTurn } from '@/utils/structuredChat';

jest.mock('@/services/AiService', () => ({ AiService: { getAiConfigForProvider: jest.fn() } }));
jest.mock('@/utils/structuredChat', () => ({ sendStructuredChatTurn: jest.fn() }));

const mockConfig = AiService.getAiConfigForProvider as jest.Mock;
const mockSend = sendStructuredChatTurn as jest.Mock;

const reply = (text: string, patch: Record<string, unknown> = {}, extra = {}) => ({
  kind: 'ok' as const,
  value: { reply: text, patch, askedFields: [], readyForReview: false, ...extra },
});
const input = (overrides = {}) => ({
  provider: 'gemini' as const,
  mode: 'onboarding' as const,
  answers: {},
  rejected: [],
  history: [],
  message: 'I am a woman',
  signal: new AbortController().signal,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.mockResolvedValue({ provider: 'gemini', model: 'm', apiKey: 'k', language: 'en-US' });
});

describe('runOnboardingTurn', () => {
  it('folds what the reply learned into the answers it was given', async () => {
    mockSend.mockResolvedValue(
      reply('How tall are you?', { gender: 'female' }, { askedFields: ['heightCm'] })
    );

    const outcome = await runOnboardingTurn(input({ answers: { units: 'metric' } }));

    expect(outcome).toMatchObject({
      kind: 'reply',
      reply: 'How tall are you?',
      answers: { units: 'metric', gender: 'female' },
      askedFields: ['heightCm'],
      readyForReview: false,
    });
  });

  it('reports an unavailable provider without calling the model', async () => {
    mockConfig.mockResolvedValue(null);

    expect(await runOnboardingTurn(input())).toEqual({ kind: 'unavailable' });
    expect(await runOnboardingTurn(input({ provider: null }))).toEqual({ kind: 'unavailable' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('asks once more, with a repair note, when the first reply cannot be read', async () => {
    mockSend
      .mockResolvedValueOnce({ kind: 'malformed', raw: 'oops' })
      .mockResolvedValueOnce(reply('Sorry, again: what is your height?'));

    const outcome = await runOnboardingTurn(input());

    expect(outcome).toMatchObject({ kind: 'reply', reply: 'Sorry, again: what is your height?' });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[0][1].systemPrompt).not.toContain('could not be read');
    expect(mockSend.mock.calls[1][1].systemPrompt).toContain('could not be read');
  });

  it('gives up as malformed after the second unreadable reply', async () => {
    mockSend.mockResolvedValue({ kind: 'malformed', raw: '' });

    expect(await runOnboardingTurn(input())).toEqual({ kind: 'malformed' });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('lets a provider failure through for the caller to classify', async () => {
    mockSend.mockRejectedValue(new Error('offline'));

    await expect(runOnboardingTurn(input())).rejects.toThrow('offline');
  });

  it('sends the transcript as history and the signal along', async () => {
    mockSend.mockResolvedValue(reply('ok'));
    const signal = new AbortController().signal;

    await runOnboardingTurn(
      input({
        signal,
        history: [
          { id: '1', role: 'user', text: 'hi', at: 1 },
          { id: '2', role: 'assistant', text: 'hello', at: 2 },
        ],
      })
    );

    const [config, request] = mockSend.mock.calls[0];
    expect(config.signal).toBe(signal);
    expect(request.history).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'coach', content: 'hello' },
    ]);
  });
});
