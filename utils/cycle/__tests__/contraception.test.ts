import {
  CONTRACEPTION_METHODS,
  CONTRACEPTION_TRAITS,
  contextAt,
  contextGuidance,
  contraceptionFromLegacy,
  lifeStageFromLegacy,
} from '../contraception';
import type { CycleContextDto } from '../types';

const ctx = (effectiveFrom: number, extra: Partial<CycleContextDto> = {}): CycleContextDto => ({
  id: String(effectiveFrom),
  cycleId: 'c',
  effectiveFrom,
  timezone: '+00:00',
  lifeStage: 'regular',
  contraception: 'none',
  note: '',
  ...extra,
});

describe('contraception traits', () => {
  it('distinguishes a hormonal IUD from a copper IUD', () => {
    expect(CONTRACEPTION_TRAITS.hormonal_iud.hormonal).toBe('yes');
    expect(CONTRACEPTION_TRAITS.copper_iud.hormonal).toBe('no');
    expect(CONTRACEPTION_TRAITS.iud_unspecified.hormonal).toBe('unknown');
  });

  it('covers every method with traits', () => {
    expect(CONTRACEPTION_METHODS.every((m) => CONTRACEPTION_TRAITS[m] != null)).toBe(true);
  });
});

describe('contextGuidance', () => {
  it('has no suppression and allows fertility for a natural regular cycle', () => {
    const g = contextGuidance({ lifeStage: 'regular', contraception: 'none' });
    expect(g.suppressedReason).toBeNull();
    expect(g.fertilityMeaningful).toBe(true);
  });

  it('suppresses predictions and fertility on a method that usually stops ovulation', () => {
    const g = contextGuidance({ lifeStage: 'regular', contraception: 'combined_pill' });
    expect(g.suppressedReason).toBe('hormonal');
    expect(g.fertilityMeaningful).toBe(false);
    expect(g.excludesCycles).toBe('hormonal_context');
  });

  it('keeps predictions but drops fertility on a hormonal IUD, with a caveat', () => {
    const g = contextGuidance({ lifeStage: 'regular', contraception: 'hormonal_iud' });
    expect(g.suppressedReason).toBeNull();
    expect(g.predictionsCaveated).toBe(true);
    expect(g.fertilityMeaningful).toBe(false);
  });

  it('keeps fertility for a copper IUD', () => {
    expect(
      contextGuidance({ lifeStage: 'regular', contraception: 'copper_iud' }).fertilityMeaningful
    ).toBe(true);
  });

  it('holds back postpartum predictions until two periods are logged', () => {
    const pp = { lifeStage: 'postpartum', contraception: 'none' } as const;
    expect(contextGuidance(pp, { periodsSinceContext: 1 }).suppressedReason).toBe('postpartum');
    expect(contextGuidance(pp, { periodsSinceContext: 2 }).suppressedReason).toBeNull();
  });

  it('hides period actions without bleeding, and treats perimenopause variability as expected', () => {
    const none = contextGuidance({ lifeStage: 'no_bleeding', contraception: 'none' });
    expect(none.suppressedReason).toBe('no_bleeding');
    expect(none.hidePeriodActions).toBe(true);
    expect(
      contextGuidance({ lifeStage: 'perimenopause', contraception: 'none' }).variabilityIsExpected
    ).toBe(true);
  });
});

describe('contextAt', () => {
  it('returns the latest context that has started', () => {
    const list = [ctx(100), ctx(200, { contraception: 'ring' })];
    expect(contextAt(list, 50)).toBeNull();
    expect(contextAt(list, 150)?.effectiveFrom).toBe(100);
    expect(contextAt(list, 250)?.contraception).toBe('ring');
  });
});

describe('legacy mapping', () => {
  it('maps the retired birth control values', () => {
    expect(contraceptionFromLegacy('iud')).toBe('iud_unspecified');
    expect(contraceptionFromLegacy('shot')).toBe('injection');
    expect(contraceptionFromLegacy('pill')).toBe('pill_unspecified');
    expect(contraceptionFromLegacy(null)).toBe('none');
    expect(lifeStageFromLegacy('pcos')).toBe('pcos');
    expect(lifeStageFromLegacy(undefined)).toBe('regular');
  });
});
