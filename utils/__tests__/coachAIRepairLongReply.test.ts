import { type CoachAIConfig, requestStructured } from '../coachAI';

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
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../aiTelemetry', () => ({ reportAiEvent: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn().mockResolvedValue('off') },
}));

const local: CoachAIConfig = {
  provider: 'local',
  model: 'm',
  apiKey: 'k',
  baseUrl: 'http://localhost:1234/v1',
  language: 'en-US',
};

const schema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
    },
  },
  required: ['items'],
};

const request = {
  operation: 'bigList',
  schemaName: 'bigList',
  systemPrompt: 'S',
  history: [],
  userMessage: 'u',
  buildSchema: () => schema,
};

const say = (content: string) =>
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content } }] });

describe('repairing a long local reply', () => {
  beforeEach(() => mockCreate.mockReset());

  it('never asks the model to repair a reply it would have to cut short', async () => {
    // 400 items is well past what a repair request can carry; the last one breaks the schema.
    const items = Array.from({ length: 400 }, () => ({ n: 1 }));
    const original = { items: [...items.slice(0, -1), { n: 'x' }] };
    expect(JSON.stringify(original).length).toBeGreaterThan(3000);
    say(JSON.stringify(original));
    // What a repair of a cut-off copy would answer: the first part of the list only.
    say(JSON.stringify({ items: items.slice(0, 250) }));

    const result = await requestStructured<{ items: unknown[] }>(local, request);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    // A custom server's partial answer is kept as it came, never replaced by a shorter one.
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.items).toHaveLength(400);
    }
  });

  it('still repairs a short reply', async () => {
    say('{"items": [{"n": "x"}]}');
    say('{"items": [{"n": 1}]}');

    const result = await requestStructured<{ items: unknown[] }>(local, request);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ kind: 'ok', value: { items: [{ n: 1 }] } });
  });
});

describe('a repair call that fails', () => {
  beforeEach(() => mockCreate.mockReset());

  it('is reported, and the original failure stands', async () => {
    const { handleError } = jest.requireMock('../handleError') as { handleError: jest.Mock };
    handleError.mockClear();
    say('I cannot do that');
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }));

    const result = await requestStructured(local, request);

    expect(result.kind).toBe('malformed');
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      'coachAI.repairStructured',
      expect.anything()
    );
  });
});
