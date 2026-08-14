import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import exercisesData from '@/data/exercisesData.json';
import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';

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

    const enumSuffix = (value: string) => value.toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_');
    for (const [values, prefix] of [
      [gameBoyOpticalProtocol.exerciseEnums.muscleGroups, 'EX_MUSCLE'],
      [gameBoyOpticalProtocol.exerciseEnums.equipmentTypes, 'EX_EQUIPMENT'],
      [gameBoyOpticalProtocol.exerciseEnums.mechanicTypes, 'EX_MECHANIC'],
    ] as const) {
      values.forEach((value, index) => {
        expect(generatedHeader).toContain(`${prefix}_${enumSuffix(value)} = ${index},`);
      });
    }

    const filterLabels = workoutSource
      .match(/MUSCLE_FILTER_LABELS[^=]*=\s*\{([\s\S]*?)\};/)?.[1]
      .match(/"([^"]+)"/g)
      ?.map((label) => label.slice(1, -1));
    const expectedFilterLabels = [
      ...new Set(popularExercises.map(({ muscleGroup }) => muscleGroup)),
    ]
      .sort()
      .map((muscleGroup) => muscleGroup.replaceAll('_', ' ').toUpperCase());
    expect(gameBoyOpticalProtocol.exerciseEnums.muscleGroups).toEqual(
      [...new Set(popularExercises.map(({ muscleGroup }) => muscleGroup))].sort()
    );
    expect(filterLabels).toEqual(expectedFilterLabels);
  });

  it('keeps the generator pointed at the current catalogue and its popularity flag', () => {
    const generator = readFileSync(join(repositoryRoot, 'gameboy/tools/gen-exercises.mjs'), 'utf8');

    expect(generator).toContain("const SOURCE_FILE = 'exercisesData.json';");
    expect(generator).toContain("const PROTOCOL_FILE = 'gameBoyOpticalProtocol.json';");
    expect(generator).toContain('row.isPopular === true');
    expect(generator).not.toContain("const SOURCE_FILE = 'legacyExercisesData.json';");
  });

  it('generates sender versions from the shared optical contract', () => {
    const generatedProtocol = readFileSync(
      join(repositoryRoot, 'gameboy/src/generated/optical_protocol.generated.h'),
      'utf8'
    );
    const exporter = readFileSync(
      join(repositoryRoot, 'gameboy/src/features/optical/optical_export.c'),
      'utf8'
    );

    expect(generatedProtocol).toContain(
      `#define OPTICAL_EXPORT_DATABASE_VERSION ${gameBoyOpticalProtocol.databaseExportVersion}u`
    );
    expect(generatedProtocol).toContain(
      `#define OPTICAL_EXPORT_SCHEMA_VERSION ${gameBoyOpticalProtocol.gameBoyExportVersion}u`
    );
    expect(exporter).toContain('json_uint32(sink, OPTICAL_EXPORT_DATABASE_VERSION);');
    expect(exporter).toContain('json_uint32(sink, OPTICAL_EXPORT_SCHEMA_VERSION);');
    expect(exporter).not.toContain('{\\"_exportVersion\\":26,\\"_gameBoyExport\\":1,');
  });

  it('keeps generated binary assets outside formatting while protecting generated source', () => {
    const qrTable = readFileSync(
      join(repositoryRoot, 'gameboy/src/features/optical/qr_rs_products.generated.h'),
      'utf8'
    );
    const formatScript = readFileSync(join(repositoryRoot, 'gameboy/tools/format-c.mjs'), 'utf8');

    expect(qrTable).toContain('// clang-format off');
    expect(qrTable).toContain('// clang-format on');
    expect(formatScript).toContain("'gb_background.c'");
    expect(formatScript).toContain("'logo.c'");
  });
});
