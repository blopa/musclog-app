import OpenAI from 'openai';

import { AiCancelledError, AiInvalidKeyError } from '../aiErrors';
import {
  AiCreditsError,
  type CoachAIConfig,
  GatewayRateLimitError,
  PROVIDER_CONFIGS,
} from '../coachAI';
import { sendStructuredChatTurn, type StructuredTurnRequest } from '../structuredChat';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from '../gemini';
import { handleError } from '../handleError';

const mockCreate = jest.fn();
const mockSendOnDeviceStructured = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('openai', () => {
  class APIConnectionError extends Error {}
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock, APIConnectionError });
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendOnDeviceStructured(...args),
}));
jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({ built: true })),
  extractGeminiText: jest.fn(),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getUseThinkingMode: jest.fn().mockResolvedValue(false) },
}));

const schema = (dialect: string) => ({
  type: 'object',
  properties: { dialect: { type: 'string' } },
});
const request = (overrides: Partial<StructuredTurnRequest> = {}): StructuredTurnRequest => ({
  operation: 'aiOnboardingTurn',
  systemPrompt: 'SYSTEM',
  history: [],
  userMessage: 'I am 180 cm',
  buildSchema: schema,
  schemaName: 'onboarding_turn',
  ...overrides,
});
const openai: CoachAIConfig = {
  provider: 'openai',
  model: 'gpt',
  apiKey: 'sk-secret',
  language: 'en-US',
};
const completion = (content: string) => ({ choices: [{ message: { content } }] });
const status = (code: number, message = 'x') => Object.assign(new Error(message), { status: code });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sendStructuredChatTurn: OpenAI-compatible providers', () => {
  it('sends system, history and the new message with a strict schema, and parses the reply', async () => {
    mockCreate.mockResolvedValue(completion('```json\n{"reply":"hi"}\n```'));

    const result = await sendStructuredChatTurn(
      openai,
      request({
        history: [
          { role: 'user', content: 'hello' },
          { role: 'coach', content: 'Welcome' },
        ],
      })
    );

    expect(result).toEqual({ kind: 'ok', value: { reply: 'hi' } });
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.messages.map((m: { role: string }) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(payload.messages[0].content).toContain('SYSTEM');
    expect(payload.messages[0].content).toContain('en-US');
    expect(payload.messages[3].content).toBe('I am 180 cm');
    expect(payload.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'onboarding_turn', strict: true },
    });
    expect(payload.response_format.json_schema.schema.additionalProperties).toBe(false);
  });

  it('asks the schema builder for each provider’s own dialect', async () => {
    const buildSchema = jest.fn(schema);
    mockCreate.mockResolvedValue(completion('{}'));

    await sendStructuredChatTurn(openai, request({ buildSchema }));
    expect(buildSchema).toHaveBeenCalledWith('openai');

    await sendStructuredChatTurn({ ...openai, provider: 'gateway' }, request({ buildSchema }));
    await sendStructuredChatTurn({ ...openai, provider: 'local' }, request({ buildSchema }));
    expect(buildSchema).toHaveBeenCalledTimes(3);
  });

  it('caps a long user message instead of rewriting it', async () => {
    mockCreate.mockResolvedValue(completion('{}'));

    await sendStructuredChatTurn(openai, request({ userMessage: `  O'Brien ${'x'.repeat(5000)}` }));

    const sent = mockCreate.mock.calls[0][0].messages.at(-1).content as string;
    expect(sent).toHaveLength(2000);
    expect(sent.startsWith("O'Brien")).toBe(true);
  });

  it('drops a leading assistant turn, merges repeated roles and keeps the history in budget', async () => {
    mockCreate.mockResolvedValue(completion('{}'));
    const big = 'y'.repeat(PROVIDER_CONFIGS.openai.maxCharBudget);

    await sendStructuredChatTurn(
      openai,
      request({
        history: [
          { role: 'coach', content: 'greeting' },
          { role: 'user', content: 'old '.concat(big) },
          { role: 'coach', content: 'a' },
          { role: 'user', content: 'u1' },
          { role: 'user', content: 'u2' },
        ],
      })
    );

    const roles = mockCreate.mock.calls[0][0].messages.map((m: { role: string }) => m.role);
    expect(roles).not.toContain('greeting');
    expect(
      mockCreate.mock.calls[0][0].messages.map((m: { content: string }) => m.content)
    ).not.toContain(`old ${big}`);
    expect(
      roles
        .slice(1, -1)
        .every((role: string, i: number, all: string[]) => i === 0 || role !== all[i - 1])
    ).toBe(true);
  });

  it('reports a reply that is not JSON as malformed, not as an error', async () => {
    mockCreate.mockResolvedValue(completion('Sure! Here is your answer'));
    await expect(sendStructuredChatTurn(openai, request())).resolves.toEqual({
      kind: 'malformed',
      raw: 'Sure! Here is your answer',
    });

    mockCreate.mockResolvedValue(completion(''));
    await expect(sendStructuredChatTurn(openai, request())).resolves.toMatchObject({
      kind: 'malformed',
    });

    mockCreate.mockResolvedValue({ choices: [] });
    await expect(sendStructuredChatTurn(openai, request())).resolves.toMatchObject({
      kind: 'malformed',
    });
  });

  it('never puts the key in the request body', async () => {
    mockCreate.mockResolvedValue(completion('{}'));

    await sendStructuredChatTurn(openai, request());

    expect(JSON.stringify(mockCreate.mock.calls[0][0])).not.toContain('sk-secret');
  });
});

describe('sendStructuredChatTurn: errors', () => {
  it('turns a rejected key into a typed error without retrying', async () => {
    mockCreate.mockRejectedValue(status(401, 'Incorrect API key provided'));

    await expect(sendStructuredChatTurn(openai, request())).rejects.toBeInstanceOf(
      AiInvalidKeyError
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('maps exhausted credits, and the gateway’s daily limit, to their own errors', async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error('You exceeded your current quota'), { code: 'insufficient_quota' })
    );

    const credits = await sendStructuredChatTurn(openai, request()).catch((e) => e);
    expect(credits).toBeInstanceOf(AiCreditsError);
    expect(credits).not.toBeInstanceOf(GatewayRateLimitError);

    const gateway = await sendStructuredChatTurn(
      { ...openai, provider: 'gateway' },
      request()
    ).catch((e) => e);
    expect(gateway).toBeInstanceOf(GatewayRateLimitError);
  });

  it('does not send a quota problem to Sentry but does send an unexpected failure', async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error('quota'), { code: 'insufficient_quota' })
    );
    await sendStructuredChatTurn(openai, request()).catch(() => {});
    expect(handleError).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.stringContaining('sendStructuredChatTurn'),
      { sendToSentry: false }
    );

    mockCreate.mockRejectedValueOnce(new Error('boom'));
    await expect(sendStructuredChatTurn(openai, request())).rejects.toThrow('boom');
    expect(handleError).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.stringContaining('sendStructuredChatTurn'),
      { sendToSentry: true }
    );
  });

  it('lets a dropped connection through unchanged for the caller to classify', async () => {
    const dropped = new (
      OpenAI as unknown as { APIConnectionError: new (m: string) => Error }
    ).APIConnectionError('offline');
    mockCreate.mockRejectedValue(dropped);

    await expect(sendStructuredChatTurn(openai, request())).rejects.toBe(dropped);
  });

  it('turns an abort into a cancel', async () => {
    const controller = new AbortController();
    mockCreate.mockImplementation(
      (_payload: unknown, options: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          options.signal.addEventListener('abort', () => reject(new Error('aborted')))
        )
    );

    const pending = sendStructuredChatTurn({ ...openai, signal: controller.signal }, request());
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(AiCancelledError);
  });
});

describe('sendStructuredChatTurn: Gemini', () => {
  const gemini: CoachAIConfig = {
    provider: 'gemini',
    model: 'gemini-x',
    apiKey: 'AIza',
    language: 'es-ES',
  };

  beforeEach(() => {
    (configureBasicGenAI as jest.Mock).mockResolvedValue({ generateContent: mockGenerateContent });
    mockGenerateContent.mockResolvedValue({});
  });

  it('asks for the least thinking, alternates roles and parses fenced JSON', async () => {
    (extractGeminiText as jest.Mock).mockReturnValue({ text: '```json\n{"reply":"hola"}\n```' });

    const result = await sendStructuredChatTurn(
      gemini,
      request({
        history: [
          { role: 'user', content: 'a' },
          { role: 'coach', content: 'b' },
        ],
      })
    );

    expect(result).toEqual({ kind: 'ok', value: { reply: 'hola' } });
    expect(buildGeminiGenerationConfig).toHaveBeenCalledWith('gemini-x', {
      responseSchema: expect.anything(),
      thinking: 'low',
    });
    const contents = mockGenerateContent.mock.calls[0][0].contents;
    expect(contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(contents[2].parts[0].text).toBe('I am 180 cm');
  });

  it('is malformed when the model returned no text', async () => {
    (extractGeminiText as jest.Mock).mockReturnValue({ text: '   ' });

    await expect(sendStructuredChatTurn(gemini, request())).resolves.toMatchObject({
      kind: 'malformed',
    });
  });

  it('maps a Gemini 400 key rejection to the typed key error', async () => {
    mockGenerateContent.mockRejectedValue(
      Object.assign(
        new Error(
          '{"error":{"message":"API key not valid","details":[{"reason":"API_KEY_INVALID"}]}}'
        ),
        { status: 400 }
      )
    );

    await expect(sendStructuredChatTurn(gemini, request())).rejects.toBeInstanceOf(
      AiInvalidKeyError
    );
  });
});

describe('sendStructuredChatTurn: on-device', () => {
  const onDevice: CoachAIConfig = { provider: 'on-device', model: 'on-device' };

  it('uses the compact schema and returns the structured value', async () => {
    const buildSchema = jest.fn(schema);
    mockSendOnDeviceStructured.mockResolvedValue({ reply: 'ok' });

    const result = await sendStructuredChatTurn(
      onDevice,
      request({ buildSchema, history: [{ role: 'user', content: 'a' }] })
    );

    expect(result).toEqual({ kind: 'ok', value: { reply: 'ok' } });
    expect(buildSchema).toHaveBeenCalledWith('on-device');
    const [messages, system] = mockSendOnDeviceStructured.mock.calls[0];
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'I am 180 cm' });
    expect(system).toContain('SYSTEM');
  });

  it('treats a null result as malformed and rethrows a failure', async () => {
    mockSendOnDeviceStructured.mockResolvedValueOnce(null);
    await expect(sendStructuredChatTurn(onDevice, request())).resolves.toEqual({
      kind: 'malformed',
      raw: '',
    });

    mockSendOnDeviceStructured.mockRejectedValueOnce(new Error('model unavailable'));
    await expect(sendStructuredChatTurn(onDevice, request())).rejects.toThrow('model unavailable');
  });

  it('sends no history when the prompt alone fills the small context window', async () => {
    mockSendOnDeviceStructured.mockResolvedValue({});

    await sendStructuredChatTurn(
      onDevice,
      request({
        systemPrompt: 's'.repeat(PROVIDER_CONFIGS['on-device'].maxCharBudget),
        history: [{ role: 'user', content: 'earlier' }],
      })
    );

    expect(mockSendOnDeviceStructured.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'I am 180 cm' },
    ]);
  });
});
