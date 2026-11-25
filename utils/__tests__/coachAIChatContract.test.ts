import i18n from 'i18next';

import { AiTimeoutError } from '../aiErrors';
import { type CoachAIConfig, requestStructured, sendCoachMessage } from '../coachAI';
import { configureBasicGenAI } from '../gemini';
import { getChatMessagePromptContent } from '../prompts';
import { handleError } from '../handleError';

const mockCreate = jest.fn();
const mockSendLocalStructuredRaw = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI() {
    return { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);
  return { __esModule: true, default: Mock };
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../onDeviceLocal', () => ({
  sendLocalMessage: jest.fn(),
  streamLocalMessage: jest.fn(),
  sendLocalStructuredRaw: (...args: unknown[]) => mockSendLocalStructuredRaw(...args),
}));
jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn((chunk: { text?: string }) => ({
    text: chunk?.text ?? '',
    thoughtOnly: false,
  })),
}));
jest.mock('../prompts', () => ({
  getNutritionInsightsPrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getMealCritiquePrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getChatMessagePromptContent: jest.fn().mockResolvedValue('SYSTEM'),
  getChatReviewInstruction: jest.fn(
    (_language: string, message: string, draft: string) => `REVIEW ${message} :: ${draft}`
  ),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
const mockSettingsGet = jest.fn().mockResolvedValue('off');
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: (...args: unknown[]) => mockSettingsGet(...args),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
  },
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const gemini: CoachAIConfig = { provider: 'gemini', model: 'g', apiKey: 'k', language: 'en-US' };
const gguf: CoachAIConfig = {
  provider: 'on-device',
  model: 'on-device',
  language: 'en-US',
  engine: 'gguf',
  vision: false,
};

const json = (msg4User: string) => JSON.stringify({ msg4User, remember_me: '' });
const oneShot = (content: string) => ({ choices: [{ message: { content } }] });
const delta = (content: string) => ({ choices: [{ delta: { content } }] });

async function* chunksThenFailure(pieces: string[], error: Error) {
  for (const piece of pieces) {
    yield delta(piece);
  }

  throw error;
}

const reportedContexts = () => (handleError as jest.Mock).mock.calls.map((call) => call[1]);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCreate.mockReset();
  mockSendLocalStructuredRaw.mockReset();
  (configureBasicGenAI as jest.Mock).mockReset();
  (getChatMessagePromptContent as jest.Mock).mockClear();
  (handleError as jest.Mock).mockClear();
  mockSettingsGet.mockReset().mockResolvedValue('off');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the chat error contract', () => {
  it('answers a generic Gemini failure with the apology and reports it once', async () => {
    (configureBasicGenAI as jest.Mock).mockResolvedValue({
      generateContent: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const result = await sendCoachMessage(gemini, [], 'hello', 'general');

    expect(result.msg4User).toBe(i18n.t('errors.aiProcessingError'));
    expect(result.sumMsg).toBe(i18n.t('errors.aiProcessingErrorTitle'));
    expect(reportedContexts()).toEqual(['coachAI.sendCoachMessage']);
  });

  it('builds the system prompt once for a drafted and reviewed reply', async () => {
    mockSettingsGet.mockResolvedValue('tokenmaxxing');
    mockCreate
      .mockResolvedValueOnce(oneShot(json('Draft.')))
      .mockResolvedValueOnce(oneShot(json('Reviewed.')));

    const result = await sendCoachMessage(openai, [], 'hello', 'general');

    expect(result.msg4User).toBe('Reviewed.');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(getChatMessagePromptContent).toHaveBeenCalledTimes(1);
  });

  it("drops the review prompt's fence lines a reviewer copied around the draft", async () => {
    mockSettingsGet.mockResolvedValue('tokenmaxxing');
    mockCreate
      .mockResolvedValueOnce(oneShot(json('Draft.')))
      .mockResolvedValueOnce(oneShot(json('<<<DRAFT\nDraft.\nDRAFT>>>')));

    const result = await sendCoachMessage(openai, [], 'hello', 'general');

    expect(result.msg4User).toBe('Draft.');
  });

  it('gives the apology and makes no review request when the draft fails', async () => {
    mockSettingsGet.mockResolvedValue('tokenmaxxing');
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }));

    const result = await sendCoachMessage(openai, [], 'hello', 'general', { onText: () => {} });

    expect(result.msg4User).toBe(i18n.t('errors.aiProcessingError'));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(reportedContexts()).toEqual(['coachAI.sendCoachMessage']);
  });

  it('keeps the draft, shows it and reports the review when the review fails', async () => {
    mockSettingsGet.mockResolvedValue('tokenmaxxing');
    mockCreate
      .mockResolvedValueOnce(oneShot(json('Rest day today.')))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }));
    const seen: string[] = [];

    const result = await sendCoachMessage(openai, [], 'train today?', 'general', {
      onText: (text) => seen.push(text),
    });

    expect(result.msg4User).toBe('Rest day today.');
    expect(seen).toEqual(['Rest day today.']);
    expect(reportedContexts()).toEqual(['coachAI.reviewCoachReply']);
  });

  it('rejects, rather than apologising, when a streamed reply fails after its first text', async () => {
    mockCreate.mockResolvedValue(
      chunksThenFailure(
        ['{"msg4User":"Half of an ans'],
        Object.assign(new Error('boom'), { status: 500 })
      )
    );
    const seen: string[] = [];

    await expect(
      sendCoachMessage(openai, [], 'hello', 'general', { onText: (text) => seen.push(text) })
    ).rejects.toThrow('boom');
    expect(seen.length).toBeGreaterThan(0);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('the idle timeout of an on-device structured request', () => {
  it('is reset by every token, like the photo path', async () => {
    jest.useFakeTimers();
    mockSendLocalStructuredRaw.mockImplementation(
      (
        _messages: unknown,
        _system: unknown,
        _schema: unknown,
        options: { onDelta?: () => void; signal?: AbortSignal }
      ) =>
        new Promise<string>((resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          setTimeout(() => options.onDelta?.(), 30_000);
          setTimeout(() => options.onDelta?.(), 60_000);
          setTimeout(() => resolve('{"a":1}'), 90_000);
        })
    );

    const pending = requestStructured(gguf, {
      operation: 'test',
      schemaName: 'test',
      systemPrompt: 'SYSTEM',
      history: [],
      userMessage: 'hi',
      buildSchema: () => ({ type: 'object' }),
    }).then(
      (value) => ({ value }),
      (error: unknown) => ({ error })
    );
    await jest.advanceTimersByTimeAsync(95_000);
    const outcome = await pending;

    expect('error' in outcome ? outcome.error : null).not.toBeInstanceOf(AiTimeoutError);
    expect(outcome).toEqual({ value: { kind: 'ok', value: { a: 1 } } });
  });
});
