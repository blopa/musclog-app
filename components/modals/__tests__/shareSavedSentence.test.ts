import type { TFunction } from 'i18next';

import type { ShareImportResult } from '@/database/share/importShareEnvelope';
import type { MusclogShareEnvelope } from '@/utils/share/shareEnvelope';
import { SHARE_KINDS } from '@/utils/share/shareKinds';

import { shareSavedSentence } from '../shareSavedSentence';

/**
 * The receive screen's success panel and its snackbar both read this. They used to be two
 * hand-maintained tables of the same translation keys, so the property worth pinning is not any
 * one sentence but that EVERY share kind resolves to one — a kind added without a sentence here
 * would otherwise save silently.
 */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const formatInteger = (value: number) => String(value);

function result(overrides: Partial<ShareImportResult> = {}): ShareImportResult {
  return { kind: 'food', replaced: 0, reused: [], ...overrides };
}

const envelopes: Record<string, MusclogShareEnvelope> = {
  food: { kind: 'food', summary: { name: 'Rice' } } as MusclogShareEnvelope,
  meal: { kind: 'meal', summary: { name: 'Rice bowl' } } as MusclogShareEnvelope,
  nutritionDay: {
    kind: 'nutritionDay',
    summary: { entries: [{}, {}, {}] },
  } as unknown as MusclogShareEnvelope,
};

describe('shareSavedSentence', () => {
  it('gives every share kind a success title', () => {
    for (const kind of Object.keys(SHARE_KINDS)) {
      const sentence = shareSavedSentence({
        envelope: envelopes[kind],
        formatInteger,
        result: result(),
        t,
      });

      expect(sentence.title).toBeTruthy();
    }
  });

  it('says a food already existed when the receiver reused it, since nothing was created', () => {
    const reused = shareSavedSentence({
      envelope: envelopes.food,
      formatInteger,
      result: result({ reused: [{ id: 'f1', sourceId: 's1', table: 'foods' }] }),
      t,
    });
    const created = shareSavedSentence({
      envelope: envelopes.food,
      formatInteger,
      result: result(),
      t,
    });

    expect(reused.title).toBe('opticalTransfer.share.savedFoodExisted');
    expect(created.title).toBe('opticalTransfer.share.savedFoodTitle');
  });

  it('mentions reused ingredients for a meal only when there were any', () => {
    expect(
      shareSavedSentence({ envelope: envelopes.meal, formatInteger, result: result(), t }).detail
    ).toBeUndefined();
    expect(
      shareSavedSentence({
        envelope: envelopes.meal,
        formatInteger,
        result: result({ reused: [{ id: 'f1', sourceId: 's1', table: 'foods' }] }),
        t,
      }).detail
    ).toContain('opticalTransfer.share.savedReusedFoods');
  });

  it('only counts removed entries for a day when the import actually replaced some', () => {
    const added = shareSavedSentence({
      envelope: envelopes.nutritionDay,
      formatInteger,
      result: result({ kind: 'nutritionDay' }),
      t,
    });
    const replaced = shareSavedSentence({
      envelope: envelopes.nutritionDay,
      formatInteger,
      result: result({ kind: 'nutritionDay', replaced: 2 }),
      t,
    });

    // A sentence ending "and removed 0 entries" reads like something went wrong, which is why
    // these are two keys rather than one with an interpolated count.
    expect(added.detail).toContain('opticalTransfer.share.savedDayAdded');
    expect(added.detail).not.toContain('Replaced');
    expect(replaced.detail).toContain('opticalTransfer.share.savedDayReplaced');
    expect(replaced.detail).toContain('"replaced":"2"');
  });
});
