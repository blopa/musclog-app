import { notifyUserFacingAiError } from '../aiErrorNotice';
import * as coachAI from '../coachAI';
import { handleError } from '../handleError';

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
jest.mock('@/utils/aiImage', () => ({
  prepareOwnKeyImage: jest.fn(async (base64: string, mimeType: string) => ({ base64, mimeType })),
}));
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
  getNutritionInsightsPrompt: jest.fn(async () => 'SYSTEM'),
  getWorkoutInsightsPrompt: jest.fn(async () => 'SYSTEM'),
  getRecentWorkoutInsightsPromptByLogId: jest.fn(async () => 'SYSTEM'),
  getRecentWorkoutsInsightsPrompt: jest.fn(async () => 'SYSTEM'),
  getWorkoutVolumeInsightsPrompt: jest.fn(async () => 'SYSTEM'),
  getMealCritiquePrompt: jest.fn(async () => 'SYSTEM'),
  getCalculateNextWorkoutVolumePrompt: jest.fn(async () => 'SYSTEM'),
  getParsePastWorkoutsPrompt: jest.fn(async () => 'SYSTEM'),
  getParsePastNutritionPrompt: jest.fn(async () => 'SYSTEM'),
  getRetrospectiveNutritionPrompt: jest.fn(async () => 'SYSTEM'),
  withCustomPrompts: jest.fn(async (prompt: string) => prompt),
}));

const config: coachAI.CoachAIConfig = {
  provider: 'openai',
  model: 'gpt',
  apiKey: 'k',
  language: 'en-US',
};
const totals = { calories: 500, protein: 30, carbs: 50, fat: 15 };

// One entry per user-facing AI function: its exported name and how to call it.
const FUNCTIONS: [string, () => Promise<unknown>][] = [
  ['getNutritionInsights', () => coachAI.getNutritionInsights(config, '2026-11-01', '2026-11-07')],
  ['getWorkoutInsights', () => coachAI.getWorkoutInsights(config, 'Legs')],
  ['getRecentWorkoutInsights', () => coachAI.getRecentWorkoutInsights(config, 'log-1')],
  [
    'getRecentWorkoutsInsights',
    () => coachAI.getRecentWorkoutsInsights(config, '2026-11-01', '2026-11-07'),
  ],
  ['getWorkoutVolumeInsights', () => coachAI.getWorkoutVolumeInsights(config, 'Legs')],
  ['getMealCritique', () => coachAI.getMealCritique(config, 'lunch', [], totals)],
  ['calculateNextWorkoutVolume', () => coachAI.calculateNextWorkoutVolume(config, 'Legs', {})],
  ['extractMacrosFromLabelPhoto', () => coachAI.extractMacrosFromLabelPhoto(config, 'AAAA')],
  ['extractMacrosFromLabelText', () => coachAI.extractMacrosFromLabelText(config, 'Protein 10 g')],
  ['parsePastWorkouts', () => coachAI.parsePastWorkouts(config, 'bench 5x5', [])],
  ['parsePastNutrition', () => coachAI.parsePastNutrition(config, 'two eggs')],
  [
    'parseRetrospectiveNutrition',
    () => coachAI.parseRetrospectiveNutrition(config, 'two eggs', '2026-11-01'),
  ],
  ['generateMealPlan', () => coachAI.generateMealPlan(config, [])],
  ['generateWorkoutPlan', () => coachAI.generateWorkoutPlan(config, [])],
];

describe('a failing user-facing AI function', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    jest.mocked(handleError).mockClear();
    jest.mocked(notifyUserFacingAiError).mockClear();
    mockCreate.mockRejectedValue(Object.assign(new Error('boom'), { status: 400 }));
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(FUNCTIONS)(
    '%s answers null, tells the person and reports to Sentry',
    async (name, run) => {
      await expect(run()).resolves.toBeNull();

      expect(notifyUserFacingAiError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        `coachAI.${name}`,
        expect.anything()
      );
    }
  );
});
