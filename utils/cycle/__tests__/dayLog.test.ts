import {
  isBleeding,
  blankDayLog,
  isEmptyDayLog,
  MAX_QUICK_LOG,
  parseQuickLog,
  patchDayLog,
  serializeQuickLog,
  setSymptomSeverity,
  suggestPin,
  togglePinned,
  toggleSymptom,
  withNoSymptoms,
} from '../dayLog';

const empty = {
  bleeding: null,
  symptoms: [],
  noSymptoms: false,
  pain: null,
  energy: null,
  note: '',
};

describe('isEmptyDayLog', () => {
  it('is empty only when nothing was recorded', () => {
    expect(isEmptyDayLog(empty)).toBe(true);
    expect(isEmptyDayLog({ ...empty, noSymptoms: true })).toBe(false);
    expect(isEmptyDayLog({ ...empty, bleeding: 'none' })).toBe(false);
    expect(isEmptyDayLog({ ...empty, pain: 0 })).toBe(false);
    expect(isEmptyDayLog({ ...empty, note: '  ' })).toBe(true);
  });

  it('distinguishes explicit no-bleeding from bleeding', () => {
    expect(isBleeding('none')).toBe(false);
    expect(isBleeding('spotting')).toBe(true);
    expect(isBleeding(null)).toBe(false);
  });
});

describe('toggleSymptom', () => {
  it('adds an unrated symptom with one tap and removes it with the next', () => {
    const on = toggleSymptom([], 'cramps');
    expect(on).toEqual([{ key: 'cramps', severity: null }]);
    expect(toggleSymptom(on, 'cramps')).toEqual([]);
  });

  it('removes a rated symptom in one tap too', () => {
    expect(toggleSymptom([{ key: 'acne', severity: 3 }], 'acne')).toEqual([]);
  });
});

describe('setSymptomSeverity', () => {
  it('rates a logged symptom and clears the rating when the same one is tapped again', () => {
    const rated = setSymptomSeverity([{ key: 'cramps', severity: null }], 'cramps', 2);
    expect(rated).toEqual([{ key: 'cramps', severity: 2 }]);
    expect(setSymptomSeverity(rated, 'cramps', 2)).toEqual([{ key: 'cramps', severity: null }]);
    expect(setSymptomSeverity(rated, 'other', 1)).toEqual(rated);
  });
});

describe('withNoSymptoms', () => {
  it('clears symptoms when "no symptoms" is chosen, and the flag when one is added back', () => {
    expect(
      withNoSymptoms({ symptoms: [{ key: 'a', severity: 1 }], noSymptoms: false }, true)
    ).toEqual({
      symptoms: [],
      noSymptoms: true,
    });
    expect(withNoSymptoms({ symptoms: [], noSymptoms: true }, false).noSymptoms).toBe(false);
  });
});

describe('quick log', () => {
  it('round-trips, dedupes and caps', () => {
    expect(parseQuickLog('a, b,a,,c')).toEqual(['a', 'b', 'c']);
    expect(parseQuickLog(undefined)).toEqual([]);
    const many = Array.from({ length: 10 }, (_, i) => `k${i}`);
    expect(parseQuickLog(serializeQuickLog(many))).toHaveLength(MAX_QUICK_LOG);
  });

  it('refuses a pin on a full list instead of evicting', () => {
    const full = Array.from({ length: MAX_QUICK_LOG }, (_, i) => `k${i}`);
    expect(togglePinned(full, 'new')).toBe(full);
    expect(togglePinned(['a'], 'a')).toEqual([]);
  });
});

describe('suggestPin', () => {
  const starts = [0, 100, 200];
  const log = (date: number, key: string) => ({ date, symptoms: [{ key, severity: 1 as const }] });

  it('suggests a symptom logged 3+ days across 2+ cycles', () => {
    const logs = [log(1, 'headache'), log(2, 'headache'), log(101, 'headache')];
    expect(suggestPin(logs, starts, [], [])).toBe('headache');
  });

  it('does not suggest one confined to a single cycle, pinned, or already offered', () => {
    const one = [log(1, 'a'), log(2, 'a'), log(3, 'a')];
    expect(suggestPin(one, starts, [], [])).toBeNull();
    const two = [log(1, 'a'), log(2, 'a'), log(101, 'a')];
    expect(suggestPin(two, starts, ['a'], [])).toBeNull();
    expect(suggestPin(two, starts, [], ['a'])).toBeNull();
  });
});

describe('patchDayLog', () => {
  it('keeps what the patch does not mention', () => {
    const existing = { ...blankDayLog(5), pain: 4, symptoms: [{ key: 'a', severity: 2 as const }] };
    const out = patchDayLog(existing, 5, { bleeding: 'light' });
    expect(out).toMatchObject({ bleeding: 'light', pain: 4, date: 5 });
    expect(out.symptoms).toEqual(existing.symptoms);
  });

  it('starts from a blank day when nothing was logged', () => {
    expect(patchDayLog(undefined, 7, { energy: 3 })).toEqual({ ...blankDayLog(7), energy: 3 });
  });
});
