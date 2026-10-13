import { Redirect, useLocalSearchParams } from 'expo-router';

import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';

/**
 * The Weekly Review's old address. Notifications scheduled before the move, and legacy check-in
 * links, still open it, so it forwards to the new route with the same parameters (`reviewId`,
 * `reviewDay`, `checkinId`) rather than disappearing.
 */
export default function LegacyCheckinListRedirect() {
  const params = useLocalSearchParams<{
    reviewId?: string;
    reviewDay?: string;
    checkinId?: string;
  }>();
  return <Redirect href={{ pathname: WEEKLY_REVIEW_ROUTE, params }} />;
}
