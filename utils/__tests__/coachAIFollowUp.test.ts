import {
  type CoachAIConfig,
  generateWorkoutPlan,
  getNutritionInsights,
  parsePastNutrition,
} from '../coachAI';
import { extractRecipe } from '../coachMealSteps';

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
  getNutritionInsightsPrompt: jest.fn(async () => 'DATA: protein 120 g, calories 2150 kcal'),
  createWorkoutPlanPrompt: jest.fn(async () => 'SYSTEM'),
  getParsePastNutritionPrompt: jest.fn(async () => 'SYSTEM'),
  getRecipeExtractionPrompt: jest.fn(async () => 'RECIPE SYSTEM'),
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const text = (content: string) => ({ choices: [{ message: { content } }] });
const json = (value: unknown) => text(JSON.stringify(value));
const messagesOf = (call: number): { role: string; content: string }[] =>
  mockCreate.mock.calls[call][0].messages;

describe('review rounds resend the original request plus trusted text', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockThinking.level = 'off';
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends a long plan whole as the assistant turn and the findings as the last user turn', async () => {
    mockThinking.level = 'high';
    const plan = (ids: string[]) => ({
      planTitle: 'Push',
      description: '',
      workoutPlan: [
        {
          title: 'Push',
          recurringOnWeekDay: 'monday',
          exercises: ids.map((exerciseId) => ({
            exerciseId,
            sets: 3,
            reps: 8,
            oneRepMaxPercentage: 75,
          })),
        },
      ],
    });
    const long = Array.from({ length: 150 }, (_, i) => `ex-${i}`);
    long.push('ex-0');
    const draft = plan(long);
    const draftJson = JSON.stringify(draft);
    expect(draftJson.length).toBeGreaterThan(3000);
    mockCreate
      .mockResolvedValueOnce(json(draft))
      .mockResolvedValueOnce(json(plan(long.slice(0, 150))));

    await generateWorkoutPlan(openai, []);

    const [system, ...rest] = messagesOf(1);
    expect(system).toEqual(messagesOf(0)[0]);
    const assistant = rest.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe(draftJson);
    const last = rest.at(-1)!;
    expect(last.role).toBe('user');
    expect(last.content).toContain('lists exercise ex-0 more than once.');
    expect(last.content).not.toContain('\\"');
    expect(last.content).not.toContain('--- ANSWER ---');
  });

  it('gives the fact-check the whole multi-line draft, unescaped, with the same system prompt', async () => {
    mockThinking.level = 'high';
    const draft = Array.from(
      { length: 60 },
      (_, i) => `Line ${i}: you ate "120 g" of protein, it's good.`
    ).join('\n');
    expect(draft.length).toBeGreaterThan(2000);
    mockCreate.mockResolvedValueOnce(text(draft)).mockResolvedValueOnce(text(draft));

    await getNutritionInsights(openai, '2026-11-01', '2026-11-07');

    const checkMessages = messagesOf(1);
    expect(checkMessages[0]).toEqual(messagesOf(0)[0]);
    const assistant = checkMessages.filter((m) => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
    expect(assistant[0].content).toBe(draft);
    expect(checkMessages.at(-1)!.role).toBe('user');
    expect(checkMessages.at(-1)!.content).not.toContain('\\n');
    expect(checkMessages.at(-1)!.content).not.toContain('--- DRAFT ---');
  });

  it('sends every reading to the arbiter unescaped and uncut', async () => {
    mockThinking.level = 'high';
    const entry = (n: number) => ({
      name: `Food "${n}" ${'x'.repeat(300)}`,
      calories: 100 + n,
      protein: 1,
      carbs: 2,
      fat: 3,
      fiber: 1,
    });
    const answer = (n: number) => ({
      pastNutrition: Array.from({ length: 3 }, (_, i) => ({ ...entry(n + i), date: '2026-11-01' })),
    });
    mockCreate
      .mockResolvedValueOnce(json(answer(1)))
      .mockResolvedValueOnce(json(answer(50)))
      .mockResolvedValue(json(answer(1)));

    await parsePastNutrition(openai, 'I ate things');

    const arbiterCall = mockCreate.mock.calls.length - 1;
    const content = messagesOf(arbiterCall).at(-1)!.content;
    expect(content).toContain(JSON.stringify(answer(1)));
    expect(content).toContain(JSON.stringify(answer(50)));
    expect(content).toContain('--- END OF READING 2 ---');
  });

  it('delivers a long first-look note whole', async () => {
    const notes = {
      mealCount: 1,
      scene: `A long scene. ${'plate of rice '.repeat(200)}`,
      setting: 'home',
      container: 'plate',
      containerSize: '',
      items: [{ name: 'Rice', portion: 'a fist', preparation: '', confidence: 'high' }],
      scaleCues: [],
      addedFats: [],
      extras: [],
      uncertain: [],
    };
    const { formatMealObservation } = jest.requireActual('../mealObservation');
    const formatted: string = formatMealObservation(notes);
    expect(formatted.length).toBeGreaterThan(2000);
    mockCreate.mockResolvedValue(
      json({ meals: [{ mealType: 'lunch', mealName: 'x', ingredients: [] }] })
    );

    await extractRecipe(openai, 'I had rice for lunch', [], notes);

    const all = messagesOf(0)
      .map((m) => m.content)
      .join('\n');
    expect(all).toContain(formatted);
    expect(all).toContain('I had rice for lunch');
  });
});
