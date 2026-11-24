import { type CoachAIConfig, generateWorkoutPlan, getNutritionInsights } from '../coachAI';

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
  getNutritionInsightsPrompt: jest.fn(async () => 'DATA: protein 120 g, calories 2150 kcal'),
  createWorkoutPlanPrompt: jest.fn(async () => 'SYSTEM'),
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const text = (content: string) => ({ choices: [{ message: { content } }] });
const lastUserMessage = (call: number) =>
  mockCreate.mock.calls[call][0].messages.at(-1).content as string;
const insights = (config = openai, stream?: { onText: (t: string) => void }) =>
  getNutritionInsights(
    config,
    '2026-11-01',
    '2026-11-07',
    undefined,
    undefined,
    'nutrition',
    stream
  );

describe('insight fact-check rounds', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockThinking.level = 'off';
  });
  afterEach(() => jest.restoreAllMocks());

  it('makes one request at medium', async () => {
    mockThinking.level = 'medium';
    mockCreate.mockResolvedValue(text('You ate 150 g of protein.'));

    await expect(insights()).resolves.toBe('You ate 150 g of protein.');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('fact-checks once at high and keeps a correction with fewer invented figures', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text('You ate 150 g of protein.'))
      .mockResolvedValueOnce(text('You ate 120 g of protein.'));

    await expect(insights()).resolves.toBe('You ate 120 g of protein.');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(lastUserMessage(1)).toContain('Figures not found in the data: 150');
    expect(lastUserMessage(1)).toContain('You ate 150 g of protein.');
  });

  it('refuses a correction that invents more figures', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text('You ate 120 g of protein.'))
      .mockResolvedValueOnce(text('You ate 175 g of protein and 3100 kcal.'));

    await expect(insights()).resolves.toBe('You ate 120 g of protein.');
  });

  it('keeps the draft when the fact-check fails', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text('You ate 120 g of protein.'))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));

    await expect(insights()).resolves.toBe('You ate 120 g of protein.');
  });

  it('runs two rounds at tokenmaxxing, the second one tightening', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate
      .mockResolvedValueOnce(text('You ate 150 g of protein, which is a lot of protein.'))
      .mockResolvedValueOnce(text('You ate 120 g of protein, which is a lot of protein.'))
      .mockResolvedValueOnce(text('You ate 120 g of protein.'));

    await expect(insights()).resolves.toBe('You ate 120 g of protein.');
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(lastUserMessage(2)).toContain('tighten');
  });

  it('streams nothing while checking and hands the final text over once', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text('You ate 150 g of protein.'))
      .mockResolvedValueOnce(text('You ate 120 g of protein.'));
    const seen: string[] = [];

    await insights(openai, { onText: (value) => seen.push(value) });

    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('stream');
    expect(seen).toEqual(['You ate 120 g of protein.']);
  });

  it('makes one request on the free tier', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate.mockResolvedValue(text('You ate 150 g of protein.'));

    await insights({ ...openai, provider: 'gateway', baseUrl: 'https://openrouter.ai/api/v1' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('plan critique rounds', () => {
  const plan = (exerciseIds: string[]) => ({
    planTitle: 'Push',
    description: '',
    workoutPlan: [
      {
        title: 'Push',
        recurringOnWeekDay: 'monday',
        exercises: exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: 3,
          reps: 8,
          oneRepMaxPercentage: 75,
        })),
      },
    ],
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockThinking.level = 'off';
  });
  afterEach(() => jest.restoreAllMocks());

  it('makes one request at medium', async () => {
    mockThinking.level = 'medium';
    mockCreate.mockResolvedValue(text(JSON.stringify(plan(['1', '1']))));

    await generateWorkoutPlan(openai, []);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('tells the critic what code found and keeps a revision with fewer problems', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text(JSON.stringify(plan(['1', '1']))))
      .mockResolvedValueOnce(text(JSON.stringify(plan(['1', '2']))));

    const result = await generateWorkoutPlan(openai, []);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    // The user message of a structured request is escaped, quotes included.
    expect(lastUserMessage(1)).toContain('lists exercise 1 more than once.');
    expect(lastUserMessage(1)).toContain('--- ANSWER ---');
    expect(result?.workoutPlan[0].exercises.map((e) => e.exerciseId)).toEqual(['1', '2']);
  });

  it('refuses a revision with more problems', async () => {
    mockThinking.level = 'high';
    mockCreate
      .mockResolvedValueOnce(text(JSON.stringify(plan(['1', '2']))))
      .mockResolvedValueOnce(text(JSON.stringify(plan(['1', '1']))));

    const result = await generateWorkoutPlan(openai, []);

    expect(result?.workoutPlan[0].exercises.map((e) => e.exerciseId)).toEqual(['1', '2']);
  });

  it('reviews twice at tokenmaxxing', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate.mockResolvedValue(text(JSON.stringify(plan(['1', '2']))));

    await generateWorkoutPlan(openai, []);

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
