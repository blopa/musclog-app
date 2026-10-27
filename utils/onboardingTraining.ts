import type { WorkoutAutonomy } from '@/constants/settings';
import workoutTemplatesData from '@/data/workoutTemplatesData.json';
import type { EquipmentType } from '@/database/models/Exercise';
import type { LiftingExperience } from '@/database/models/User';
import { EQUIPMENT_TYPES } from '@/utils/gym';

export const TRAINING_LOCATIONS = ['gym', 'home', 'minimal'] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

export const TRAINING_DAYS_OPTIONS = [2, 3, 4, 5] as const;
export const DEFAULT_TRAINING_DAYS = 3;

export type TrainingSetupData = {
  location: TrainingLocation;
  /** Only asked in the quick setup; the personalized one asks it on its own experience screen. */
  experience?: LiftingExperience;
  daysPerWeek: number;
  autonomy: WorkoutAutonomy;
};

const isLocation = (value: unknown): value is TrainingLocation =>
  TRAINING_LOCATIONS.includes(value as TrainingLocation);
const isExperience = (value: unknown): value is LiftingExperience =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

/** Reads the stored answers back; anything malformed means "no training setup". */
export function parseTrainingSetup(raw: string | null | undefined): TrainingSetupData | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TrainingSetupData> | null;
    if (!parsed || !isLocation(parsed.location)) {
      return null;
    }

    const days = Number(parsed.daysPerWeek);
    return {
      location: parsed.location,
      experience: isExperience(parsed.experience) ? parsed.experience : undefined,
      daysPerWeek: Number.isFinite(days)
        ? Math.min(5, Math.max(2, Math.round(days)))
        : DEFAULT_TRAINING_DAYS,
      autonomy: parsed.autonomy === 'manual' ? 'manual' : 'suggest',
    };
  } catch {
    return null;
  }
}

/**
 * The place to train an existing gym profile amounts to, so a question about where the person
 * trains can start on the answer their profile already gives.
 */
export function inferTrainingLocation(equipment: readonly EquipmentType[]): TrainingLocation {
  if (
    equipment.some((item) => ['barbell', 'plate_machine', 'cable', 'smith_machine'].includes(item))
  ) {
    return 'gym';
  }

  return equipment.some((item) => item === 'dumbbell' || item === 'kettlebell')
    ? 'home'
    : 'minimal';
}

/** What a gym profile created from the answer contains. */
export function equipmentForLocation(location: TrainingLocation): EquipmentType[] {
  switch (location) {
    case 'gym':
      return [...EQUIPMENT_TYPES];
    case 'home':
      return ['dumbbell', 'kettlebell', 'resistance_band', 'bodyweight', 'other'];
    case 'minimal':
      return ['resistance_band', 'bodyweight', 'other'];
  }
}

/**
 * Bundled plans are keyed by their maintainer title (`__title`) rather than array position, so
 * adding a plan to the catalogue cannot silently re-point a recommendation.
 */
const FULL_BODY_2 = '2-Day Full Body (A/B)';
const FULL_BODY_3 = 'Full Body (3-Day)';
const STRENGTH_3 = '3-Day Strength Builder';
const UPPER_LOWER_4 = 'Upper/Lower 4-Day Split';
const PPL = 'Push Pull Legs (PPL)';
const HYPERTROPHY_5 = '5-Day Hypertrophy Split';

export const STARTER_PLAN_TITLES: Record<LiftingExperience, Record<number, string>> = {
  beginner: { 2: FULL_BODY_2, 3: FULL_BODY_3, 4: FULL_BODY_3, 5: FULL_BODY_3 },
  intermediate: { 2: FULL_BODY_2, 3: FULL_BODY_3, 4: UPPER_LOWER_4, 5: PPL },
  advanced: { 2: FULL_BODY_2, 3: STRENGTH_3, 4: UPPER_LOWER_4, 5: HYPERTROPHY_5 },
};

/**
 * The short, easy A/B full-body plans, one per place to train. They are the only bundled plans
 * built for dumbbells/bands/bodyweight, so they are what home and minimal trainers are offered —
 * and what a comeback's "a short plan for me" creates, for any location.
 */
export const SHORT_PLAN_TITLES: Record<TrainingLocation, string> = {
  gym: 'Short Full Body — Gym',
  home: 'Short Full Body — Home',
  minimal: 'Short Full Body — No Equipment',
};

/** Index into `workoutTemplatesData.json` of the short plan for a place to train, or null. */
export function shortPlanTemplateIndex(location: TrainingLocation): number | null {
  const index = (workoutTemplatesData as { __title?: string }[]).findIndex(
    (template) => template.__title === SHORT_PLAN_TITLES[location]
  );

  return index >= 0 ? index : null;
}

/**
 * Index into `workoutTemplatesData.json` of the plan to recommend, or null when the answers do
 * not fit a catalogue plan. The long catalogue plans are built around gym equipment (barbells,
 * machines, cables), so someone training at home or with nothing is offered the short full-body
 * plan for their equipment instead of an empty workout.
 */
export function pickStarterTemplateIndex(
  location: TrainingLocation,
  experience: LiftingExperience,
  daysPerWeek: number
): number | null {
  if (location !== 'gym') {
    return shortPlanTemplateIndex(location);
  }

  const days = Math.min(5, Math.max(2, Math.round(daysPerWeek)));
  const title = STARTER_PLAN_TITLES[experience][days];
  const index = (workoutTemplatesData as { __title?: string }[]).findIndex(
    (template) => template.__title === title
  );

  return index >= 0 ? index : null;
}
