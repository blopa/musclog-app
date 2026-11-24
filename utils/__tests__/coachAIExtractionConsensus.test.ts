import { AiCancelledError } from '../aiErrors';
import { type CoachAIConfig, extractMacrosFromLabelText, parsePastWorkouts } from '../coachAI';

const mockCreate = jest.fn();
const mockThinking: { level: 'off' | 'medium' | 'high' | 'tokenmaxxing' } = { level: 'off' };

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
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../aiErrorNotice', () => ({ notifyUserFacingAiError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => mockThinking.level),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));
jest.mock('../prompts', () => ({
  ...jest.requireActual('../prompts'),
  getActiveCustomPrompts: jest.fn(async () => ''),
  getParsePastWorkoutsPrompt: jest.fn(async () => 'SYSTEM'),
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const reply = (value: unknown) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
const label = (protein: number) => ({
  name: 'Oat bar',
  calories: 200,
  protein,
  carbs: 30,
  fat: 6,
  fiber: 4,
});
const lastUserMessage = (call: number) =>
  (mockCreate.mock.calls[call][0].messages.at(-1).content as string) ?? '';

describe('extractions at each thinking level', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockThinking.level = 'off';
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['off', 'medium'] as const)('makes one request at %s', async (level) => {
    mockThinking.level = level;
    mockCreate.mockResolvedValue(reply(label(10)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 10 g');

    expect(result).toMatchObject({ protein: 10 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('reads twice at high and asks nothing more when the readings agree', async () => {
    mockThinking.level = 'high';
    mockCreate.mockResolvedValue(reply(label(10)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 10 g');

    expect(result).toMatchObject({ protein: 10 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('asks one arbiter request about a disputed field and uses its answer', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(reply(label(10)))
      .mockResolvedValueOnce(reply(label(16)))
      .mockResolvedValueOnce(reply(label(12)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 12 g');

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(lastUserMessage(2)).toContain('Protein 12 g');
    expect(lastUserMessage(2)).toContain('Disputed fields: protein');
    expect(result).toMatchObject({ protein: 12 });
  });

  it('keeps the combined readings when the arbiter fails', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(reply(label(10)))
      .mockResolvedValueOnce(reply(label(16)))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }));

    const result = await extractMacrosFromLabelText(openai, 'Protein 12 g');

    expect(result).toMatchObject({ protein: 13, name: 'Oat bar' });
  });

  it('stops at two readings at tokenmaxxing when they agree', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate.mockResolvedValue(reply(label(10)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 10 g');

    expect(result).toMatchObject({ protein: 10 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('takes a third reading and then the arbiter at tokenmaxxing when all three disagree', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate
      .mockResolvedValueOnce(reply(label(10)))
      .mockResolvedValueOnce(reply(label(16)))
      .mockResolvedValueOnce(reply(label(30)))
      .mockResolvedValueOnce(reply(label(12)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 12 g');

    expect(mockCreate).toHaveBeenCalledTimes(4);
    // The first two readings carry no arbiter note, the fourth request does.
    expect(lastUserMessage(2)).not.toContain('Disputed fields');
    expect(lastUserMessage(3)).toContain('Disputed fields: protein');
    expect(result).toMatchObject({ protein: 12 });
  });

  it('still asks the arbiter when the third reading fails', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate
      .mockResolvedValueOnce(reply(label(10)))
      .mockResolvedValueOnce(reply(label(16)))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 400 }))
      .mockResolvedValueOnce(reply(label(12)));

    const result = await extractMacrosFromLabelText(openai, 'Protein 12 g');

    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(lastUserMessage(3)).toContain('Disputed fields: protein');
    expect(result).toMatchObject({ protein: 12 });
  });

  it('stops at a cancel in the third reading', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate
      .mockResolvedValueOnce(reply(label(10)))
      .mockResolvedValueOnce(reply(label(16)))
      .mockRejectedValueOnce(new AiCancelledError());

    await expect(extractMacrosFromLabelText(openai, 'Protein 12 g')).resolves.toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('settles a two-to-one split at tokenmaxxing with a third reading and no arbiter', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate
      .mockResolvedValueOnce(reply({ pastWorkouts: [{ name: 'Bench', sets: [{ reps: 5 }] }] }))
      .mockResolvedValueOnce(reply({ pastWorkouts: [{ name: 'Bench', sets: [{ reps: 8 }] }] }))
      .mockResolvedValueOnce(reply({ pastWorkouts: [{ name: 'bench', sets: [{ reps: 5 }] }] }));

    const result = await parsePastWorkouts(openai, 'bench 5 reps yesterday', ['Bench']);

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result).toEqual([{ name: 'Bench', sets: [{ reps: 5 }] }]);
  });

  it('stops at a cancel without asking an arbiter', async () => {
    mockThinking.level = 'high';
    mockCreate.mockRejectedValue(new AiCancelledError());

    await expect(extractMacrosFromLabelText(openai, 'Protein 10 g')).resolves.toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('makes one request on the free tier', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate.mockResolvedValue(reply(label(10)));

    await extractMacrosFromLabelText(
      { ...openai, provider: 'gateway', baseUrl: 'https://openrouter.ai/api/v1' },
      'Protein 10 g'
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
