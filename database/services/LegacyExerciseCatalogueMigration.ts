import { type Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import ExerciseGoal from '@/database/models/ExerciseGoal';
import ExerciseMuscle from '@/database/models/ExerciseMuscle';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import { APP_EXERCISE_ID_PREFIX, buildLegacyExerciseCloudUrl } from '@/utils/exerciseImage';
import { purgeRetiredExerciseImageCache } from '@/utils/exerciseImageCache';

import { AppExerciseCatalogueService } from './AppExerciseCatalogueService';

const RETIRED_EXERCISE_CLONE_ID_PREFIX = 'lx-';
const MAX_BATCH_OPERATIONS = 500;
const MAX_QUERY_IDS = 300;

export interface LegacyCatalogueMigrationReport {
  cloned: number;
  destroyed: number;
  repointed: number;
}

type RepointableRow = Model & { exerciseId?: null | string; updatedAt: number };

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isRetiredCatalogueExercise(exercise: Exercise): boolean {
  return exercise.source === 'app' && !exercise.id.startsWith(APP_EXERCISE_ID_PREFIX);
}

async function fetchByExerciseIds<T>(table: string, exerciseIds: string[]): Promise<T[]> {
  const results: T[] = [];
  for (const ids of chunked(exerciseIds, MAX_QUERY_IDS)) {
    results.push(
      ...((await database
        .get(table)
        .query(Q.where('exercise_id', Q.oneOf(ids)))
        .fetch()) as T[])
    );
  }

  return results;
}

function cloneIdFor(legacyId: string): string {
  return `${RETIRED_EXERCISE_CLONE_ID_PREFIX}${legacyId}`;
}

function retiredExerciseImageUrl(exercise: Exercise): string | undefined {
  const imageUrl = exercise.imageUrl ?? '';
  if (imageUrl && !/\/exercises\//.test(imageUrl)) {
    return imageUrl;
  }

  const filename = imageUrl.split('/').pop() ?? '';
  if (filename === 'exercise-fallback.png' || filename === 'fallback.png') {
    return undefined;
  }

  const fromFilename = filename.match(/^(?:exercise)?(\d+)\.\w+$/)?.[1];
  const exerciseNumber = Number(fromFilename ?? exercise.id);
  return Number.isInteger(exerciseNumber) && exerciseNumber > 0
    ? buildLegacyExerciseCloudUrl(exerciseNumber)
    : undefined;
}

/** One-time data cutover from the retired numeric/UUID catalogue to user-owned clones. */
export class LegacyExerciseCatalogueMigration {
  static async run(): Promise<LegacyCatalogueMigrationReport | null> {
    const preCheck = await database.get<Exercise>('exercises').query().fetch();
    if (!preCheck.some(isRetiredCatalogueExercise)) {
      return null;
    }
    if (!(await AppExerciseCatalogueService.isComplete())) {
      return null;
    }

    const report: LegacyCatalogueMigrationReport = { cloned: 0, destroyed: 0, repointed: 0 };
    let migrated = false;

    await database.write(async () => {
      const allExercises = await database.get<Exercise>('exercises').query().fetch();
      const retired = allExercises.filter(isRetiredCatalogueExercise);
      if (retired.length === 0 || !(await AppExerciseCatalogueService.isComplete())) {
        return;
      }
      migrated = true;

      const retiredIds = retired.map((exercise) => exercise.id);
      const [templateExercises, logExercises, goals, muscleLinks] = await Promise.all([
        fetchByExerciseIds<WorkoutTemplateExercise>('workout_template_exercises', retiredIds),
        fetchByExerciseIds<WorkoutLogExercise>('workout_log_exercises', retiredIds),
        fetchByExerciseIds<ExerciseGoal>('exercise_goals', retiredIds),
        fetchByExerciseIds<ExerciseMuscle>('exercise_muscles', retiredIds),
      ]);
      const referencedIds = new Set<string>([
        ...templateExercises.map((row) => row.exerciseId),
        ...logExercises.map((row) => row.exerciseId),
        ...goals.flatMap((row) => (row.exerciseId ? [row.exerciseId] : [])),
      ]);
      const existingIds = new Set(allExercises.map((exercise) => exercise.id));
      const now = Date.now();

      const creates = retired.flatMap((exercise) => {
        if (!referencedIds.has(exercise.id) || existingIds.has(cloneIdFor(exercise.id))) {
          return [];
        }

        report.cloned += 1;
        return [
          database.get<Exercise>('exercises').prepareCreate((clone) => {
            clone._raw.id = cloneIdFor(exercise.id);
            clone.name = exercise.name;
            clone.description = exercise.description;
            clone.muscleGroup = exercise.muscleGroup;
            clone.equipmentType = exercise.equipmentType;
            clone.mechanicType = exercise.mechanicType;
            clone.source = 'user';
            clone.loadMultiplier = exercise.loadMultiplier;
            clone.orderIndex = undefined;
            clone.imageUrl = retiredExerciseImageUrl(exercise);
            clone.createdAt = exercise.createdAt;
            clone.updatedAt = now;
            clone.deletedAt = exercise.deletedAt;
          }),
        ];
      });

      const repoint = <T extends RepointableRow>(rows: T[]) =>
        rows.flatMap((row) => {
          if (!row.exerciseId || !referencedIds.has(row.exerciseId)) {
            return [];
          }
          const cloneId = cloneIdFor(row.exerciseId);
          report.repointed += 1;
          return [
            row.prepareUpdate((record) => {
              record.exerciseId = cloneId;
              record.updatedAt = now;
            }),
          ];
        });

      const survivingMuscleLinks = muscleLinks.filter((link) => referencedIds.has(link.exerciseId));

      const retiredMuscleLinks = muscleLinks.filter((link) => !referencedIds.has(link.exerciseId));

      const updates = [
        ...repoint(templateExercises),
        ...repoint(logExercises),
        ...repoint(goals),
        ...repoint(survivingMuscleLinks),
      ];

      const destroys = [
        ...retiredMuscleLinks.map((link) => link.prepareDestroyPermanently()),
        ...retired.map((exercise) => {
          report.destroyed += 1;
          return exercise.prepareDestroyPermanently();
        }),
      ];

      for (const operations of chunked(
        [...creates, ...updates, ...destroys],
        MAX_BATCH_OPERATIONS
      )) {
        await database.batch(...operations);
      }
    });

    if (!migrated) {
      return null;
    }

    purgeRetiredExerciseImageCache();
    console.log(
      `[LegacyExerciseCatalogueMigration] cloned ${report.cloned}, repointed ${report.repointed}, destroyed ${report.destroyed}`
    );

    return report;
  }
}
