import { type CoachAIConfig, requestStructured, thinkingLevelFor } from '../coachAI';

const mockCreate = jest.fn();
const mockClaudeCreate = jest.fn();
const mockThinking: { level: 'off' | 'medium' | 'high' | 'tokenmaxxing' } = { level: 'off' };
const mockFetchPremiumConfig = jest.fn();

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

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('@/services/premium/premiumService', () => ({
  fetchPremiumConfig: (...args: unknown[]) => mockFetchPremiumConfig(...args),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => mockThinking.level),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));

const SCHEMA = () => ({ type: 'object', properties: { ok: { type: 'boolean' } } });

const openAiReply = {
  choices: [{ message: { content: '{"ok":true}' } }],
};

const claudeReply = {
  content: [{ type: 'text', text: '{"ok":true}' }],
  stop_reason: 'end_turn',
};

function request(task?: 'chat' | 'extraction' | 'insight' | 'planning') {
  return {
    operation: 'effortTest',
    schemaName: 'effortTest',
    systemPrompt: 'SYSTEM',
    history: [],
    userMessage: 'hello',
    buildSchema: SCHEMA,
    ...(task ? { task } : {}),
  };
}

describe('reasoning effort per job', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockClaudeCreate.mockReset();
    mockCreate.mockResolvedValue(openAiReply);
    mockClaudeCreate.mockResolvedValue(claudeReply);
    mockThinking.level = 'off';
    mockFetchPremiumConfig.mockReset();
  });

  describe('openai provider', () => {
    const openai: CoachAIConfig = {
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'user-key',
      baseUrl: 'https://api.example/v1',
    };

    it('sends low effort for an extraction job with thinking off', async () => {
      await requestStructured(openai, request('extraction'));
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'low' });
    });

    it('sends high effort for an extraction job with thinking on', async () => {
      mockThinking.level = 'high';
      await requestStructured(openai, request('extraction'));
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'high' });
    });

    it('sends medium effort for a planning job with thinking off', async () => {
      await requestStructured(openai, request('planning'));
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'medium' });
    });

    it('defaults a request without a task to extraction (low)', async () => {
      await requestStructured(openai, request());
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'low' });
    });
  });

  describe('other openai-protocol providers', () => {
    const configs: CoachAIConfig[] = [
      { provider: 'local', model: 'llama', apiKey: 'k', baseUrl: 'http://localhost:1234/v1' },
      {
        provider: 'gateway',
        model: 'google/gemma-4-31b-it:free',
        apiKey: 'k',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
    ] as CoachAIConfig[];

    it.each(configs.map((config) => [config.provider, config] as const))(
      '%s never carries reasoning_effort',
      async (_name, config) => {
        mockThinking.level = 'high';
        await requestStructured(config, request('planning'));
        expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('reasoning_effort');
      }
    );
  });

  describe('musclog iron (hosted)', () => {
    const hosted = {
      provider: 'hosted',
      model: 'hosted-model',
      apiKey: 'session-token',
      baseUrl: 'https://worker.example/v1',
    } as CoachAIConfig;

    it('follows the table once the Worker says it takes a per-request effort', async () => {
      mockFetchPremiumConfig.mockResolvedValue({ ok: true, value: { reasoningEffort: true } });
      await requestStructured(hosted, request('planning'));
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'medium' });

      mockThinking.level = 'high';
      await requestStructured(hosted, request('extraction'));
      expect(mockCreate.mock.calls[1][0]).toMatchObject({ reasoning_effort: 'high' });
    });

    it('sends nothing to a Worker that does not take it (an older deploy would answer 400)', async () => {
      mockFetchPremiumConfig.mockResolvedValue({ ok: true, value: { reasoningEffort: false } });
      mockThinking.level = 'high';
      await requestStructured(hosted, request('planning'));
      expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('reasoning_effort');
    });

    it.each([
      ['a failed config read', () => mockFetchPremiumConfig.mockResolvedValue({ ok: false })],
      [
        'a throwing config read',
        () => mockFetchPremiumConfig.mockRejectedValue(new Error('offline')),
      ],
    ])('still sends the request, without an effort, after %s', async (_name, arrange) => {
      arrange();
      mockThinking.level = 'high';
      await requestStructured(hosted, request('planning'));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('reasoning_effort');
    });
  });

  describe('claude provider', () => {
    const claude: CoachAIConfig = {
      provider: 'claude',
      model: 'claude-opus-5-5',
      apiKey: 'k',
      language: 'en-US',
    };

    it('sends low output effort for an extraction job with thinking off', async () => {
      await requestStructured(claude, request('extraction'));
      expect(mockClaudeCreate.mock.calls[0][0].output_config).toMatchObject({ effort: 'low' });
    });

    it('sends medium output effort for a planning job with thinking off', async () => {
      await requestStructured(claude, request('planning'));
      expect(mockClaudeCreate.mock.calls[0][0].output_config).toMatchObject({ effort: 'medium' });
    });

    it('sends high output effort with thinking on', async () => {
      mockThinking.level = 'high';
      await requestStructured(claude, request('planning'));
      expect(mockClaudeCreate.mock.calls[0][0].output_config).toMatchObject({ effort: 'high' });
    });
  });
  describe('tokenmaxxing', () => {
    it('sends Claude effort max and OpenAI reasoning_effort high', async () => {
      mockThinking.level = 'tokenmaxxing';
      await requestStructured(
        { provider: 'claude', model: 'claude-opus-5-5', apiKey: 'k', language: 'en-US' },
        request('planning')
      );
      expect(mockClaudeCreate.mock.calls[0][0].output_config).toMatchObject({ effort: 'max' });

      await requestStructured(
        { provider: 'openai', model: 'gpt-test', apiKey: 'k', baseUrl: 'https://api.example/v1' },
        request('planning')
      );
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'high' });
    });

    it('treats the free tier exactly like off', async () => {
      const gateway = {
        provider: 'gateway',
        model: 'google/gemma-4-31b-it:free',
        apiKey: 'k',
        baseUrl: 'https://openrouter.ai/api/v1',
      } as CoachAIConfig;
      mockThinking.level = 'tokenmaxxing';
      expect(await thinkingLevelFor(gateway)).toBe('off');
      mockThinking.level = 'off';
      expect(await thinkingLevelFor(gateway)).toBe('off');
    });

    it('caps a background task at high', async () => {
      mockThinking.level = 'tokenmaxxing';
      const cfg = {
        provider: 'claude',
        model: 'claude-opus-5-5',
        apiKey: 'k',
        background: true,
      } as CoachAIConfig;
      expect(await thinkingLevelFor(cfg)).toBe('high');
      await requestStructured(cfg, request('planning'));
      expect(mockClaudeCreate.mock.calls[0][0].output_config).toMatchObject({ effort: 'high' });
    });
  });
});
