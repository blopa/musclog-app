import { type CoachAIConfig, requestStructured, sendCoachMessage } from '../coachAI';

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

describe('local replies that are not clean JSON', () => {
  const say = (content: string) =>
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content } }] });

  beforeEach(() => mockCreate.mockReset());

  it('shows the message of almost-JSON instead of the raw JSON', async () => {
    say("{'msg4User': 'Anytime!', 'remember_me': '',}");

    const result = await sendCoachMessage(config('local'), [], 'thanks');

    expect(result.msg4User).toBe('Anytime!');
  });

  it('reads the message out of a reply that was cut off', async () => {
    say('<|im_start|>assistant {"msg4User": "Anytime! Rest well and eat enough protein');

    const result = await sendCoachMessage(config('local'), [], 'thanks');

    expect(result.msg4User).toContain('Anytime!');
    expect(result.msg4User).not.toContain('{');
  });

  it('keeps plain prose as it is', async () => {
    say('Anytime, good luck!');

    const result = await sendCoachMessage(config('local'), [], 'thanks');

    expect(result.msg4User).toBe('Anytime, good luck!');
  });

  it('never shows chat-template tokens when the JSON has no message field', async () => {
    say('<|im_start|>assistant {"remember_me": ""}');

    const result = await sendCoachMessage(config('local'), [], 'thanks');

    expect(result.msg4User).not.toContain('<|im_start|>');
  });
});

describe('local structured replies', () => {
  const request = {
    operation: 'test',
    schemaName: 'test',
    systemPrompt: 'S',
    history: [],
    userMessage: 'u',
    buildSchema: () => ({
      type: 'object',
      properties: { n: { type: 'number' } },
      required: ['n'],
    }),
  };
  const say = (content: string) =>
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content } }] });

  beforeEach(() => mockCreate.mockReset());

  it('repairs almost-JSON without asking the model again', async () => {
    say("{'n': 3,}");

    const result = await requestStructured(config('local'), request);

    expect(result).toEqual({ kind: 'ok', value: { n: 3 } });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('asks the model to fix a reply that cannot be repaired by code', async () => {
    say('I cannot do that');
    say('{"n": 7}');

    const result = await requestStructured(config('local'), request);

    expect(result).toEqual({ kind: 'ok', value: { n: 7 } });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages[1].content).toContain('I cannot do that');
  });

  it('keeps a partial reply when the repair does not improve it', async () => {
    say('{"other": 1}');
    say('still not it');

    const result = await requestStructured(config('local'), request);

    expect(result).toEqual({ kind: 'ok', value: { other: 1 } });
  });

  it('is malformed when nothing works, and never repairs for a cloud provider', async () => {
    say('nope');
    say('nope again');
    expect((await requestStructured(config('local'), request)).kind).toBe('malformed');

    mockCreate.mockReset();
    say('nope');
    expect((await requestStructured(config('openai'), request)).kind).toBe('malformed');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
