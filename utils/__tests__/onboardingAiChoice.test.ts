import { availableAiChoices, defaultAiChoice } from '@/utils/onboardingAiChoice';

describe('availableAiChoices', () => {
  it.each([
    [true, true, ['premium', 'free', 'none']],
    [true, false, ['premium', 'none']],
    [false, true, ['free', 'none']],
    [false, false, ['none']],
  ])('premium=%s free=%s', (premiumEnabled, freeTierAvailable, expected) => {
    expect(availableAiChoices({ premiumEnabled, freeTierAvailable })).toEqual(expected);
  });

  it('always lists "none" last', () => {
    for (const premiumEnabled of [true, false]) {
      for (const freeTierAvailable of [true, false]) {
        const choices = availableAiChoices({ premiumEnabled, freeTierAvailable });

        expect(choices[choices.length - 1]).toBe('none');
      }
    }
  });
});

describe('defaultAiChoice', () => {
  it('selects the first offered choice', () => {
    expect(defaultAiChoice(['premium', 'free', 'none'])).toBe('premium');
    expect(defaultAiChoice(['free', 'none'])).toBe('free');
    expect(defaultAiChoice(['none'])).toBe('none');
  });

  it('falls back to none for an empty list', () => {
    expect(defaultAiChoice([])).toBe('none');
  });
});
