import i18n from '@/lang/lang';

import { type CoachAIConfig, generateMealPlan, generateWorkoutPlan } from '../coachAI';

const mockCreate = jest.fn();

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
    get: jest.fn(async () => 'off'),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));
jest.mock('../prompts', () => ({
  ...jest.requireActual('../prompts'),
  getGenerateMealPlanPrompt: jest.fn(async () => 'SYSTEM'),
  createWorkoutPlanPrompt: jest.fn(async () => 'SYSTEM'),
}));

const config = (language: string): CoachAIConfig => ({
  provider: 'openai',
  model: 'gpt',
  apiKey: 'k',
  language,
});

const planReply = {
  choices: [{ message: { content: JSON.stringify({ meals: [], workouts: [], planName: 'P' }) } }],
};

// Alternating turns, each far longer than a few hundred characters, ending on the person's ask.
const filler = (label: string) => `${label} ${'word '.repeat(110)}`.trim();
const conversation = [
  { role: 'user' as const, content: filler('turn-one') },
  { role: 'coach' as const, content: filler('turn-two') },
  { role: 'user' as const, content: filler('turn-three') },
  { role: 'coach' as const, content: filler('turn-four') },
  { role: 'user' as const, content: filler('turn-five') },
  { role: 'coach' as const, content: filler('turn-six') },
  { role: 'user' as const, content: "Make it vegetarian, I can't eat fish. Say \"no\" to dairy." },
];

const sentMessage = (): string => mockCreate.mock.calls[0][0].messages.at(-1).content as string;

describe('plan requests carry the whole conversation', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(planReply);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps the newest message and the closing instruction of a meal plan request', async () => {
    await generateMealPlan(config('en-US'), conversation, undefined, 'nutrition');

    const message = sentMessage();
    expect(message).toContain('turn-one');
    expect(message).toContain('turn-six');
    expect(message).toContain('Make it vegetarian');
    expect(message.trimEnd().endsWith('Generate the meal plan.')).toBe(true);
  });

  it('sends the person’s own words as typed, not escaped', async () => {
    await generateMealPlan(config('en-US'), conversation, undefined, 'nutrition');

    const message = sentMessage();
    expect(message).toContain("I can't eat fish");
    expect(message).toContain('Say "no" to dairy.');
    expect(message).not.toContain("\\'");
    expect(message).not.toContain('\\n');
  });

  it('keeps the newest message of a workout plan request, with its instruction as written', async () => {
    await generateWorkoutPlan(config('fr-FR'), conversation, 'exercise');

    const message = sentMessage();
    const instruction = i18n.t('coach.aiInstructions.generateWorkoutPlanWithHistory', {
      lng: 'fr-FR',
    });
    expect(instruction).toContain("'");
    expect(message).toContain('Make it vegetarian');
    expect(message.trimEnd().endsWith(instruction)).toBe(true);
  });
});
