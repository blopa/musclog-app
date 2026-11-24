import {
  effectiveThinkingLevel,
  extractionSamples,
  parseThinkingLevel,
  THINKING_LEVELS,
  THINKING_PIPELINE,
  thinkingLevelChangeGate,
} from '../aiThinkingLevel';

describe('parseThinkingLevel', () => {
  it('reads the old boolean switch: on was what medium does now', () => {
    expect(parseThinkingLevel('true')).toBe('medium');
    expect(parseThinkingLevel('false')).toBe('off');
  });

  it('reads every level and falls back to off for anything else', () => {
    for (const level of THINKING_LEVELS) {
      expect(parseThinkingLevel(level)).toBe(level);
    }

    expect(parseThinkingLevel('')).toBe('off');
    expect(parseThinkingLevel(undefined)).toBe('off');
    expect(parseThinkingLevel(null)).toBe('off');
    expect(parseThinkingLevel('ultra')).toBe('off');
    expect(parseThinkingLevel('HIGH')).toBe('off');
  });
});

describe('effectiveThinkingLevel', () => {
  it('never thinks on the shared free tier', () => {
    for (const level of THINKING_LEVELS) {
      expect(effectiveThinkingLevel(level, { provider: 'gateway' })).toBe('off');
    }
  });

  it('keeps the chosen level on every other provider', () => {
    for (const provider of ['hosted', 'on-device', 'local', 'gemini', 'openai', 'claude']) {
      expect(effectiveThinkingLevel('tokenmaxxing', { provider })).toBe('tokenmaxxing');
      expect(effectiveThinkingLevel('medium', { provider })).toBe('medium');
    }
  });

  it('caps a background task at medium', () => {
    expect(effectiveThinkingLevel('tokenmaxxing', { provider: 'hosted', background: true })).toBe(
      'medium'
    );
    expect(effectiveThinkingLevel('high', { provider: 'hosted', background: true })).toBe('medium');
    expect(effectiveThinkingLevel('medium', { provider: 'hosted', background: true })).toBe(
      'medium'
    );
    expect(effectiveThinkingLevel('tokenmaxxing', { provider: 'gateway', background: true })).toBe(
      'off'
    );
  });
});

describe('THINKING_PIPELINE', () => {
  it("keeps today's two behaviours at off and medium", () => {
    expect(THINKING_PIPELINE.off).toEqual({
      verifiedMeal: false,
      reviewRounds: 0,
      samples: 1,
      chatReview: false,
      mealLooks: null,
    });
    expect(THINKING_PIPELINE.medium).toEqual({
      verifiedMeal: true,
      reviewRounds: 0,
      samples: 1,
      chatReview: false,
      mealLooks: null,
    });
  });

  it('gives only tokenmaxxing first looks at a meal: two looks, two samples each', () => {
    expect(THINKING_PIPELINE.off.mealLooks).toBeNull();
    expect(THINKING_PIPELINE.medium.mealLooks).toBeNull();
    expect(THINKING_PIPELINE.high.mealLooks).toBeNull();
    expect(THINKING_PIPELINE.tokenmaxxing.mealLooks).toEqual({ looks: 2, samplesPerLook: 2 });
  });

  it('never does less as the level goes up', () => {
    for (let i = 1; i < THINKING_LEVELS.length; i++) {
      const lower = THINKING_PIPELINE[THINKING_LEVELS[i - 1]];
      const higher = THINKING_PIPELINE[THINKING_LEVELS[i]];
      expect(higher.reviewRounds).toBeGreaterThanOrEqual(lower.reviewRounds);
      expect(higher.samples).toBeGreaterThanOrEqual(lower.samples);
      expect(Number(higher.verifiedMeal)).toBeGreaterThanOrEqual(Number(lower.verifiedMeal));
      expect(Number(higher.chatReview)).toBeGreaterThanOrEqual(Number(lower.chatReview));
    }
  });

  it('reads an extraction twice at high and three times at tokenmaxxing', () => {
    expect(extractionSamples('off')).toBe(1);
    expect(extractionSamples('medium')).toBe(1);
    expect(extractionSamples('high')).toBe(2);
    expect(extractionSamples('tokenmaxxing')).toBe(3);
  });
});

describe('thinkingLevelChangeGate', () => {
  it('explains moving up to high on Musclog Iron and asks the device for tokenmaxxing', () => {
    expect(thinkingLevelChangeGate('medium', 'high', 'hosted')).toBe('note');
    expect(thinkingLevelChangeGate('off', 'high', 'hosted')).toBe('note');
    expect(thinkingLevelChangeGate('high', 'tokenmaxxing', 'hosted')).toBe('noteAndAuth');
    expect(thinkingLevelChangeGate('off', 'tokenmaxxing', 'hosted')).toBe('noteAndAuth');
  });

  it('asks nothing for medium, for moving down or staying put', () => {
    expect(thinkingLevelChangeGate('off', 'medium', 'hosted')).toBe('none');
    expect(thinkingLevelChangeGate('tokenmaxxing', 'high', 'hosted')).toBe('none');
    expect(thinkingLevelChangeGate('high', 'off', 'hosted')).toBe('none');
    expect(thinkingLevelChangeGate('high', 'high', 'hosted')).toBe('none');
  });

  it('asks nothing on a provider that is not Musclog Iron', () => {
    for (const provider of ['gateway', 'on-device', 'local', 'gemini', 'openai', 'claude']) {
      expect(thinkingLevelChangeGate('off', 'tokenmaxxing', provider)).toBe('none');
      expect(thinkingLevelChangeGate('medium', 'high', provider)).toBe('none');
    }
  });
});
