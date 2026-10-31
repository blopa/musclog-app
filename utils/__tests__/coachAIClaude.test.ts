import { AiInvalidKeyError } from '../aiErrors';
import {
  type CoachAIConfig,
  getNutritionInsights,
  requestStructured,
  sendCoachMessage,
} from '../coachAI';

const mockCreate = jest.fn();
const mockStream = jest.fn();

jest.mock('../claude', () => {
  const actual = jest.requireActual('../claude');
  return {
    ...actual,
    buildClaudeClient: jest.fn(() => ({
      messages: {
        create: (...args: unknown[]) => mockCreate(...args),
        stream: (...args: unknown[]) => mockStream(...args),
      },
    })),
  };
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

const claude: CoachAIConfig = {
  provider: 'claude',
  model: 'claude-opus-5-5',
  apiKey: 'k',
  language: 'en-US',
};

const reply = (text: string) => ({
  content: [
    { type: 'thinking', thinking: '', signature: 's' },
    { type: 'text', text },
  ],
  stop_reason: 'end_turn',
});

const textDelta = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
});

async function* events(...pieces: string[]) {
  yield { type: 'message_start' };
  for (const piece of pieces) {
    yield textDelta(piece);
  }

  yield { type: 'message_stop' };
}

describe('Claude provider', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockReset();
    mockStream.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends a coach message as structured output and parses the reply', async () => {
    mockCreate.mockResolvedValue(
      reply(JSON.stringify({ msg4User: 'Eat more protein.', sumMsg: 'Protein.' }))
    );

    const result = await sendCoachMessage(
      claude,
      [{ role: 'coach', content: 'Welcome' }],
      'What should I eat?'
    );

    expect(result).toMatchObject({ msg4User: 'Eat more protein.', sumMsg: 'Protein.' });
    const [params, options] = mockCreate.mock.calls[0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: 'SYSTEM',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    // No sampling parameters, no thinking override, no forced tool call: the newest models reject them.
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('tool_choice');
    // The seeded welcome is not sent, so the conversation starts with the user.
    expect(params.messages[0]).toEqual({
      role: 'user',
      content: expect.stringContaining('What should I eat?'),
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(params.output_config.format.schema).toMatchObject({ additionalProperties: false });
  });

  it('shows the reply as it is written while streaming, then returns it whole', async () => {
    mockStream.mockReturnValue(events('{"msg4User":"Hel', 'lo there","sumMsg":', '"Hi"}'));
    const seen: string[] = [];

    const result = await sendCoachMessage(claude, [], 'hi', undefined, {
      onText: (text) => seen.push(text),
    });

    expect(result).toMatchObject({ msg4User: 'Hello there', sumMsg: 'Hi' });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen[seen.length - 1]).toBe('Hello there');
    expect(mockStream.mock.calls[0][0].max_tokens).toBe(64000);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('streams plain text for insights', async () => {
    mockStream.mockReturnValue(events('Your ', 'protein ', 'is on track.'));
    const seen: string[] = [];

    const text = await getNutritionInsights(
      claude,
      '2026-10-01',
      '2026-10-07',
      undefined,
      undefined,
      'nutrition',
      { onText: (t) => seen.push(t) }
    );

    expect(text).toBe('Your protein is on track.');
    expect(seen[seen.length - 1]).toBe('Your protein is on track.');
  });

  it('throws a typed error, without retrying, when the key is rejected', async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error('invalid x-api-key'), { status: 401 }));

    await expect(sendCoachMessage(claude, [], 'hi')).rejects.toBeInstanceOf(AiInvalidKeyError);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('treats an exhausted credit balance as a credits error', async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error('Your credit balance is too low to access the Anthropic API'), {
        status: 400,
      })
    );

    await expect(sendCoachMessage(claude, [], 'hi')).rejects.toMatchObject({
      name: 'AiCreditsError',
    });
  });

  it('gives a refused structured request back as malformed rather than throwing', async () => {
    mockCreate.mockResolvedValue({ content: [], stop_reason: 'refusal' });

    await expect(
      requestStructured(claude, {
        operation: 'test',
        schemaName: 'x',
        systemPrompt: 's',
        history: [],
        userMessage: 'u',
        buildSchema: () => ({ type: 'object', properties: {} }),
      })
    ).resolves.toMatchObject({ kind: 'malformed' });
  });

  it('asks the schema builder for the Claude dialect', async () => {
    mockCreate.mockResolvedValue(reply('{"a":1}'));
    const buildSchema = jest.fn(() => ({ type: 'object', properties: { a: { type: 'number' } } }));

    await expect(
      requestStructured(claude, {
        operation: 'test',
        schemaName: 'x',
        systemPrompt: 's',
        history: [],
        userMessage: 'u',
        buildSchema,
      })
    ).resolves.toEqual({ kind: 'ok', value: { a: 1 } });
    expect(buildSchema).toHaveBeenCalledWith('claude');
  });
});
