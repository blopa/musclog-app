/**
 * What to tell the user once a received share has been imported.
 *
 * The single source for BOTH the receive screen's success panel and the snackbar that fires
 * alongside it. Those were two implementations of one decision — a `Record<MusclogShareKind, …>`
 * for the snackbar and a nested ternary in the JSX 500 lines away — returning the same keys by
 * coincidence rather than by construction.
 *
 * Pure, and in its own file rather than inside `shareImportPanels.tsx`, so it runs in the Jest
 * `node` project: the panel module imports React Native components, this must not. Same split as
 * `opticalReceiveScreen.ts` next door.
 */

import type { TFunction } from 'i18next';

import type { ShareImportResult } from '@/database/share/importShareEnvelope';
import type { MusclogShareEnvelope } from '@/utils/share/shareEnvelope';

export interface ShareSavedSentence {
  detail?: string;
  title: string;
}

export interface ShareSavedSentenceContext {
  envelope: MusclogShareEnvelope;
  formatInteger: (value: number) => string;
  result: ShareImportResult;
  t: TFunction;
}

/**
 * A `switch` rather than a `Record<MusclogShareKind, …>` because each arm needs its OWN envelope
 * type — a food summary is not a day summary — and narrowing a discriminated union is exactly what
 * a switch does without a cast. Still exhaustive: it returns non-optionally with no `default`, so
 * adding a share kind fails the build here.
 */
export function shareSavedSentence({
  envelope,
  formatInteger,
  result,
  t,
}: ShareSavedSentenceContext): ShareSavedSentence {
  switch (envelope.kind) {
    case 'food':
      // A food share collapses to nothing when the receiver already had that food: the whole
      // envelope is one food, so "saved" would be a lie.
      return {
        title: t(
          result.reused.some((item) => item.table === 'foods')
            ? 'opticalTransfer.share.savedFoodExisted'
            : 'opticalTransfer.share.savedFoodTitle'
        ),
      };

    case 'meal': {
      // A meal is always created; the reused count is about its ingredients.
      const reusedFoods = result.reused.filter((item) => item.table === 'foods').length;

      return {
        detail:
          reusedFoods > 0
            ? t('opticalTransfer.share.savedReusedFoods', { count: reusedFoods })
            : undefined,
        title: t('opticalTransfer.share.savedTitle'),
      };
    }

    case 'nutritionDay': {
      const added = formatInteger(envelope.summary.entries.length);

      return {
        // Two keys rather than one with a `{{replaced}}` that is usually 0: a sentence ending
        // "and removed 0 entries" reads like something went wrong.
        detail:
          result.replaced > 0
            ? t('opticalTransfer.share.savedDayReplaced', {
                added,
                replaced: formatInteger(result.replaced),
              })
            : t('opticalTransfer.share.savedDayAdded', { added }),
        title: t('opticalTransfer.share.savedDayTitle'),
      };
    }
  }
}
