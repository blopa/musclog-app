import AsyncStorage from '@react-native-async-storage/async-storage';

import { PERSONALIZED_BODY_DRAFT, PERSONALIZED_SETUP_DATA } from '@/constants/misc';
import {
  clearBodyStatsDraft,
  mergePersonalizedSetup,
  parseBodyStatsDraft,
  parsePersonalizedSetup,
  readBodyStatsDraft,
  readPersonalizedSetup,
  writeBodyStatsDraft,
} from '@/utils/onboardingDraft';

// Reversible stand-in for the AES helpers; the point here is that the stored text is not the JSON.
jest.mock('@/database/encryptionHelpers', () => ({
  encryptOptionalString: async (value: string) => `enc:${Buffer.from(value).toString('base64')}`,
  decryptOptionalString: async (cipher: string) =>
    cipher.startsWith('enc:') ? Buffer.from(cipher.slice(4), 'base64').toString() : '',
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('parsePersonalizedSetup', () => {
  it('reads valid answers and drops everything else', () => {
    expect(
      parsePersonalizedSetup(
        JSON.stringify({
          fullName: 'Ana',
          units: 'imperial',
          gender: 'robot',
          liftingExperience: 'advanced',
          activityLevel: 9,
          fitnessGoal: 'weight_loss',
          weightGoal: 'gain',
          skipMusclogApi: true,
          extra: 'x',
        })
      )
    ).toEqual({
      fullName: 'Ana',
      units: 'imperial',
      liftingExperience: 'advanced',
      fitnessGoal: 'weight_loss',
      weightGoal: 'gain',
      skipMusclogApi: true,
    });
  });

  it('accepts a whole-number activity level and rejects fractions', () => {
    expect(parsePersonalizedSetup('{"activityLevel":4}')).toEqual({ activityLevel: 4 });
    expect(parsePersonalizedSetup('{"activityLevel":2.5}')).toEqual({});
  });

  it.each([null, undefined, '', 'not json', '[1]', '"text"', '5'])('returns {} for %j', (raw) => {
    expect(parsePersonalizedSetup(raw as string | null | undefined)).toEqual({});
  });
});

describe('personalized setup storage', () => {
  it('merges each screen into what earlier screens saved', async () => {
    await mergePersonalizedSetup({ units: 'metric', gender: 'male' });
    const merged = await mergePersonalizedSetup({ fitnessGoal: 'strength' });

    expect(merged).toEqual({ units: 'metric', gender: 'male', fitnessGoal: 'strength' });
    expect(await readPersonalizedSetup()).toEqual(merged);
  });

  it('survives a corrupt stored value', async () => {
    await AsyncStorage.setItem(PERSONALIZED_SETUP_DATA, '{oops');

    expect(await readPersonalizedSetup()).toEqual({});
  });
});

describe('parseBodyStatsDraft', () => {
  it('keeps values inside the bounds and drops the rest', () => {
    expect(
      parseBodyStatsDraft({
        birthDate: '1990-01-01',
        dobEstimated: true,
        heightCm: 180,
        weightKg: 80,
        bodyFatPercent: 20,
      })
    ).toEqual({
      birthDate: '1990-01-01',
      dobEstimated: true,
      heightCm: 180,
      weightKg: 80,
      bodyFatPercent: 20,
    });
    expect(
      parseBodyStatsDraft({
        birthDate: 'tomorrow',
        dobEstimated: true,
        heightCm: 5,
        weightKg: 'heavy',
        bodyFatPercent: 99,
      })
    ).toEqual({});
  });

  it('only keeps the estimated flag next to a birthday', () => {
    expect(parseBodyStatsDraft({ dobEstimated: true })).toEqual({});
  });

  it('returns {} for non-objects', () => {
    expect(parseBodyStatsDraft(null)).toEqual({});
    expect(parseBodyStatsDraft([1])).toEqual({});
  });
});

describe('body stats draft storage', () => {
  it('stores the draft encrypted and reads it back', async () => {
    await writeBodyStatsDraft({ birthDate: '1990-01-01', heightCm: 180, weightKg: 80 });

    const stored = (await AsyncStorage.getItem(PERSONALIZED_BODY_DRAFT)) ?? '';
    expect(stored).not.toContain('1990');
    expect(stored).not.toContain('180');
    expect(await readBodyStatsDraft()).toEqual({
      birthDate: '1990-01-01',
      heightCm: 180,
      weightKg: 80,
    });
  });

  it('reads an empty draft when nothing is stored, or the entry is unreadable', async () => {
    expect(await readBodyStatsDraft()).toEqual({});

    await AsyncStorage.setItem(PERSONALIZED_BODY_DRAFT, 'garbage');
    expect(await readBodyStatsDraft()).toEqual({});

    await AsyncStorage.setItem(PERSONALIZED_BODY_DRAFT, 'enc:bm90LWpzb24=');
    expect(await readBodyStatsDraft()).toEqual({});
  });

  it('clears the draft', async () => {
    await writeBodyStatsDraft({ heightCm: 180 });
    await clearBodyStatsDraft();

    expect(await AsyncStorage.getItem(PERSONALIZED_BODY_DRAFT)).toBeNull();
  });
});
