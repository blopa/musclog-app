import AsyncStorage from '@react-native-async-storage/async-storage';

import { PERSONALIZED_BODY_DRAFT, PERSONALIZED_SETUP_DATA } from '@/constants/misc';
import {
  type OnboardingAnswersDraft,
  pickAnswers,
  sanitizeDraft,
} from '@/utils/aiOnboarding/contract';
import { readEncryptedJson, writeEncryptedJson } from '@/utils/encryptedJsonStorage';
import { isRecord } from '@/utils/isRecord';

/** The answers the guided personalized screens keep between them. */
export const PERSONALIZED_SETUP_KEYS = [
  'fullName',
  'units',
  'gender',
  'liftingExperience',
  'activityLevel',
  'fitnessGoal',
  'weightGoal',
] as const;

/** The metric body answers held for prefill; weight and height are shown in the person's own unit. */
export const BODY_STATS_KEYS = ['birthDate', 'heightCm', 'weightKg', 'bodyFatPercent'] as const;

/**
 * What the guided personalized screens accumulate in AsyncStorage. These are the contract's own
 * answers (see `OnboardingAnswersDraft`), so the AI onboarding writes the same shape (see
 * `stageAnswersForGuided`), which is how switching from a conversation to the forms prefills every
 * screen instead of starting from hard-coded defaults.
 */
export type PersonalizedSetupData = Pick<
  OnboardingAnswersDraft,
  (typeof PERSONALIZED_SETUP_KEYS)[number]
> & {
  /**
   * Set when the person already chose an AI provider in the AI setup (free tier or their own key),
   * so the later "Musclog AI" step must not offer the free tier on top of the key they just tested.
   */
  skipMusclogApi?: boolean;
};

export type BodyStatsDraft = Pick<
  OnboardingAnswersDraft,
  (typeof BODY_STATS_KEYS)[number] | 'dobEstimated'
>;

/** The body answers of a draft; the "estimated" flag only travels next to the birthday it describes. */
export function pickBodyStats(draft: OnboardingAnswersDraft): BodyStatsDraft {
  return {
    ...pickAnswers(draft, BODY_STATS_KEYS),
    ...(draft.birthDate && draft.dobEstimated ? { dobEstimated: true } : {}),
  };
}

/** Reads stored setup answers; every value goes through the contract's validator, the rest is dropped. */
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

  return {
    ...pickAnswers(sanitizeDraft(parsed, new Date()), PERSONALIZED_SETUP_KEYS),
    ...(parsed.skipMusclogApi === true ? { skipMusclogApi: true } : {}),
  };
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

/** Validates a stored body draft with the contract's bounds, so a hand-edited value cannot slip in. */
export function parseBodyStatsDraft(raw: unknown): BodyStatsDraft {
  return pickBodyStats(sanitizeDraft(raw, new Date()));
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
