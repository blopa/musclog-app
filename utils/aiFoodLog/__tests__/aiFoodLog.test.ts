import {
  buildFoodLogDocumentSchema,
  FOOD_LOG_MAJOR,
  FOOD_LOG_SCHEMA_ID,
  MAX_FOOD_LOG_BYTES,
  MAX_FOODS,
  MEAL_NAME_MAX,
} from '../contract';
import {
  buildFoodLogInstructions,
  buildFoodLogJsonSchema,
  FOOD_LOG_FILE_NAME,
  FOOD_LOG_INSTRUCTIONS_REVISION,
} from '../instructions';
import {
  canGroupFoods,
  defaultGrouping,
  partitionResolved,
  resolveGrouping,
  storedCarbs,
  sumIngredients,
  toBatchIngredients,
  toIngredients,
} from '../logPlan';
import { parseFoodLogText } from '../parse';

const chicken = {
  name: 'Grilled chicken breast',
  grams: 150,
  calories: 248,
  protein: 46,
  carbs: 0,
  fat: 5.4,
  fiber: 0,
};
const rice = { name: 'White rice', grams: 200, calories: 260, protein: 5, carbs: 56, fat: 0.6 };

const document = (overrides: Record<string, unknown> = {}) => ({
  schema: FOOD_LOG_SCHEMA_ID,
  version: FOOD_LOG_MAJOR,
  foods: [chicken, rice],
  ...overrides,
});

const parse = (value: unknown) => parseFoodLogText(JSON.stringify(value));

describe('parseFoodLogText', () => {
  it('reads a log and keeps the documented fields', () => {
    const result = parse(document({ mealType: 'lunch', mealName: '  Chicken and rice  ' }));

    expect(result).toEqual({
      ok: true,
      skippedFoods: 0,
      log: {
        mealType: 'lunch',
        mealName: 'Chicken and rice',
        foods: [chicken, rice],
      },
    });
  });

  it('finds the JSON inside a code fence and the prose around it', () => {
    const text = `Here is your file:\n\`\`\`json\n${JSON.stringify(document())}\n\`\`\`\nEnjoy!`;

    expect(parseFoodLogText(text)).toMatchObject({ ok: true, log: { foods: [chicken, rice] } });
  });

  it('accepts numbers written as strings, with a decimal comma', () => {
    const result = parse(
      document({
        foods: [
          { name: 'Milk', grams: '250', calories: '122,5', protein: '8', carbs: '12', fat: 5 },
        ],
      })
    );

    expect(result).toMatchObject({
      ok: true,
      log: {
        foods: [{ name: 'Milk', grams: 250, calories: 122.5, protein: 8, carbs: 12, fat: 5 }],
      },
    });
  });

  it('rounds to one decimal and leaves optional fields out when absent', () => {
    const result = parse(
      document({
        foods: [{ name: 'Oats', grams: 40.04, calories: 151.26, protein: 5, carbs: 27, fat: 3 }],
      })
    );

    expect(result).toMatchObject({ ok: true, log: { foods: [{ grams: 40, calories: 151.3 }] } });
    expect(result.ok && 'fiber' in result.log.foods[0]).toBe(false);
  });

  it('leaves out a food whose numbers are missing, negative or out of range, and counts it', () => {
    const result = parse(
      document({
        foods: [
          chicken,
          { name: 'No macros', grams: 100 },
          { name: 'Negative', grams: 100, calories: -5, protein: 1, carbs: 1, fat: 1 },
          { name: 'Too heavy', grams: 99999, calories: 10, protein: 1, carbs: 1, fat: 1 },
          { name: 'Too much protein', grams: 100, calories: 10, protein: 5000, carbs: 1, fat: 1 },
          { grams: 100, calories: 10, protein: 1, carbs: 1, fat: 1 },
          'not a food',
        ],
      })
    );

    expect(result).toMatchObject({ ok: true, skippedFoods: 6, log: { foods: [chicken] } });
  });

  it('keeps a food that names a foundation id and leaves the macros to Musclog', () => {
    const result = parse(
      document({ foods: [{ name: 'Banana', grams: 118, foodId: 'food-123' }, rice] })
    );

    expect(result).toMatchObject({
      ok: true,
      skippedFoods: 0,
      log: { foods: [{ name: 'Banana', grams: 118, foodId: 'food-123' }, rice] },
    });
  });

  it('drops the optional fiber when it is unusable instead of rejecting the food', () => {
    const result = parse(document({ foods: [{ ...rice, fiber: -2 }] }));

    expect(result).toMatchObject({ ok: true, skippedFoods: 0 });
    expect(result.ok && result.log.foods[0].fiber).toBeUndefined();
  });

  it('ignores a meal type it does not know and an empty meal name', () => {
    const result = parse(document({ mealType: 'brunch', mealName: '   ' }));

    expect(result.ok && result.log).toEqual({ foods: [chicken, rice] });
  });

  it('caps the number of foods and counts the extra ones as skipped', () => {
    const foods = Array.from({ length: MAX_FOODS + 3 }, (_, index) => ({
      ...rice,
      name: `Food ${index}`,
    }));
    const result = parse(document({ foods }));

    expect(result).toMatchObject({ ok: true, skippedFoods: 3 });
    expect(result.ok && result.log.foods).toHaveLength(MAX_FOODS);
  });

  it('trims a long meal name to the limit', () => {
    const result = parse(document({ mealName: 'x'.repeat(MEAL_NAME_MAX + 20) }));

    expect(result.ok && result.log.mealName).toHaveLength(MEAL_NAME_MAX);
  });

  it.each([
    ['empty text', '', 'empty'],
    ['plain prose', 'Sure! Here is a nice recipe.', 'notJson'],
    ['broken JSON', '{"schema": "musclog-food-log",', 'notJson'],
  ])('refuses %s', (_label, text, error) => {
    expect(parseFoodLogText(text)).toEqual({ ok: false, error });
  });

  it('refuses a file that is not a food log, or is from a newer version', () => {
    expect(parse({ schema: 'musclog-workout-plan', version: 1, foods: [chicken] })).toEqual({
      ok: false,
      error: 'wrongSchema',
    });
    expect(parse(document({ version: 'one' }))).toEqual({ ok: false, error: 'invalidVersion' });
    expect(parse(document({ version: FOOD_LOG_MAJOR + 1 }))).toEqual({
      ok: false,
      error: 'newerVersion',
    });
  });

  it('refuses a log with no foods, or none that can be read', () => {
    expect(parse(document({ foods: [] }))).toEqual({ ok: false, error: 'invalidLog' });
    expect(parse(document({ foods: undefined }))).toEqual({ ok: false, error: 'invalidLog' });
    expect(parse(document({ foods: [{ name: 'Mystery', grams: 100 }] }))).toEqual({
      ok: false,
      error: 'noFoods',
    });
  });

  it('refuses an oversized file before parsing it', () => {
    expect(parseFoodLogText('x'.repeat(MAX_FOOD_LOG_BYTES + 1))).toEqual({
      ok: false,
      error: 'tooLarge',
    });
  });
});

describe('the document schema', () => {
  it('accepts exactly what the instructions describe', () => {
    const schema = buildFoodLogDocumentSchema({ withFoodIds: false });

    expect(schema.safeParse(document({ mealType: 'dinner', mealName: 'Plate' })).success).toBe(
      true
    );
  });

  it('forbids stray keys and macro-less foods unless foundation ids are on offer', () => {
    const plain = buildFoodLogDocumentSchema({ withFoodIds: false });
    const withIds = buildFoodLogDocumentSchema({ withFoodIds: true });
    const matched = document({ foods: [{ name: 'Banana', grams: 118, foodId: 'food-123' }] });

    expect(plain.safeParse(document({ extra: true })).success).toBe(false);
    expect(plain.safeParse(matched).success).toBe(false);
    expect(withIds.safeParse(matched).success).toBe(true);
  });
});

describe('buildFoodLogInstructions', () => {
  const instructions = buildFoodLogInstructions({ language: 'pt-BR' });

  it('names the contract, its revision, the language and the file to hand back', () => {
    expect(instructions).toContain(`schema ${FOOD_LOG_SCHEMA_ID} v${FOOD_LOG_MAJOR}`);
    expect(instructions).toContain(`instructions revision ${FOOD_LOG_INSTRUCTIONS_REVISION}`);
    expect(instructions).toContain('"pt-BR"');
    expect(instructions).toContain(FOOD_LOG_FILE_NAME);
  });

  it('states the net-carbs convention and the per-amount totals the importer relies on', () => {
    expect(instructions).toContain('NET carbohydrate');
    expect(instructions).toContain('total carbohydrate MINUS fiber');
    expect(instructions).toContain('NOT per 100 g');
    expect(instructions).toContain('2 per gram of fiber');
  });

  it('keeps the date and time out of the file', () => {
    expect(instructions).toContain('Never include a date or a time');
  });

  it('embeds a JSON Schema the app can read back', () => {
    const embedded = instructions.slice(
      instructions.indexOf('## JSON Schema') + '## JSON Schema'.length
    );
    const schema = JSON.parse(embedded.trim());

    expect(schema.properties.schema).toEqual({ const: FOOD_LOG_SCHEMA_ID });
    expect(schema.properties.version).toEqual({ const: FOOD_LOG_MAJOR });
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['schema', 'version', 'foods']);
  });

  it('offers no foundation foods, and no foodId, unless it was given a list', () => {
    expect(instructions).not.toContain('Foods Musclog already knows');
    expect(instructions).not.toContain('foodId');
    expect(buildFoodLogJsonSchema({ withFoodIds: false })).not.toHaveProperty(
      'properties.foods.items.properties.foodId'
    );
  });

  it('lists the foundation foods by id and name, and lets those foods omit their macros', () => {
    const withFoods = buildFoodLogInstructions({
      language: 'en-US',
      foundationFoods: [
        { id: 'food-1', name: 'Banana, raw' },
        { id: 'food-2', name: 'Egg, whole' },
      ],
    });

    expect(withFoods).toContain('Foods Musclog already knows');
    expect(withFoods).toContain(
      '[{"id":"food-1","name":"Banana, raw"},{"id":"food-2","name":"Egg, whole"}]'
    );
    expect(withFoods).toContain('Never invent an id');

    const schema = buildFoodLogJsonSchema({ withFoodIds: true }) as {
      properties: { foods: { items: { properties: object; required: string[] } } };
    };
    expect(schema.properties.foods.items.properties).toHaveProperty('foodId');
    expect(schema.properties.foods.items.required).toEqual(['name', 'grams']);
  });
});

describe('planning a log', () => {
  const log = (
    parse(document({ foods: [chicken, rice, { name: 'Banana', grams: 118, foodId: 'f1' }] })) as {
      ok: true;
      log: { foods: Parameters<typeof toIngredients>[0] };
    }
  ).log;

  it('shapes foods for the foundation lookup, remembering who brought their own numbers', () => {
    const ingredients = toIngredients(log.foods);

    expect(ingredients[0]).toEqual({
      name: chicken.name,
      kcal: 248,
      protein: 46,
      carbs: 0,
      fat: 5.4,
      fiber: 0,
      grams: 150,
      hasOwnMacros: true,
    });
    expect(ingredients[2]).toMatchObject({
      name: 'Banana',
      kcal: 0,
      foodId: 'f1',
      hasOwnMacros: false,
    });
  });

  it('keeps a matched food and drops one whose id vanished and who has no numbers', () => {
    const [chickenIngredient, , banana] = toIngredients(log.foods);
    const lookedUp = { ...banana, kcal: 105, carbs: 27 };
    const lost = { ...banana };
    delete lost.foodId;

    expect(partitionResolved([chickenIngredient, lookedUp])).toEqual({
      usable: [chickenIngredient, lookedUp],
      unresolved: [],
    });
    expect(partitionResolved([chickenIngredient, lost])).toEqual({
      usable: [chickenIngredient],
      unresolved: [lost],
    });
  });

  it('keeps a food with numbers of its own even when its foundation id did not resolve', () => {
    const ownNumbers = toIngredients([{ ...rice, foodId: 'gone' }]);
    delete ownNumbers[0].foodId;

    expect(partitionResolved(ownNumbers).usable).toHaveLength(1);
  });

  it('adds the macros up', () => {
    expect(sumIngredients(toIngredients([chicken, rice]))).toEqual({
      kcal: 508,
      protein: 51,
      carbs: 56,
      fat: 6,
      fiber: 0,
    });
  });

  it('totals carbs the way the diary will show them: net carbs plus fiber, foundation foods as they are', () => {
    const own = toIngredients([{ ...rice, carbs: 50, fiber: 4 }]);
    const matched = toIngredients([
      { name: 'Banana', grams: 118, foodId: 'f1', carbs: 27, fiber: 3 },
    ]);

    expect(storedCarbs(own[0])).toBe(54);
    // A matched food's carbs come from Musclog already including their fiber.
    expect(storedCarbs(matched[0])).toBe(27);
    expect(sumIngredients([...own, ...matched])).toMatchObject({ carbs: 81, fiber: 7 });
  });

  it('renames energy to calories for the batch writer and carries the foundation id', () => {
    const [banana] = toIngredients([{ name: 'Banana', grams: 118, foodId: 'f1', calories: 105 }]);

    expect(toBatchIngredients([banana])).toEqual([
      {
        name: 'Banana',
        calories: 105,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        grams: 118,
        foodId: 'f1',
      },
    ]);
    expect(toBatchIngredients(toIngredients([rice]))[0]).not.toHaveProperty('foodId');
  });
});

describe('grouping foods into a meal', () => {
  it('needs at least two foods', () => {
    expect(canGroupFoods(1)).toBe(false);
    expect(canGroupFoods(2)).toBe(true);
  });

  it('starts grouped only when the assistant named the meal and there is more than one food', () => {
    expect(defaultGrouping(3, 'Chicken bowl')).toEqual({ group: true, mealName: 'Chicken bowl' });
    expect(defaultGrouping(3)).toEqual({ group: false, mealName: '' });
    expect(defaultGrouping(1, 'Chicken bowl')).toEqual({ group: false, mealName: 'Chicken bowl' });
  });

  it('logs loose entries for one food or a switch left off', () => {
    expect(resolveGrouping([chicken], { group: true, mealName: 'Plate' })).toEqual({
      grouped: false,
    });
    expect(resolveGrouping([chicken, rice], { group: false, mealName: 'Plate' })).toEqual({
      grouped: false,
    });
  });

  it('names a grouped meal with what the person typed, else with its foods', () => {
    expect(resolveGrouping([chicken, rice], { group: true, mealName: '  Plate  ' })).toEqual({
      grouped: true,
      loggedMealName: 'Plate',
    });
    expect(resolveGrouping([chicken, rice], { group: true, mealName: '   ' })).toEqual({
      grouped: true,
      loggedMealName: 'Grilled chicken breast, White rice',
    });
  });

  it('keeps a name built from many foods within the meal-name limit', () => {
    const foods = Array.from({ length: 12 }, (_, index) => ({
      name: `Ingredient number ${index}`,
    }));
    const result = resolveGrouping(foods, { group: true, mealName: '' });

    expect(result.grouped && result.loggedMealName.length).toBeLessThanOrEqual(MEAL_NAME_MAX);
    expect(result.grouped && result.loggedMealName.endsWith('…')).toBe(true);
  });
});
