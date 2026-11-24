import { type CoachAIConfig, requestStructured } from '../coachAI';

const mockCreate = jest.fn();
const mockGenerateContent = jest.fn();
const mockCaptureMessage = jest.fn(() => Promise.resolve());
const mockClaudeCreate = jest.fn();

jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock });
});
jest.mock('../claude', () => {
  const actual = jest.requireActual('../claude');
  return {
    ...actual,
    buildClaudeClient: jest.fn(() => ({
      messages: {
        create: (...args: unknown[]) => mockClaudeCreate(...args),
        stream: jest.fn(),
      },
    })),
  };
});
jest.mock('../gemini', () => {
  const actual = jest.requireActual('../gemini');
  return {
    ...actual,
    configureBasicGenAI: jest.fn(async () => ({
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    })),
  };
});
jest.mock('../sentry', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));
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
  SettingsService: {
    get: jest.fn().mockResolvedValue('off'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
  },
}));

const CUT_OFF = '{"name":"Rice","grams":';
const COMPLETE = '{"name":"Rice","grams":150}';

const schema = {
  type: 'object',
  properties: { name: { type: 'string' }, grams: { type: 'number' } },
  required: ['name', 'grams'],
  additionalProperties: false,
};

const request = {
  operation: 'testOp',
  task: 'extraction' as const,
  schemaName: 'x',
  systemPrompt: 'S',
  history: [],
  userMessage: 'u',
  buildSchema: () => schema,
};

const openai: CoachAIConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'k',
  language: 'en-US',
};
const gateway: CoachAIConfig = {
  provider: 'gateway',
  model: 'gemma-test',
  apiKey: 'k',
  baseUrl: 'http://gateway.test/v1',
  language: 'en-US',
};
const local: CoachAIConfig = {
  provider: 'local',
  model: 'm',
  apiKey: 'k',
  baseUrl: 'http://localhost:1234/v1',
  language: 'en-US',
};
const gemini: CoachAIConfig = {
  provider: 'gemini',
  model: 'gemini-test',
  apiKey: 'k',
  language: 'en-US',
};
const claude: CoachAIConfig = {
  provider: 'claude',
  model: 'claude-test',
  apiKey: 'k',
  language: 'en-US',
};

const openAiReply = (content: string, finish_reason: string) => ({
  choices: [{ message: { content }, finish_reason }],
});
const geminiReply = (text: string, finishReason: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
});
const claudeReply = (text: string, stop_reason: string) => ({
  content: [{ type: 'text', text }],
  stop_reason,
});

describe('structured replies cut off at the token limit', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockGenerateContent.mockReset();
    mockClaudeCreate.mockReset();
    mockCaptureMessage.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks an OpenAI reply that stopped at the limit as truncated and reports it once', async () => {
    mockCreate.mockResolvedValueOnce(openAiReply(CUT_OFF, 'length'));

    const result = await requestStructured(openai, request);

    expect(result).toEqual({
      kind: 'malformed',
      raw: '',
      reason: 'truncated',
      finishReason: 'length',
    });
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith('ai-structured-reply-truncated', {
      level: 'warning',
      tags: { provider: 'openai', operation: 'testOp', finishReason: 'length' },
      fingerprint: ['ai-structured-reply-truncated', 'openai', 'testOp'],
    });
    expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain('Rice');
  });

  it('marks a Gemini reply that stopped at MAX_TOKENS as truncated and reports it once', async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiReply(CUT_OFF, 'MAX_TOKENS'));

    const result = await requestStructured(gemini, request);

    expect(result).toEqual({
      kind: 'malformed',
      raw: '',
      reason: 'truncated',
      finishReason: 'MAX_TOKENS',
    });
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith('ai-structured-reply-truncated', {
      level: 'warning',
      tags: { provider: 'gemini', operation: 'testOp', finishReason: 'MAX_TOKENS' },
      fingerprint: ['ai-structured-reply-truncated', 'gemini', 'testOp'],
    });
    expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain('Rice');
  });

  it('marks a Claude reply that stopped at max_tokens as truncated and reports it once', async () => {
    mockClaudeCreate.mockResolvedValueOnce(claudeReply(CUT_OFF, 'max_tokens'));

    const result = await requestStructured(claude, request);

    expect(result).toEqual({
      kind: 'malformed',
      raw: '',
      reason: 'truncated',
      finishReason: 'max_tokens',
    });
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith('ai-structured-reply-truncated', {
      level: 'warning',
      tags: { provider: 'claude', operation: 'testOp', finishReason: 'max_tokens' },
      fingerprint: ['ai-structured-reply-truncated', 'claude', 'testOp'],
    });
    expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain('Rice');
  });

  it('accepts the same complete reply when the provider stopped normally', async () => {
    mockCreate.mockResolvedValueOnce(openAiReply(COMPLETE, 'stop'));
    mockGenerateContent.mockResolvedValueOnce(geminiReply(COMPLETE, 'STOP'));
    mockClaudeCreate.mockResolvedValueOnce(claudeReply(COMPLETE, 'end_turn'));

    await expect(requestStructured(openai, request)).resolves.toEqual({
      kind: 'ok',
      value: { name: 'Rice', grams: 150 },
    });
    await expect(requestStructured(gemini, request)).resolves.toEqual({
      kind: 'ok',
      value: { name: 'Rice', grams: 150 },
    });
    await expect(requestStructured(claude, request)).resolves.toEqual({
      kind: 'ok',
      value: { name: 'Rice', grams: 150 },
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('still reads a complete fenced reply with a normal stop signal', async () => {
    mockCreate.mockResolvedValueOnce(
      openAiReply('Here it is:\n```json\n' + COMPLETE + '\n```', 'stop')
    );

    await expect(requestStructured(openai, request)).resolves.toEqual({
      kind: 'ok',
      value: { name: 'Rice', grams: 150 },
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('keeps the repair ladder for a gateway reply cut off at the limit', async () => {
    mockCreate.mockResolvedValueOnce(openAiReply(CUT_OFF, 'length'));

    const result = await requestStructured(gateway, request);

    expect(result.kind).toBe('ok');
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('keeps the repair ladder for a local server reply cut off at the limit', async () => {
    mockCreate.mockResolvedValueOnce(openAiReply(CUT_OFF, 'length'));

    const result = await requestStructured(local, request);

    expect(result.kind).toBe('ok');
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
