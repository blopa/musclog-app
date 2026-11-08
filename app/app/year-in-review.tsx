import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, type LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { LOGGY_FAILURE_POSE, LoggyPose, type LoggyPoseName } from '@/components/LoggyPose';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import type { PosterSize } from '@/components/yearInReview/posterKit';
import { YearShareSheet } from '@/components/yearInReview/YearShareSheet';
import { YearStoryCardView } from '@/components/yearInReview/YearStoryCardView';
import type { AppLockArea } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useStoryPager } from '@/hooks/useStoryPager';
import { useTheme } from '@/hooks/useTheme';
import { useYearInReview } from '@/hooks/useYearInReview';
import { yearReviewSeason } from '@/utils/yearInReview/season';

/** The workout and nutrition records this review reads. The weight card has its own progress check. */
const YEAR_IN_REVIEW_LOCK_AREAS: AppLockArea[] = ['workout', 'nutrition'];

/** A tap on the left of the poster goes back, the rest goes on, like any story. */
const BACK_TAP_SHARE = 0.3;
const EMPTY_POSE_HEIGHT = 240;
const SHARE_BUTTON_FLEX = 1.6;

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

  const { review, cards, failed: loadFailed, retry } = useYearInReview(year, showWeight);
  const { current, isFirst, isLast, back, next } = useStoryPager(cards.length);
  const [shareOpen, setShareOpen] = useState(false);
  const [poster, setPoster] = useState<PosterSize | null>(null);
  const openShare = useCallback(() => setShareOpen(true), []);

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const card = cards[current];
  const canShare = review !== null && review.sessions !== null;
  const thisYear = new Date().getFullYear();

  const handlePosterLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setPoster((previous) =>
      previous?.width === width && previous.height === height ? previous : { width, height }
    );
  }, []);

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader
        title={t('yearInReview.title')}
        subtitle={String(year)}
        lockArea={YEAR_IN_REVIEW_LOCK_AREAS}
        actions={
          canShare ? (
            <IconButton
              icon={Share2}
              accessibilityLabel={t('yearInReview.shareButton')}
              onPress={openShare}
              variant="ghost"
            />
          ) : null
        }
      />
      <AreaLockGate area={YEAR_IN_REVIEW_LOCK_AREAS}>
        <View className="flex-1 gap-3 p-4">
          {review === null && !loadFailed ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : null}
          {loadFailed ? (
            <YearMessage
              pose={LOGGY_FAILURE_POSE}
              message={t('yearInReview.loadFailed')}
              actionLabel={t('yearInReview.retry')}
              onAction={retry}
            />
          ) : null}
          {!loadFailed && review !== null && !review.hasContent ? (
            <YearMessage
              pose="magnify"
              message={t('yearInReview.empty')}
              // Settings opens the last finished year, which a first-year user does not have.
              actionLabel={
                year < thisYear ? t('yearInReview.seeYear', { year: String(thisYear) }) : undefined
              }
              onAction={() => router.setParams({ year: String(thisYear) })}
            />
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
              <View className="flex-1 overflow-hidden rounded-card" onLayout={handlePosterLayout}>
                {poster ? (
                  <YearStoryCardView
                    key={card.kind}
                    card={card}
                    review={review}
                    units={units}
                    locale={locale}
                    size={poster}
                  />
                ) : null}
                {/*
                  Two zones rather than one reading the tap's position: `locationX` is measured from
                  whichever child was hit, so tapping Loggy on the left read as a tap on the right.
                  A shortcut only: the buttons below stay the way in for a screen reader.
                */}
                <View className="absolute inset-0 flex-row">
                  <Pressable accessible={false} onPress={back} style={{ flex: BACK_TAP_SHARE }} />
                  <Pressable
                    accessible={false}
                    onPress={next}
                    style={{ flex: 1 - BACK_TAP_SHARE }}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                {isFirst ? null : (
                  <IconButton
                    icon={ChevronLeft}
                    accessibilityLabel={t('yearInReview.back')}
                    onPress={back}
                    size="lg"
                  />
                )}
                {isLast ? (
                  <>
                    <View className="flex-1">
                      <Button
                        label={t('yearInReview.done')}
                        variant="outline"
                        onPress={() => router.back()}
                        width="full"
                      />
                    </View>
                    {canShare ? (
                      // The wider of the two: "Поделиться" with its icon broke mid-word at half.
                      <View style={{ flex: SHARE_BUTTON_FLEX }}>
                        <Button
                          label={t('yearInReview.shareButton')}
                          icon={Share2}
                          variant="accent"
                          onPress={openShare}
                          width="full"
                        />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View className="flex-1">
                    <Button
                      label={t('yearInReview.next')}
                      variant="accent"
                      onPress={next}
                      width="full"
                    />
                  </View>
                )}
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

type YearMessageProps = {
  pose: LoggyPoseName;
  message: string;
  actionLabel?: string;
  onAction: () => void;
};

/** The screen when there is no story to tell: Loggy, one sentence and the way forward. */
function YearMessage({ pose, message, actionLabel, onAction }: YearMessageProps) {
  return (
    <View className="flex-1 items-center justify-center gap-6 px-4">
      <LoggyPose pose={pose} height={EMPTY_POSE_HEIGHT} />
      <Text className="text-center text-lg font-medium text-text-primary">{message}</Text>
      {actionLabel ? (
        <Button label={actionLabel} variant="accent" onPress={onAction} width="full" />
      ) : null}
    </View>
  );
}
