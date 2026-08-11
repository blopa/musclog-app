import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import exercisesData from '@/data/exercisesData.json';
import legacyExercisesData from '@/data/legacyExercisesData.json';
import {
  appExerciseId,
  buildExerciseCloudUrl,
  buildExerciseImagePath,
  buildLegacyExerciseCloudUrl,
  exerciseSlugFromId,
} from '@/utils/exerciseImage';
import { exerciseImageCacheKey } from '@/utils/exerciseImageCache';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { document: '/tmp' },
}));

jest.mock('expo-file-system/legacy', () => ({ downloadAsync: jest.fn() }));

const repositoryRoot = join(__dirname, '..', '..');
const imageRoot = join(repositoryRoot, 'public', 'images', 'exercises');

describe('exercise image identity', () => {
  it('round-trips catalogue slugs through the disjoint app id namespace', () => {
    expect(appExerciseId('Barbell_Bench_Press_-_Medium_Grip')).toBe(
      'fx-Barbell_Bench_Press_-_Medium_Grip'
    );
    expect(exerciseSlugFromId('fx-Barbell_Bench_Press_-_Medium_Grip')).toBe(
      'Barbell_Bench_Press_-_Medium_Grip'
    );
    expect(exerciseSlugFromId('42')).toBeNull();
    expect(exerciseSlugFromId('fx-')).toBeNull();
  });

  it('builds the hosted start/end and legacy URL conventions', () => {
    expect(buildExerciseImagePath('Pullups')).toBe('/images/exercises/Pullups/0.webp');
    expect(buildExerciseCloudUrl('Pullups')).toBe(
      'https://musclog.app/images/exercises/Pullups/0.webp'
    );
    expect(buildExerciseCloudUrl('Pullups', 1)).toBe(
      'https://musclog.app/images/exercises/Pullups/1.webp'
    );
    expect(buildLegacyExerciseCloudUrl(12)).toBe(
      'https://musclog.app/images/exercises/legacy/exercise12.webp'
    );
  });

  it('keeps website assets on the current Expo base instead of the production origin', () => {
    expect(withExpoBaseUrl(buildExerciseImagePath('Pullups'), '/musclog-app')).toBe(
      '/musclog-app/images/exercises/Pullups/0.webp'
    );
    expect(withExpoBaseUrl(buildExerciseImagePath('Pullups'), '/')).toBe(
      '/images/exercises/Pullups/0.webp'
    );
  });

  it('keeps the slug in cache keys so every 0.webp file remains distinct', () => {
    expect(exerciseImageCacheKey(buildExerciseCloudUrl('Pullups'))).toBe('Pullups__0.webp');
    expect(exerciseImageCacheKey(buildExerciseCloudUrl('Barbell_Deadlift'))).toBe(
      'Barbell_Deadlift__0.webp'
    );
    expect(exerciseImageCacheKey(buildLegacyExerciseCloudUrl(12))).toBe('legacy__exercise12.webp');
  });
});

describe('committed exercise image catalogue', () => {
  it('contains both WebP frames for every free-exercise-db slug', () => {
    for (const { __freeExerciseDbId } of exercisesData) {
      expect(existsSync(join(imageRoot, __freeExerciseDbId, '0.webp'))).toBe(true);
      expect(existsSync(join(imageRoot, __freeExerciseDbId, '1.webp'))).toBe(true);
    }

    const catalogueFrames = readdirSync(imageRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'legacy')
      .flatMap((entry) => readdirSync(join(imageRoot, entry.name)));
    expect(catalogueFrames).toHaveLength(exercisesData.length * 2);
  });

  it('keeps one WebP illustration for every frozen legacy exercise', () => {
    for (const { exerciseIndex } of legacyExercisesData) {
      expect(existsSync(join(imageRoot, 'legacy', `exercise${exerciseIndex}.webp`))).toBe(true);
    }

    expect(readdirSync(join(imageRoot, 'legacy'))).toHaveLength(legacyExercisesData.length);
  });
});

describe('exercise catalogue rendering architecture', () => {
  it('paginates the management modal instead of directly fetching every exercise', () => {
    const source = readFileSync(
      join(repositoryRoot, 'components', 'modals', 'ExercisesModal.tsx'),
      'utf8'
    );

    expect(source).toContain('useExercises({');
    expect(source).toContain('onPress={loadMore}');
    expect(source).not.toContain("database.get<Exercise>('exercises')");
  });

  it('renders website photos through the shared slug URL helper with deferred cards', () => {
    const source = readFileSync(
      join(repositoryRoot, 'app', '(website)', 'exercises.web.tsx'),
      'utf8'
    );

    expect(source).toContain('withExpoBaseUrl(buildExerciseImagePath(exercise.exerciseSlug))');
    expect(source).toContain("contentVisibility: 'auto'");
    expect(source).not.toMatch(/exercise\$\{.*exerciseIndex.*\}\.png/);
  });
});
