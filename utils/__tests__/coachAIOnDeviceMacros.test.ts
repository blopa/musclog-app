import { AiCancelledError } from '../aiErrors';
import { type CoachAIConfig, trackMeal } from '../coachAI';

const mockSendStructured = jest.fn();
const mockGetNutritionDisplay = jest.fn();
const mockOpenAiCreate = jest.fn();

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendStructured(...args),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn().mockResolvedValue('off'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
    getNutritionDisplay: () => mockGetNutritionDisplay(),
  },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: jest.fn(async (ingredients: { foodId?: string }[]) =>
      ingredients.map(({ foodId: _foodId, ...rest }) => rest)
    ),
  },
}));
jest.mock('openai', () => {
  class APIConnectionError extends Error {}
  const OpenAI = Object.assign(
    jest.fn().mockImplementation(() => ({
      chat: { completions: { create: (...args: unknown[]) => mockOpenAiCreate(...args) } },
    })),
    { APIConnectionError }
  );

  return { __esModule: true, default: OpenAI };
});

const ON_DEVICE = { provider: 'on-device' } as unknown as CoachAIConfig;

const firstReply = {
  meals: [
    {
      mealType: 'snack',
      mealName: 'Almonds',
      ingredients: [
        { name: 'Almonds', grams: 10, kcal: 0, protein: 0, carbs: 0, fat: 0, foodId: 'null' },
      ],
    },
  ],
};
// Label per 100 g: 550 kcal = 4*20 + 4*5 + 9*50, so 10 g is 55 kcal, 2 / 0.5 / 5 g.
const labelReply = {
  foods: [{ name: 'Almonds', kcal: 550, protein: 20, carbs: 5, fat: 50 }],
};

describe('on-device missing-ingredient macros', () => {
  beforeEach(() => {
    mockSendStructured.mockReset();
    mockGetNutritionDisplay.mockReset();
  });

  it('asks for a label per 100 g by name only, in one request', async () => {
    mockGetNutritionDisplay.mockResolvedValue('11101');
    mockSendStructured.mockResolvedValueOnce(firstReply).mockResolvedValueOnce(labelReply);

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(mockSendStructured).toHaveBeenCalledTimes(2);
    const [, prompt, schema] = mockSendStructured.mock.calls[1];
    expect(prompt).toContain('per 100 g');
    expect(prompt).toContain('Almonds');
    expect(prompt).not.toMatch(/calorie|\b10\b|fiber/i);
    expect(JSON.stringify(schema.properties.foods.items.required)).toBe(
      JSON.stringify(['name', 'kcal', 'protein', 'carbs', 'fat'])
    );
    expect(result?.meals[0].ingredients[0]).toMatchObject({
      kcal: 55,
      protein: 2,
      carbs: 0.5,
      fat: 5,
      fiber: 0,
    });
  });

  it('with fiber tracked makes one more request, scales, caps and nets the carbs', async () => {
    mockGetNutritionDisplay.mockResolvedValue('11111');
    mockSendStructured
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(labelReply)
      .mockResolvedValueOnce({ foods: [{ name: ' almonds ', fiber: 4 }] });

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(mockSendStructured).toHaveBeenCalledTimes(3);
    const [, fiberPrompt, fiberSchema] = mockSendStructured.mock.calls[2];
    expect(fiberPrompt).toContain('per 100 g');
    expect(JSON.stringify(fiberSchema)).toContain('fiber');
    // 4 g/100 g at 10 g = 0.4 g; carbs 0.5 -> 0.1 net; kcal 8 + 0.4 + 45 + 0.8 = 54
    expect(result?.meals[0].ingredients[0]).toMatchObject({ fiber: 0.4, carbs: 0.1, kcal: 54 });
  });

  it('caps fiber at the food carbs', async () => {
    mockGetNutritionDisplay.mockResolvedValue('11111');
    mockSendStructured
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(labelReply)
      .mockResolvedValueOnce({ foods: [{ name: 'Almonds', fiber: 90 }] });

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(result?.meals[0].ingredients[0]).toMatchObject({ fiber: 0.5, carbs: 0, kcal: 54 });
  });

  it('makes no second request when fiber is hidden', async () => {
    // Index 3 is fiber: '11101' hides it.
    mockGetNutritionDisplay.mockResolvedValue('11101');
    mockSendStructured.mockResolvedValueOnce(firstReply).mockResolvedValueOnce(labelReply);

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(mockSendStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0]).toMatchObject({ fiber: 0, kcal: 55 });
  });

  it('keeps fiber 0 and the meal when the fiber request fails', async () => {
    mockGetNutritionDisplay.mockResolvedValue('11111');
    mockSendStructured
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(labelReply)
      .mockRejectedValueOnce(new Error('boom'));

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(result?.meals[0].ingredients[0]).toMatchObject({ fiber: 0, kcal: 55 });
  });

  it('propagates a cancel from the fiber request (no meal is returned)', async () => {
    mockGetNutritionDisplay.mockResolvedValue('11111');
    mockSendStructured
      .mockResolvedValueOnce(firstReply)
      .mockResolvedValueOnce(labelReply)
      .mockRejectedValueOnce(new AiCancelledError());

    // trackMeal turns a cancel into null (no meal), unlike a plain fiber failure, which keeps it.
    await expect(trackMeal(ON_DEVICE, 'almonds')).resolves.toBeNull();
  });

  it('keeps the old kcal and fiber schema for another provider', async () => {
    const openai = { provider: 'openai', apiKey: 'k', model: 'gpt-x' } as unknown as CoachAIConfig;
    mockOpenAiCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(firstReply) } }] })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ingredients: [
                  {
                    name: 'Almonds',
                    grams: 10,
                    kcal: 60,
                    protein: 2,
                    carbs: 0.5,
                    fat: 5,
                    fiber: 1,
                  },
                ],
              }),
            },
          },
        ],
      });

    await trackMeal(openai, 'almonds').catch(() => null);

    const bodies = mockOpenAiCreate.mock.calls.map((call) => JSON.stringify(call[0]));
    const estimate = bodies.find((body) => body.includes('estimateMissingIngredients'));
    expect(estimate).toMatch(/kcal/);
    expect(estimate).toMatch(/fiber/);
    expect(mockGetNutritionDisplay).not.toHaveBeenCalled();
  });
});
