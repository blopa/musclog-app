import {
  type CoachAIConfig,
  getNutritionInsights,
  requestStructured,
  sendCoachMessage,
} from '../coachAI';
import { clearLlmUsage, getRecentLlmUsage } from '../llmUsage';

const mockOpenAiCreate = jest.fn();
const mockClaudeCreate = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI() {
    return { chat: { completions: { create: (...a: unknown[]) => mockOpenAiCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);
  return { __esModule: true, default: Mock };
});
jest.mock('../claude', () => ({
  ...jest.requireActual('../claude'),
  buildClaudeClient: jest.fn(() => ({
    messages: { create: (...a: unknown[]) => mockClaudeCreate(...a) },
  })),
}));
jest.mock('../gemini', () => ({
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  configureBasicGenAI: jest.fn(async () => ({
    generateContent: (...a: unknown[]) => mockGenerateContent(...a),
  })),
  extractGeminiText: jest.fn((response: { text?: string }) => ({
    text: response.text ?? '',
    thoughtOnly: false,
  })),
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
  SettingsService: { get: jest.fn().mockResolvedValue('off') },
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const claude: CoachAIConfig = { provider: 'claude', model: 'c', apiKey: 'k', language: 'en-US' };
const gemini: CoachAIConfig = { provider: 'gemini', model: 'g', apiKey: 'k', language: 'en-US' };

const openAiReply = (content: string) => ({
  choices: [{ message: { content }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
});
const claudeReply = (text: string) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 90, output_tokens: 20 },
});
const geminiReply = (text: string) => ({
  text,
  usageMetadata: { promptTokenCount: 70, candidatesTokenCount: 10 },
});

const structuredRequest = (operation: string) => ({
  operation,
  schemaName: 'n',
  systemPrompt: 'S',
  history: [],
  userMessage: 'u',
  buildSchema: () => ({ type: 'object', properties: { n: { type: 'number' } }, required: ['n'] }),
});

const recorded = (operation: string) =>
  getRecentLlmUsage().filter((entry) => entry.operation === operation);

describe('every cloud request records its token usage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenAiCreate.mockReset();
    mockClaudeCreate.mockReset();
    mockGenerateContent.mockReset();
    clearLlmUsage();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['openai', openai, mockOpenAiCreate, openAiReply('{"n":1}')],
    ['claude', claude, mockClaudeCreate, claudeReply('{"n":1}')],
    ['gemini', gemini, mockGenerateContent, geminiReply('{"n":1}')],
  ] as const)('a structured %s request', async (_name, config, mock, response) => {
    mock.mockResolvedValue(response);

    await requestStructured(config, structuredRequest('extractThing'));

    const entries = recorded('extractThing');
    expect(entries).toHaveLength(1);
    expect(entries[0].provider).toBe(config.provider);
    expect(entries[0].usage.inputTokens).toBeGreaterThan(0);
  });

  it.each([
    ['openai', openai, mockOpenAiCreate, openAiReply('Eat more protein.')],
    ['gemini', gemini, mockGenerateContent, geminiReply('Eat more protein.')],
  ] as const)('a plain %s request (an insight)', async (_name, config, mock, response) => {
    mock.mockResolvedValue(response);

    await getNutritionInsights(config, '2026-11-01', '2026-11-07');

    expect(getRecentLlmUsage().filter((entry) => entry.provider === config.provider)).toHaveLength(
      1
    );
  });

  it.each([
    ['openai', openai, mockOpenAiCreate, openAiReply('{"msg4User":"hi","remember_me":""}')],
    ['gemini', gemini, mockGenerateContent, geminiReply('{"msg4User":"hi","remember_me":""}')],
  ] as const)('a %s chat reply', async (_name, config, mock, response) => {
    mock.mockResolvedValue(response);

    await sendCoachMessage(config, [], 'hello');

    expect(getRecentLlmUsage().filter((entry) => entry.provider === config.provider)).toHaveLength(
      1
    );
  });
});
