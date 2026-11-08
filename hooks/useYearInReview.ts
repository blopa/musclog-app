import { useCallback, useEffect, useMemo, useState } from 'react';

import { YearInReviewRepository } from '@/database/repositories/YearInReviewRepository';
import { handleError } from '@/utils/handleError';
import { buildYearInReview } from '@/utils/yearInReview/engine';
import { buildYearStoryCards, type YearStoryCard } from '@/utils/yearInReview/storyCards';
import type { YearInReview, YearInReviewInput } from '@/utils/yearInReview/types';

type UseYearInReviewResult = {
  /** Null until the year has loaded, and for as long as the load has failed. */
  review: YearInReview | null;
  cards: YearStoryCard[];
  failed: boolean;
  retry: () => void;
};

/**
 * Loads one year of data for "Your year in Musclog" and turns it into the review and its story
 * cards. `showWeight` is false while the progress area is locked: no weigh-in is read at all.
 * Only the newest load may publish, and a result for another year is never returned, so the
 * previous year's figures do not linger under a new one.
 */
export function useYearInReview(year: number, showWeight: boolean): UseYearInReviewResult {
  const [input, setInput] = useState<YearInReviewInput | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    YearInReviewRepository.load(year, { includeWeight: showWeight })
      .then((loaded) => {
        if (!cancelled) {
          setInput(loaded);
        }
      })
      .catch((error: unknown) => {
        void handleError(error, 'yearInReview.load');
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, showWeight, attempt]);

  const review = useMemo(
    () => (input && input.year === year ? buildYearInReview(input) : null),
    [input, year]
  );
  const cards = useMemo(
    () => (review ? buildYearStoryCards(review, { showWeight }) : []),
    [review, showWeight]
  );
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  return { review, cards, failed, retry };
}
