import { readFileSync } from 'node:fs';
import path from 'node:path';

import { MUSCLE_GROUP_FAMILY, muscleGroupFamily } from '@/database/models/muscleGroupFamily';

describe('muscleGroupFamily', () => {
  it('maps both vocabularies of a body region onto the same family', () => {
    // The whole point: a reader asking "is this legs?" must get the same answer for a bundled
    // exercise (stored `legs`) and a legacy migrated one (stored `quads`).
    expect(muscleGroupFamily('legs')).toBe('legs');
    expect(muscleGroupFamily('quads')).toBe('legs');
    expect(muscleGroupFamily('hamstrings')).toBe('legs');
    expect(muscleGroupFamily('arms')).toBe('arms');
    expect(muscleGroupFamily('biceps')).toBe('arms');
    expect(muscleGroupFamily('core')).toBe('core');
    expect(muscleGroupFamily('abs')).toBe('core');
    expect(muscleGroupFamily('abdomen')).toBe('core');
  });

  it('covers every name in the MuscleGroup union', () => {
    // `Record<MuscleGroup, …>` already makes a missing entry a build error; this catches the other
    // direction — a stale entry left behind after a name is removed from the union.
    const source = readFileSync(path.join(__dirname, '..', 'Exercise.ts'), 'utf8');
    const union = source.slice(
      source.indexOf('export type MuscleGroup ='),
      source.indexOf(';', source.indexOf('export type MuscleGroup ='))
    );
    const names = [...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);

    expect(names.length).toBeGreaterThan(0);
    expect(Object.keys(MUSCLE_GROUP_FAMILY).sort()).toEqual([...names].sort());
  });

  it('stays free of the WatermelonDB model class', () => {
    // Pure consumers (utils/workoutEnergyCalculator.ts) import this as a VALUE. If it ever gains a
    // runtime import of ./Exercise, the decorated model class is pulled into their module graph
    // and the Jest `node` project fails with "Super expression must either be null or a function".
    const source = readFileSync(path.join(__dirname, '..', 'muscleGroupFamily.ts'), 'utf8');
    const modelImports = [...source.matchAll(/^import\s+(type\s+)?.*from\s+'\.\/Exercise'/gm)];

    expect(modelImports).toHaveLength(1);
    expect(modelImports[0][1]).toBe('type ');
  });
});
