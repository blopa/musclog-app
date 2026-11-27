/* eslint-disable simple-import-sort/imports -- Install the shared database mocks before importing services. */
// The real translation over an in-memory database: which built-in rows change, what their
// `updatedAt` says about whether the person touched them, and that search still finds them.
import '@/database/services/__tests__/cycleTestSetup';

import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type ExerciseAlias from '@/database/models/ExerciseAlias';
import type Food from '@/database/models/Food';
import { appExerciseId } from '@/utils/exerciseImage';

import exercisesEnUs from '@/data/exercisesEnUS.json';
import exercisesPtBr from '@/data/exercisesPtBr.json';
import commonFoundationFoods from '@/data/common_foundation_foods.json';
import usdaFoundationFoods from '@/data/usda_foundation_foods.json';
import foundationFoodsPtBr from '@/data/foundationFoodsPtBr.json';

import { CatalogueTranslationService } from '../CatalogueTranslationService';

// Corn: a seeded foundation food whose English and pt-BR copies are read from the data files.
const CORN_EXTERNAL_ID = '2122593';
const englishCorn = [...usdaFoundationFoods, ...commonFoundationFoods].find(
  (row) => row.external_id === CORN_EXTERNAL_ID
)!;
const ptCorn = foundationFoodsPtBr.find((row) => row.externalId === CORN_EXTERNAL_ID)!;

// 3/4 Sit-Up: a catalogue exercise, English and pt-BR copies from the locale files.
const SIT_UP_SLUG = '3_4_Sit-Up';
const englishSitUp = exercisesEnUs.find((row) => row.exerciseSlug === SIT_UP_SLUG)!;
const ptSitUp = exercisesPtBr.find((row) => row.exerciseSlug === SIT_UP_SLUG)!;
const SIT_UP_ID = appExerciseId(SIT_UP_SLUG);

const EXPECTED_PT_CORN = { name: ptCorn.name, description: ptCorn.description };
const EXPECTED_EN_CORN = { name: englishCorn.name, description: englishCorn.description };

type Stamps = { createdAt?: number; updatedAt?: number };

async function createFood(
  overrides: Partial<Food> & { source?: string; externalId?: string } & Stamps = {}
): Promise<Food> {
  const now = 1_000;
  return database.write(() =>
    database.get<Food>('foods').create((food) => {
      food.name = overrides.name ?? englishCorn.name;
      food.description = overrides.description ?? englishCorn.description;
      food.externalId = overrides.externalId ?? CORN_EXTERNAL_ID;
      food.source = overrides.source ?? 'foundation';
      food.calories = 86;
      food.protein = 3.2;
      food.carbs = 19;
      food.fat = 1.2;
      food.fiber = 2.7;
      food.micros = {};
      food.isAiGenerated = false;
      food.isFavorite = false;
      food.createdAt = overrides.createdAt ?? now;
      food.updatedAt = overrides.updatedAt ?? now;
      if (overrides.deletedAt !== undefined) {
        food.deletedAt = overrides.deletedAt;
      }
    })
  );
}

async function createExercise(
  id: string,
  overrides: { name: string; description: string; source?: string } & Stamps
): Promise<Exercise> {
  const now = 1_000;
  return database.write(() =>
    database.get<Exercise>('exercises').create((exercise) => {
      exercise._raw.id = id;
      exercise.name = overrides.name;
      exercise.description = overrides.description;
      exercise.muscleGroup = 'abdomen' as Exercise['muscleGroup'];
      exercise.equipmentType = 'body only' as Exercise['equipmentType'];
      exercise.mechanicType = 'compound' as Exercise['mechanicType'];
      exercise.source = (overrides.source ?? 'app') as Exercise['source'];
      exercise.loadMultiplier = 0.5;
      exercise.searchText = '';
      exercise.createdAt = overrides.createdAt ?? now;
      exercise.updatedAt = overrides.updatedAt ?? now;
    })
  );
}

async function createAlias(exerciseId: string, alias: string) {
  return database.write(() =>
    database.get<ExerciseAlias>('exercise_aliases').create((row) => {
      row.exerciseId = exerciseId;
      row.alias = alias;
      row.createdAt = 1_000;
      row.updatedAt = 1_000;
    })
  );
}

const reload = <T extends { id: string }>(model: T, table: string) =>
  database.get<T>(table).find(model.id);

describe('CatalogueTranslationService.translate', () => {
  beforeEach(async () => {
    await database.write(() => database.unsafeResetDatabase());
  });

  it('renames an untouched foundation food and app exercise to the pt-BR copy', async () => {
    const food = await createFood();
    const exercise = await createExercise(SIT_UP_ID, {
      name: englishSitUp.name,
      description: englishSitUp.description,
    });

    const result = await CatalogueTranslationService.translate('pt-BR');

    expect(result).toEqual({ foods: 1, exercises: 1 });

    const translatedFood = await reload(food, 'foods');
    expect(translatedFood.name).toBe(EXPECTED_PT_CORN.name);
    expect(translatedFood.description).toBe(EXPECTED_PT_CORN.description);
    expect(translatedFood.updatedAt).toBe(translatedFood.createdAt);

    const translatedExercise = await reload(exercise, 'exercises');
    expect(translatedExercise.name).toBe(ptSitUp.name);
    expect(translatedExercise.description).toBe(ptSitUp.description);
    expect(translatedExercise.updatedAt).toBe(translatedExercise.createdAt);
  });

  it('translating back to en-US restores the English words', async () => {
    const food = await createFood();
    const exercise = await createExercise(SIT_UP_ID, {
      name: englishSitUp.name,
      description: englishSitUp.description,
    });

    await CatalogueTranslationService.translate('pt-BR');
    const result = await CatalogueTranslationService.translate('en-US');

    expect(result).toEqual({ foods: 1, exercises: 1 });

    const restoredFood = await reload(food, 'foods');
    expect(restoredFood.name).toBe(EXPECTED_EN_CORN.name);
    expect(restoredFood.description).toBe(EXPECTED_EN_CORN.description);

    const restoredExercise = await reload(exercise, 'exercises');
    expect(restoredExercise.name).toBe(englishSitUp.name);
    expect(restoredExercise.description).toBe(englishSitUp.description);
  });

  it('translates a touched row that still holds bundled words and bumps its updatedAt', async () => {
    const food = await createFood({ createdAt: 1_000, updatedAt: 2_000 });
    const exercise = await createExercise(SIT_UP_ID, {
      name: englishSitUp.name,
      description: englishSitUp.description,
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    await CatalogueTranslationService.translate('pt-BR');

    const translatedFood = await reload(food, 'foods');
    expect(translatedFood.name).toBe(EXPECTED_PT_CORN.name);
    expect(translatedFood.updatedAt).toBeGreaterThan(2_000);

    const translatedExercise = await reload(exercise, 'exercises');
    expect(translatedExercise.name).toBe(ptSitUp.name);
    expect(translatedExercise.updatedAt).toBeGreaterThan(2_000);
  });

  it('keeps a name the person rewrote while translating its unchanged bundled description', async () => {
    const food = await createFood({
      name: 'My sweetcorn',
      description: englishCorn.description,
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    const result = await CatalogueTranslationService.translate('pt-BR');

    expect(result.foods).toBe(1);
    const translatedFood = await reload(food, 'foods');
    expect(translatedFood.name).toBe('My sweetcorn');
    expect(translatedFood.description).toBe(EXPECTED_PT_CORN.description);
  });

  it('leaves rows from other sources and deleted rows untouched', async () => {
    const userFood = await createFood({ source: 'user' });
    const aiFood = await createFood({ source: 'ai' });
    const deletedFood = await createFood({ deletedAt: 5_000 });
    const userExercise = await createExercise('custom-plank-id', {
      name: englishSitUp.name,
      description: englishSitUp.description,
      source: 'user',
    });
    const deletedExercise = await database.write(() =>
      database.get<Exercise>('exercises').create((exercise) => {
        exercise._raw.id = appExerciseId('Plank');
        exercise.name = englishSitUp.name;
        exercise.description = englishSitUp.description;
        exercise.muscleGroup = 'abdomen' as Exercise['muscleGroup'];
        exercise.equipmentType = 'body only' as Exercise['equipmentType'];
        exercise.mechanicType = 'compound' as Exercise['mechanicType'];
        exercise.source = 'app' as Exercise['source'];
        exercise.loadMultiplier = 0.5;
        exercise.searchText = '';
        exercise.createdAt = 1_000;
        exercise.updatedAt = 1_000;
        exercise.deletedAt = 5_000;
      })
    );

    const result = await CatalogueTranslationService.translate('pt-BR');

    expect(result).toEqual({ foods: 0, exercises: 0 });
    expect((await reload(userFood, 'foods')).name).toBe(englishCorn.name);
    expect((await reload(aiFood, 'foods')).name).toBe(englishCorn.name);
    expect((await reload(deletedFood, 'foods')).name).toBe(englishCorn.name);
    expect((await reload(userExercise, 'exercises')).name).toBe(englishSitUp.name);
    expect((await reload(deletedExercise, 'exercises')).name).toBe(englishSitUp.name);
  });

  it('rebuilds the exercise search text in the new language and keeps the person’s alias', async () => {
    const exercise = await createExercise(SIT_UP_ID, {
      name: englishSitUp.name,
      description: englishSitUp.description,
    });
    await createAlias(exercise.id, 'Crunch Deluxe');

    await CatalogueTranslationService.translate('pt-BR');

    const translated = await reload(exercise, 'exercises');
    const words = (translated.searchText ?? '').split(/\s+/);
    expect(words).toContain('abdominais');
    expect(words).toContain('deluxe');
  });

  it('returns zero counts when run a second time', async () => {
    await createFood();
    await createExercise(SIT_UP_ID, {
      name: englishSitUp.name,
      description: englishSitUp.description,
    });

    await expect(CatalogueTranslationService.translate('pt-BR')).resolves.toEqual({
      foods: 1,
      exercises: 1,
    });
    await expect(CatalogueTranslationService.translate('pt-BR')).resolves.toEqual({
      foods: 0,
      exercises: 0,
    });
  });
});
