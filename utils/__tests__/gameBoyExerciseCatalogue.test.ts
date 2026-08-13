import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import exercisesData from '@/data/exercisesData.json';

const repositoryRoot = join(__dirname, '..', '..');

describe('Game Boy exercise catalogue', () => {
  it('generates only current-catalogue exercises marked popular', () => {
    const generatedHeader = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/exercises.h'),
      'utf8'
    );
    const generatedSource = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/exercises.c'),
      'utf8'
    );
    const workoutSource = readFileSync(
      join(repositoryRoot, 'gameboy/src/features/workouts/workouts.c'),
      'utf8'
    );
    const popularExercises = exercisesData.filter(({ isPopular }) => isPopular === true);
    const exerciseTable = generatedSource.slice(
      generatedSource.indexOf('const exercise_t exercises')
    );
    const generatedRows = [...exerciseTable.matchAll(/\{\s*"([^"]+)"[\s\S]*?\/\* (\d+) \*\//g)];

    expect(popularExercises).toHaveLength(100);
    expect(generatedHeader).toContain('#define EXERCISE_COUNT 100u');
    expect(generatedRows.map((match) => match[1])).toEqual(
      popularExercises.map(({ __exerciseName }) => __exerciseName)
    );
    expect(generatedRows.map((match) => Number(match[2]))).toEqual(
      popularExercises.map(({ exerciseIndex }) => exerciseIndex)
    );
    expect(generatedHeader).not.toContain('EX_MUSCLE_CORE');

    const filterLabels = workoutSource
      .match(/MUSCLE_FILTER_LABELS[^=]*=\s*\{([\s\S]*?)\};/)?.[1]
      .match(/"([^"]+)"/g)
      ?.map((label) => label.slice(1, -1));
    const expectedFilterLabels = [
      ...new Set(popularExercises.map(({ muscleGroup }) => muscleGroup)),
    ]
      .sort()
      .map((muscleGroup) => muscleGroup.replaceAll('_', ' ').toUpperCase());
    expect(filterLabels).toEqual(expectedFilterLabels);
  });

  it('keeps the generator pointed at the current catalogue and its popularity flag', () => {
    const generator = readFileSync(join(repositoryRoot, 'gameboy/tools/gen-exercises.mjs'), 'utf8');

    expect(generator).toContain("const SOURCE_FILE = 'exercisesData.json';");
    expect(generator).toContain('row.isPopular === true');
    expect(generator).not.toContain("const SOURCE_FILE = 'legacyExercisesData.json';");
  });
});
