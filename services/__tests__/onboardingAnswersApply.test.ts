import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AI_ONBOARDING_DRAFT,
  PERSONALIZED_BODY_DRAFT,
  PERSONALIZED_SETUP_DATA,
  TEMP_NUTRITION_PLAN,
  TRAINING_SETUP_DATA,
} from '@/constants/misc';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import {
  applyOnboardingAnswers,
  applyProfileUpdate,
  commitOnboardingProfile,
  loadProfileSnapshot,
  readGuidedAnswers,
  stageAnswersForGuided,
} from '@/services/onboardingAnswersApply';
import type { CompleteOnboardingAnswers } from '@/utils/aiOnboarding/contract';
import { newDraft, readAiDraft, writeAiDraft } from '@/utils/aiOnboarding/draftStorage';
import { ensureGymForLocation } from '@/utils/applyTrainingSetup';
import { persistFitnessProfile } from '@/utils/fitnessProfilePersistence';
import { calculateNutritionPlan } from '@/utils/nutritionCalculator';
import { readBodyStatsDraft } from '@/utils/onboardingDraft';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';

jest.mock('@/database/encryptionHelpers', () => ({
  encryptOptionalString: async (value: string) => `enc:${Buffer.from(value).toString('base64')}`,
  decryptOptionalString: async (cipher: string) =>
    cipher.startsWith('enc:') ? Buffer.from(cipher.slice(4), 'base64').toString() : '',
}));
jest.mock('@/utils/coachAI', () => ({}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getUnits: jest.fn(), get: jest.fn(), set: jest.fn() },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatest: jest.fn() },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));
jest.mock('@/utils/applyTrainingSetup', () => ({ ensureGymForLocation: jest.fn() }));
jest.mock('@/utils/fitnessProfilePersistence', () => ({ persistFitnessProfile: jest.fn() }));
jest.mock('@/utils/onboardingService', () => ({ setCurrentOnboardingStep: jest.fn() }));
jest.mock('@/utils/nutritionCalculator', () => {
  const actual = jest.requireActual('@/utils/nutritionCalculator');
  return { ...actual, calculateNutritionPlan: jest.fn(actual.calculateNutritionPlan) };
});

const mockPersist = persistFitnessProfile as jest.Mock;
const mockEnsureGym = ensureGymForLocation as jest.Mock;
const mockSetStep = setCurrentOnboardingStep as jest.Mock;
const mockCalc = calculateNutritionPlan as jest.Mock;
const mockSet = SettingsService.set as jest.Mock;
const mockUnits = SettingsService.getUnits as jest.Mock;
const mockGet = SettingsService.get as jest.Mock;
const mockGetUser = UserService.getCurrentUser as jest.Mock;
const mockLatest = UserMetricService.getLatest as jest.Mock;

const metric = (value: number, unit: string) => ({ getDecrypted: async () => ({ value, unit }) });

const answers: CompleteOnboardingAnswers = {
  fullName: 'Ana',
  units: 'metric',
  gender: 'female',
  birthDate: '1996-05-01',
  heightCm: 168,
  weightKg: 62,
  liftingExperience: 'beginner',
  activityLevel: 3,
  fitnessGoal: 'general',
  weightGoal: 'lose',
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPersist.mockResolvedValue({});
  mockEnsureGym.mockResolvedValue(true);
  mockUnits.mockResolvedValue('metric');
  mockGet.mockResolvedValue('suggest');
  mockGetUser.mockResolvedValue(null);
  mockLatest.mockResolvedValue(null);
});

describe('applyOnboardingAnswers', () => {
  const opts = (draftId: string) => ({ draftId, skipMusclogApi: false, useBodyFat: false });

  it('saves everything, prepares the plan, and deletes the draft last', async () => {
    const draft = newDraft('onboarding');
    await writeAiDraft({ ...draft, answers });
    const order: string[] = [];
    mockPersist.mockImplementation(async () => {
      order.push(`persist:${(await readAiDraft('onboarding'))?.applyState ?? 'gone'}`);
    });
    mockSetStep.mockImplementation(async () => {
      order.push(`step:${(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)) ? 'draft' : 'gone'}`);
    });

    const result = await applyOnboardingAnswers(
      { ...answers, trainingLocation: 'home', trainingDaysPerWeek: 4 },
      { ...opts(draft.draftId), skipMusclogApi: true }
    );

    // The state is persisted before the first write, and the draft still exists until the end.
    expect(order).toEqual(['persist:applying', 'step:draft']);
    expect(result).toEqual({ nextRoute: '/app/onboarding/personalized-cycle' });
    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ana', weightKg: 62, heightCm: 168, units: 'metric' })
    );
    expect(JSON.parse((await AsyncStorage.getItem(TRAINING_SETUP_DATA)) ?? '{}')).toEqual({
      location: 'home',
      daysPerWeek: 4,
      autonomy: 'suggest',
    });
    expect(JSON.parse((await AsyncStorage.getItem(PERSONALIZED_SETUP_DATA)) ?? '{}')).toMatchObject(
      {
        gender: 'female',
        liftingExperience: 'beginner',
        skipMusclogApi: true,
      }
    );
    expect(await readBodyStatsDraft()).toMatchObject({ birthDate: '1996-05-01', heightCm: 168 });
    expect(JSON.parse((await AsyncStorage.getItem(TEMP_NUTRITION_PLAN)) ?? '{}')).toHaveProperty(
      'targetCalories'
    );
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });

  it('clears stale training answers when the new answers have none', async () => {
    await AsyncStorage.setItem(TRAINING_SETUP_DATA, '{"location":"gym"}');
    const draft = newDraft('onboarding');
    await writeAiDraft(draft);

    await applyOnboardingAnswers(answers, opts(draft.draftId));

    expect(await AsyncStorage.getItem(TRAINING_SETUP_DATA)).toBeNull();
  });

  it('applies once when called twice at the same time', async () => {
    const draft = newDraft('onboarding');
    await writeAiDraft(draft);
    let release: () => void = () => {};
    mockPersist.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));

    const first = applyOnboardingAnswers(answers, opts(draft.draftId));
    const second = applyOnboardingAnswers(answers, opts(draft.draftId));
    // Let the first run reach the (held) profile write before letting it finish.
    while (mockPersist.mock.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    release();

    expect(await first).toEqual(await second);
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  it('keeps the conversation when saving fails, and a retry then succeeds', async () => {
    const draft = newDraft('onboarding');
    await writeAiDraft({ ...draft, answers });
    mockPersist.mockRejectedValueOnce(new Error('disk full'));

    await expect(applyOnboardingAnswers(answers, opts(draft.draftId))).rejects.toThrow('disk full');

    const kept = await readAiDraft('onboarding');
    expect(kept?.draftId).toBe(draft.draftId);
    expect(kept?.applyState).toBeUndefined();
    expect(mockSetStep).not.toHaveBeenCalled();

    await expect(applyOnboardingAnswers(answers, opts(draft.draftId))).resolves.toEqual({
      nextRoute: '/app/onboarding/personalized-cycle',
    });
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });

  it('still applies when there is no saved draft to mark (an import with nothing stored)', async () => {
    await expect(applyOnboardingAnswers(answers, opts('no-such-draft'))).resolves.toBeDefined();
  });
});

describe('commitOnboardingProfile', () => {
  it('starts someone coming back after a break at maintenance', async () => {
    await AsyncStorage.setItem(
      TRAINING_SETUP_DATA,
      JSON.stringify({
        location: 'gym',
        daysPerWeek: 3,
        autonomy: 'suggest',
        comingBack: { breakLength: 'over6m' },
      })
    );

    await commitOnboardingProfile(answers, { useBodyFat: false });

    expect(mockCalc).toHaveBeenCalledWith(expect.objectContaining({ weightGoal: 'maintain' }));
  });

  it('uses body fat only when the setting allows it', async () => {
    await commitOnboardingProfile({ ...answers, bodyFatPercent: 20 }, { useBodyFat: true });
    await commitOnboardingProfile({ ...answers, bodyFatPercent: 20 }, { useBodyFat: false });

    expect(mockCalc.mock.calls[0][0].bodyFatPercent).toBe(20);
    expect(mockCalc.mock.calls[1][0].bodyFatPercent).toBeUndefined();
  });
});

describe('stageAnswersForGuided', () => {
  it('prefills the guided drafts, deletes the AI draft and touches no database', async () => {
    await writeAiDraft(newDraft('onboarding'));

    await stageAnswersForGuided(
      { ...answers, dobEstimated: true, trainingLocation: 'minimal' },
      { skipMusclogApi: true }
    );

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(await readGuidedAnswers()).toMatchObject({
      gender: 'female',
      fitnessGoal: 'general',
      birthDate: '1996-05-01',
      dobEstimated: true,
      heightCm: 168,
      trainingLocation: 'minimal',
    });
    expect(JSON.parse((await AsyncStorage.getItem(PERSONALIZED_SETUP_DATA)) ?? '{}')).toMatchObject(
      {
        skipMusclogApi: true,
      }
    );
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
    expect(await AsyncStorage.getItem(PERSONALIZED_BODY_DRAFT)).not.toBeNull();
  });

  it('leaves existing training answers alone when there are none to stage', async () => {
    await AsyncStorage.setItem(
      TRAINING_SETUP_DATA,
      '{"location":"gym","daysPerWeek":3,"autonomy":"suggest"}'
    );

    await stageAnswersForGuided(answers, { skipMusclogApi: false });

    expect(await AsyncStorage.getItem(TRAINING_SETUP_DATA)).not.toBeNull();
  });
});

describe('loadProfileSnapshot', () => {
  it('reads the saved profile with metric values and leaves missing ones absent', async () => {
    mockGetUser.mockResolvedValue({
      fullName: 'Ana',
      gender: 'female',
      fitnessGoal: 'strength',
      liftingExperience: 'advanced',
      weightGoal: 'gain',
      activityLevel: 4,
      dateOfBirth: new Date(1990, 5, 15).getTime(),
      getAge: () => 36,
    });
    mockLatest.mockImplementation(async (type: string) =>
      type === 'weight' ? metric(154.32, 'lbs') : type === 'height' ? metric(180, 'cm') : null
    );

    const snapshot = await loadProfileSnapshot();

    expect(snapshot).toMatchObject({
      fullName: 'Ana',
      units: 'metric',
      trainingAutonomy: 'suggest',
      gender: 'female',
      fitnessGoal: 'strength',
      liftingExperience: 'advanced',
      weightGoal: 'gain',
      activityLevel: 4,
      birthDate: '1990-06-15',
      heightCm: 180,
    });
    expect(snapshot.weightKg).toBeCloseTo(70, 0);
    expect(snapshot).not.toHaveProperty('bodyFatPercent');
  });

  it('has only units and autonomy when there is no profile yet', async () => {
    expect(await loadProfileSnapshot()).toEqual({ units: 'metric', trainingAutonomy: 'suggest' });
  });

  it('treats a user without a usable birthday as having none', async () => {
    mockGetUser.mockResolvedValue({
      gender: 'male',
      fitnessGoal: 'general',
      liftingExperience: 'beginner',
      dateOfBirth: 0,
      getAge: () => 0,
    });

    expect(await loadProfileSnapshot()).not.toHaveProperty('birthDate');
  });
});

describe('applyProfileUpdate', () => {
  const base = {
    draftId: 'profile-draft',
    kept: new Set<never>(),
    recalculateNutrition: false,
    useBodyFat: false,
  };

  it('writes only the kept fields and never completes onboarding', async () => {
    await writeAiDraft({ ...newDraft('profile'), draftId: 'profile-draft' });

    const result = await applyProfileUpdate(
      { ...answers, weightKg: 70, fitnessGoal: 'strength' },
      { ...base, kept: new Set(['weightKg']) }
    );

    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({ weightKg: 70, fitnessGoal: undefined, gender: undefined })
    );
    expect(result).toEqual({ nextRoute: null, notes: [] });
    expect(mockSetStep).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(TEMP_NUTRITION_PLAN)).toBeNull();
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });

  it('applies the coaching style, never starts a comeback, and reports what it left alone', async () => {
    mockEnsureGym.mockResolvedValue(false);

    const result = await applyProfileUpdate(
      {
        trainingAutonomy: 'manual',
        trainingLocation: 'gym',
        trainingDaysPerWeek: 4,
        breakLength: '1to3m',
      },
      {
        ...base,
        draftId: 'profile-2',
        kept: new Set([
          'trainingAutonomy',
          'trainingLocation',
          'trainingDaysPerWeek',
          'breakLength',
        ]),
      }
    );

    expect(mockSet).toHaveBeenCalledWith(expect.anything(), 'manual');
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockEnsureGym).toHaveBeenCalledWith('gym');
    expect(result.notes).toEqual(['gymKept', 'daysNotApplied', 'comebackNotStarted']);
  });

  it('creates the gym a place to train implies only when none exists', async () => {
    mockEnsureGym.mockResolvedValue(true);

    const result = await applyProfileUpdate(
      { trainingLocation: 'home' },
      { ...base, draftId: 'profile-3', kept: new Set(['trainingLocation']) }
    );

    expect(result.notes).toEqual([]);
  });

  it('prepares a recalculated plan and routes to the profile results when asked', async () => {
    mockGetUser.mockResolvedValue({
      fullName: 'Ana',
      gender: 'female',
      fitnessGoal: 'strength',
      liftingExperience: 'advanced',
      weightGoal: 'maintain',
      activityLevel: 4,
      dateOfBirth: new Date(1990, 5, 15).getTime(),
      getAge: () => 36,
    });
    mockLatest.mockImplementation(async (type: string) =>
      type === 'weight' ? metric(70, 'kg') : type === 'height' ? metric(180, 'cm') : null
    );

    const result = await applyProfileUpdate(
      { weightKg: 70 },
      { ...base, draftId: 'profile-4', kept: new Set(['weightKg']), recalculateNutrition: true }
    );

    expect(result.nextRoute).toBe(
      '/app/onboarding/nutrition-goals-results?aiGenerated=true&context=profile'
    );
    expect(await AsyncStorage.getItem(TEMP_NUTRITION_PLAN)).not.toBeNull();
  });

  it('skips the recalculation, and says so, when the profile is incomplete', async () => {
    const result = await applyProfileUpdate(
      { weightKg: 70 },
      { ...base, draftId: 'profile-5', kept: new Set(['weightKg']), recalculateNutrition: true }
    );

    expect(result).toEqual({ nextRoute: null, notes: ['recalculationSkipped'] });
    expect(await AsyncStorage.getItem(TEMP_NUTRITION_PLAN)).toBeNull();
  });

  it('keeps the conversation and lets the same update be retried after a failure', async () => {
    await writeAiDraft({ ...newDraft('profile'), draftId: 'profile-6' });
    mockPersist.mockRejectedValueOnce(new Error('nope'));

    await expect(
      applyProfileUpdate(
        { weightKg: 70 },
        { ...base, draftId: 'profile-6', kept: new Set(['weightKg']) }
      )
    ).rejects.toThrow('nope');
    expect((await readAiDraft('profile'))?.draftId).toBe('profile-6');

    await expect(
      applyProfileUpdate(
        { weightKg: 70 },
        { ...base, draftId: 'profile-6', kept: new Set(['weightKg']) }
      )
    ).resolves.toEqual({ nextRoute: null, notes: [] });
  });
});
