import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { LoggyPose, useLoggyVisible } from '@/components/LoggyPose';
import { IconButton } from '@/components/theme/IconButton';
import { LOGGY_PALETTE, POSTER_GROUNDS } from '@/constants/loggyPalette';
import { SETTINGS } from '@/constants/settingDefinitions';
import { YEAR_IN_REVIEW_ROUTE } from '@/constants/yearInReviewRoute';
import { YearInReviewRepository } from '@/database/repositories/YearInReviewRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { handleError } from '@/utils/handleError';
import { yearReviewSeason } from '@/utils/yearInReview/season';

const POSE_HEIGHT = 112;

/**
 * Home's offer of the year-end review. It shows only in the season, only when the year has a
 * completed session, and only until the user dismisses it for that year. Tapping opens the
 * review; the close control hides this year's card for good.
 */
export function YearInReviewCard() {
  const { t } = useTranslation();
  const showLoggy = useLoggyVisible();
  const router = useRouter();
  const season = useMemo(() => yearReviewSeason(new Date()), []);
  // The year the card is about, once it has decided to show it.
  const [offerYear, setOfferYear] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!season.active) {
      return;
    }

    void (async () => {
      try {
        const [dismissedYear, hasSession] = await Promise.all([
          SettingsService.get(SETTINGS.yearReviewDismissedYear),
          YearInReviewRepository.hasCompletedSession(season.year),
        ]);
        if (!cancelled && hasSession && dismissedYear !== season.year) {
          setOfferYear(season.year);
        }
      } catch (error: unknown) {
        await handleError(error, 'yearInReviewCard');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [season.active, season.year]);

  if (offerYear === null) {
    return null;
  }

  const dismiss = () => {
    setOfferYear(null);
    void SettingsService.set(SETTINGS.yearReviewDismissedYear, offerYear);
  };

  return (
    <View
      className="overflow-hidden rounded-card"
      style={{ backgroundColor: POSTER_GROUNDS.yellow.background }}
      testID="year-in-review-card"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('yearInReview.homeCard.open')}
        onPress={() => router.push(`${YEAR_IN_REVIEW_ROUTE}?year=${offerYear}`)}
        className="flex-row items-end active:opacity-80"
      >
        <View className="min-w-0 flex-1 gap-1 p-4">
          <Text className="text-xl font-bold" style={{ color: LOGGY_PALETTE.ink }}>
            {t('yearInReview.homeCard.title', { year: String(offerYear) })}
          </Text>
          <Text className="text-base" style={{ color: LOGGY_PALETTE.ink }}>
            {t('yearInReview.homeCard.body')}
          </Text>
        </View>
        {showLoggy ? (
          <View className="-mb-1 mr-8">
            <LoggyPose pose="wave" height={POSE_HEIGHT} />
          </View>
        ) : null}
      </Pressable>
      <View className="absolute right-1 top-1">
        <IconButton
          icon={X}
          variant="ghost"
          size="sm"
          color={LOGGY_PALETTE.ink}
          accessibilityLabel={t('yearInReview.homeCard.dismiss')}
          onPress={dismiss}
        />
      </View>
    </View>
  );
}
