import exercisesData from '@/data/exercisesData.json';
import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';
import i18n, { EN_US, EXERCISES_JSON } from '@/lang/lang';

export interface ExerciseCatalogueCopy {
  exerciseSlug: string;
  name: string;
  description: string;
}

export interface ExerciseCatalogueEntry {
  exerciseIndex: number;
  exerciseSlug: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
  targetMuscles: string[];
  loadMultiplier: number;
}

interface StructuralExerciseEntry {
  exerciseIndex: number;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
  targetMuscles: string[];
  loadMultiplier: number;
  __freeExerciseDbId: string;
}

export type ExerciseCopyLocale = keyof typeof EXERCISES_JSON;

const structuralCatalogue = exercisesData as StructuralExerciseEntry[];

function copyMap(locale: ExerciseCopyLocale): Map<string, ExerciseCatalogueCopy> {
  return new Map(
    (EXERCISES_JSON[locale] as ExerciseCatalogueCopy[]).map((copy) => [copy.exerciseSlug, copy])
  );
}

export function resolveExerciseCopyLocale(locale: string | undefined): ExerciseCopyLocale {
  if (locale && locale in EXERCISES_JSON) {
    return locale as ExerciseCopyLocale;
  }

  return EN_US;
}

/**
 * Joins structural catalogue data to localized copy through the stable upstream slug.
 * `exerciseIndex` remains display order only; changing that order can never redirect copy.
 */
export function getExerciseCatalogue(
  requestedLocale: string | undefined = i18n.resolvedLanguage ?? i18n.language
): ExerciseCatalogueEntry[] {
  const locale = resolveExerciseCopyLocale(requestedLocale);
  const localizedCopies = copyMap(locale);
  const englishCopies = locale === EN_US ? localizedCopies : copyMap(EN_US);

  return structuralCatalogue.map((data) => {
    const copy =
      localizedCopies.get(data.__freeExerciseDbId) ?? englishCopies.get(data.__freeExerciseDbId);
    if (!copy) {
      throw new Error(`Exercise copy is missing for slug "${data.__freeExerciseDbId}"`);
    }

    return {
      exerciseIndex: data.exerciseIndex,
      exerciseSlug: data.__freeExerciseDbId,
      name: copy.name,
      description: copy.description,
      muscleGroup: data.muscleGroup,
      equipmentType: data.equipmentType,
      mechanicType: data.mechanicType,
      targetMuscles: data.targetMuscles,
      loadMultiplier: data.loadMultiplier,
    };
  });
}

export function getEnglishExerciseNamesBySlug(): Map<string, string> {
  return new Map(
    (EXERCISES_JSON[EN_US] as ExerciseCatalogueCopy[]).map(({ exerciseSlug, name }) => [
      exerciseSlug,
      name,
    ])
  );
}

let allLocaleNamesBySlug: Map<string, string[]> | null = null;

/**
 * Every bundled language's name for each catalogue exercise, keyed by slug.
 *
 * A catalogue row's stored `name` is written once, in whatever language the device used on first
 * boot, and never re-localized. Search therefore cannot rely on it: this is what lets "squat" find
 * a row that was created as "Agachamento".
 */
export function getAllLocaleExerciseNamesBySlug(): Map<string, string[]> {
  if (!allLocaleNamesBySlug) {
    const namesBySlug = new Map<string, Set<string>>();
    for (const copies of Object.values(EXERCISES_JSON) as ExerciseCatalogueCopy[][]) {
      for (const { exerciseSlug, name } of copies) {
        const names = namesBySlug.get(exerciseSlug) ?? new Set<string>();
        names.add(name);
        namesBySlug.set(exerciseSlug, names);
      }
    }

    allLocaleNamesBySlug = new Map([...namesBySlug].map(([slug, names]) => [slug, [...names]]));
  }

  return allLocaleNamesBySlug;
}
