import AsyncStorage from '@react-native-async-storage/async-storage';

import { PERSONALIZED_BODY_DRAFT, PERSONALIZED_SETUP_DATA } from '@/constants/misc';
import type { Units } from '@/constants/settings';
import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '@/database/models/User';
import { readEncryptedJson, writeEncryptedJson } from '@/utils/encryptedJsonStorage';
import { BODY_FAT_MAX, BODY_FAT_MIN } from '@/utils/nutritionCalculator';

/**
 * What the guided personalized screens accumulate in AsyncStorage. The AI onboarding writes the
 * same shape (see `stageAnswersForGuided`), which is how switching from a conversation to the
 * forms prefills every screen instead of starting from hard-coded defaults.
 */
export type PersonalizedSetupData = {
  fullName?: string;
  units?: Units;
  gender?: Gender;
  liftingExperience?: LiftingExperience;
  activityLevel?: number;
  fitnessGoal?: FitnessGoal;
  weightGoal?: WeightGoal;
  /**
   * Set when the person already chose an AI provider in the AI setup (free tier or their own key),
   * so the later "Musclog AI" step must not offer the free tier on top of the key they just tested.
   */
  skipMusclogApi?: boolean;
};

/** Metric body answers held for prefill; weight and height are shown in the person's own unit. */
export type BodyStatsDraft = {
  birthDate?: string;
  dobEstimated?: boolean;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
};

const GENDERS: readonly Gender[] = ['male', 'female', 'other'];
const EXPERIENCES: readonly LiftingExperience[] = ['beginner', 'intermediate', 'advanced'];
const FITNESS_GOALS: readonly FitnessGoal[] = [
  'hypertrophy',
  'strength',
  'endurance',
  'weight_loss',
  'general',
];
const WEIGHT_GOALS: readonly WeightGoal[] = ['lose', 'gain', 'maintain'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return list.includes(value as T) ? (value as T) : undefined;
}

/** Reads stored setup answers field by field; anything unexpected is dropped, not trusted. */
export function parsePersonalizedSetup(raw: string | null | undefined): PersonalizedSetupData {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!isRecord(parsed)) {
    return {};
  }

  const level = parsed.activityLevel;
  const fullName = typeof parsed.fullName === 'string' ? parsed.fullName : undefined;
  const result: PersonalizedSetupData = {
    ...(fullName !== undefined ? { fullName } : {}),
    ...(parsed.units === 'metric' || parsed.units === 'imperial' ? { units: parsed.units } : {}),
    ...(oneOf(GENDERS, parsed.gender) ? { gender: oneOf(GENDERS, parsed.gender) } : {}),
    ...(oneOf(EXPERIENCES, parsed.liftingExperience)
      ? { liftingExperience: oneOf(EXPERIENCES, parsed.liftingExperience) }
      : {}),
    ...(typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 5
      ? { activityLevel: level }
      : {}),
    ...(oneOf(FITNESS_GOALS, parsed.fitnessGoal)
      ? { fitnessGoal: oneOf(FITNESS_GOALS, parsed.fitnessGoal) }
      : {}),
    ...(oneOf(WEIGHT_GOALS, parsed.weightGoal)
      ? { weightGoal: oneOf(WEIGHT_GOALS, parsed.weightGoal) }
      : {}),
    ...(parsed.skipMusclogApi === true ? { skipMusclogApi: true } : {}),
  };

  return result;
}

export async function readPersonalizedSetup(): Promise<PersonalizedSetupData> {
  return parsePersonalizedSetup(await AsyncStorage.getItem(PERSONALIZED_SETUP_DATA));
}

/** Read, merge, write: each screen adds its own answers without disturbing the others. */
export async function mergePersonalizedSetup(
  patch: PersonalizedSetupData
): Promise<PersonalizedSetupData> {
  const merged = { ...(await readPersonalizedSetup()), ...patch };
  await AsyncStorage.setItem(PERSONALIZED_SETUP_DATA, JSON.stringify(merged));
  return merged;
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Validates a stored body draft; bounds are the contract's, so a hand-edited value cannot slip in. */
export function parseBodyStatsDraft(raw: unknown): BodyStatsDraft {
  if (!isRecord(raw)) {
    return {};
  }

  const birthDate =
    typeof raw.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.birthDate)
      ? raw.birthDate
      : undefined;

  return {
    ...(birthDate ? { birthDate } : {}),
    ...(birthDate && raw.dobEstimated === true ? { dobEstimated: true } : {}),
    ...(inRange(raw.heightCm, 50, 300) ? { heightCm: raw.heightCm } : {}),
    ...(inRange(raw.weightKg, 10, 500) ? { weightKg: raw.weightKg } : {}),
    ...(inRange(raw.bodyFatPercent, BODY_FAT_MIN, BODY_FAT_MAX)
      ? { bodyFatPercent: raw.bodyFatPercent }
      : {}),
  };
}

export async function readBodyStatsDraft(): Promise<BodyStatsDraft> {
  return parseBodyStatsDraft(await readEncryptedJson(PERSONALIZED_BODY_DRAFT));
}

export async function writeBodyStatsDraft(draft: BodyStatsDraft): Promise<void> {
  await writeEncryptedJson(PERSONALIZED_BODY_DRAFT, parseBodyStatsDraft(draft));
}

export async function clearBodyStatsDraft(): Promise<void> {
  await AsyncStorage.removeItem(PERSONALIZED_BODY_DRAFT);
}
