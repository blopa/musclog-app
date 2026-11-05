import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { YearShareSheet } from '@/components/yearInReview/YearShareSheet';
import { YearStoryCardView } from '@/components/yearInReview/YearStoryCardView';
import type { AppLockArea } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';
import { YearInReviewRepository } from '@/database/repositories/YearInReviewRepository';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';
import { buildYearInReview } from '@/utils/yearInReview/engine';
import { yearReviewSeason } from '@/utils/yearInReview/season';
import { buildYearStoryCards } from '@/utils/yearInReview/storyCards';
import type { YearInReviewInput } from '@/utils/yearInReview/types';

/** The workout and nutrition records this review reads. The weight card has its own progress check. */
const YEAR_IN_REVIEW_LOCK_AREAS: AppLockArea[] = ['workout', 'nutrition'];

/** Accepts only a plausible year; anything else falls back to the season's year. */
function yearFromParam(value: string | undefined, fallback: number): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1970 && year <= 2100 ? year : fallback;
}

export default function YearInReviewScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { units } = useSettings();
  const { isLocked } = useAppLock();
  const router = useRouter();
  const { year: yearParam } = useLocalSearchParams<{ year?: string }>();
  const season = useMemo(() => yearReviewSeason(new Date()), []);
  const year = yearFromParam(yearParam, season.year);
  const showWeight = !isLocked('progress');

  const [input, setInput] = useState<YearInReviewInput | null>(null);
  const [index, setIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, showWeight]);

  // A result for another year is not shown: the previous year's figures never linger under a new one.
  const review = useMemo(
    () => (input && input.year === year ? buildYearInReview(input) : null),
    [input, year]
  );
  const cards = useMemo(
    () => (review ? buildYearStoryCards(review, { showWeight }) : []),
    [review, showWeight]
  );

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const current = Math.min(index, Math.max(cards.length - 1, 0));
  const card = cards[current];
  const isLast = current >= cards.length - 1;

  return (
    <MasterLayout>
      <ScreenHeader
        title={t('yearInReview.title')}
        subtitle={String(year)}
        lockArea={YEAR_IN_REVIEW_LOCK_AREAS}
        actions={
          review !== null && review.sessions !== null ? (
            <IconButton
              icon={Share2}
              accessibilityLabel={t('yearInReview.shareButton')}
              onPress={() => setShareOpen(true)}
              variant="ghost"
            />
          ) : null
        }
      />
      <AreaLockGate area={YEAR_IN_REVIEW_LOCK_AREAS}>
        <View className="flex-1 gap-4 p-4">
          {review === null && !loadFailed ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : null}
          {loadFailed || (review !== null && !review.hasContent) ? (
            <Text className="text-base text-text-secondary">{t('yearInReview.empty')}</Text>
          ) : null}
          {review !== null && review.hasContent && card ? (
            <>
              <View
                className="flex-row gap-1"
                accessible
                accessibilityLabel={t('yearInReview.stepOf', {
                  current: formatInteger(current + 1),
                  total: formatInteger(cards.length),
                })}
              >
                {cards.map((item, i) => (
                  <View
                    key={`${item.kind}-${i}`}
                    className="h-1 flex-1 rounded-tag"
                    style={{
                      backgroundColor:
                        i <= current ? theme.colors.accent.primary : theme.colors.border.light,
                    }}
                  />
                ))}
              </View>
              <View className="flex-1 rounded-card border border-border-light bg-bg-card px-6">
                <YearStoryCardView card={card} review={review} units={units} locale={locale} />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    label={t('yearInReview.back')}
                    variant="outline"
                    disabled={current === 0}
                    onPress={() => setIndex(Math.max(0, current - 1))}
                    width="full"
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label={isLast ? t('yearInReview.done') : t('yearInReview.next')}
                    variant="accent"
                    onPress={() => (isLast ? router.back() : setIndex(current + 1))}
                    width="full"
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>

        {review !== null ? (
          <YearShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            review={review}
            units={units}
            weightAvailable={showWeight}
          />
        ) : null}
      </AreaLockGate>
    </MasterLayout>
  );
}
